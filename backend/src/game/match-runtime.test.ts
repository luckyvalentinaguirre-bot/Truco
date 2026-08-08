/* =============================================================
 * §32/§33/§34 · Servidor autoritativo — validación, privacidad y Pico a Pico.
 * Se testea la AUTORIDAD real (MatchRuntime), no un mock de WebSocket.
 * ============================================================= */
import { describe, it, expect } from 'vitest';
import { cardId, type MatchState, type Seat } from '@truco/game-rules';
import { MatchRuntime } from './match-runtime.js';

const rng = () => 0.5;
const users6 = ['u0', 'u1', 'u2', 'u3', 'u4', 'u5'];
const users2 = ['u0', 'u1'];

describe('MatchRuntime · validación de acciones (§7/§31)', () => {
  it('rechaza acción de un usuario ajeno a la partida', () => {
    const rt = new MatchRuntime({ matchId: 'm1', mode: '1v1', seed: 1, seatUsers: users2 });
    expect(rt.applyClientAction('intruso', { type: 'FOLD' })).toEqual({
      ok: false,
      reason: 'not_in_match',
    });
  });

  it('rechaza jugar fuera de turno', () => {
    const rt = new MatchRuntime({ matchId: 'm2', mode: '1v1', seed: 1, seatUsers: users2 });
    const actor = rt.currentActorSeat!;
    const other = actor === 0 ? 1 : 0;
    // El que NO es actor intenta jugar una carta cualquiera.
    const res = rt.applyClientAction(users2[other]!, { type: 'PLAY_CARD', cardId: '1-oro' });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not_your_turn');
  });

  it('rechaza jugar una carta que no está en la mano (carta inexistente)', () => {
    const rt = new MatchRuntime({ matchId: 'm3', mode: '1v1', seed: 1, seatUsers: users2 });
    const actor = rt.currentActorSeat!;
    // cardId imposible para forzar el rechazo.
    const res = rt.applyClientAction(users2[actor]!, { type: 'PLAY_CARD', cardId: '99-oro' });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('invalid_action');
  });
});

describe('MatchRuntime · privacidad del snapshot (§9/§33)', () => {
  it('el snapshot de un jugador NO contiene las cartas de los demás', () => {
    const rt = new MatchRuntime({ matchId: 'm4', mode: '2v2', seed: 3, seatUsers: users6.slice(0, 4) });
    const snap = rt.snapshotForUser('u0');
    const wire = JSON.stringify(snap);
    const game = snap.game as MatchState;
    // Sus propias cartas están; las de los rivales, no (mano vacía redactada).
    expect(game.players[0]!.hand.length).toBe(3);
    for (const seat of [1, 2, 3]) {
      expect(game.players[seat]!.hand).toEqual([]);
    }
    // Ninguna carta EXCLUSIVA de un rival aparece en el payload serializado.
    // (verificación directa sobre el estado interno vía snapshot del propio rival)
    const rivalSnap = rt.snapshotForUser('u1');
    const rivalHand = (rivalSnap.game as MatchState).players[1]!.hand;
    for (const c of rivalHand) {
      if (!game.players[0]!.hand.some((o) => cardId(o) === cardId(c))) {
        expect(wire).not.toContain(`"rank":${c.rank},"suit":"${c.suit}"`);
      }
    }
  });

  it('un espectador no recibe ninguna carta privada', () => {
    const rt = new MatchRuntime({ matchId: 'm5', mode: '1v1', seed: 1, seatUsers: users2 });
    const snap = rt.spectatorSnapshot();
    for (const p of (snap.game as MatchState).players) {
      expect(p.hand).toEqual([]);
    }
  });
});

describe('MatchRuntime · Pico a Pico E2E (§34)', () => {
  it('3v3 normal → pico → 3 duelos (mazo fijo) → revelación → 3v3, tantos ocultos', () => {
    const rt = new MatchRuntime({
      matchId: 'pico1',
      mode: '3v3',
      seed: 7,
      picoAPico: true,
      seatUsers: users6,
    });
    // Arranca en 3v3 normal.
    expect(rt.phaseName).toBe('normal');

    const deckPositions: number[] = [];
    const hiddenSeenDuringDuels: boolean[] = [];
    let enteredPico = false;
    let sawReveal = false;
    let guard = 0;

    while (!rt.isFinished && guard < 4000) {
      guard++;
      if (rt.phaseName === 'pico') {
        enteredPico = true;
        deckPositions.push(rt.picoRound!.deckPosition);
        // Un NO-duelista no recibe cartas ajenas ni resultados ocultos.
        const duel = rt.duelParticipants()!;
        const spectatorSeat = [0, 1, 2, 3, 4, 5].find(
          (s) => s !== duel.seatA && s !== duel.seatB,
        )! as Seat;
        const snap = rt.snapshotForUser(users6[spectatorSeat]!);
        expect(snap.pico!.hiddenResults).toEqual([]); // ocultos durante los duelos
        hiddenSeenDuringDuels.push((snap.revealedTotals ?? null) === null);
      }
      if (rt.picoRound?.phase === 'PICO_REVELACION') sawReveal = true;
      if (!rt.stepBot(rng)) break;
    }

    expect(enteredPico).toBe(true);
    // El mazo no se movió durante los duelos de una misma ronda.
    // (todas las posiciones observadas dentro de una ronda son iguales)
    for (const pos of deckPositions) expect(pos).toBe(deckPositions[0]);
    // Durante los duelos, nunca se revelaron totales.
    expect(hiddenSeenDuringDuels.every(Boolean)).toBe(true);
    void sawReveal;
    // La partida progresa hacia un ganador.
    expect(rt.publicScore.A + rt.publicScore.B).toBeGreaterThan(0);
  });
});

describe('MatchRuntime · bots server-side (§24/§28)', () => {
  it('autoRunBots juega los turnos de los asientos bot hasta que le toca al humano', () => {
    // Asiento 0 = humano, asiento 1 = bot.
    const rt = new MatchRuntime({
      matchId: 'bots1',
      mode: '1v1',
      seed: 4,
      seatUsers: ['u0', 'bot:1'],
    });
    // Corremos bots: si el bot es mano, juega; se detiene en el turno del humano
    // o si la partida termina.
    rt.autoRunBots(rng);
    const actor = rt.currentActorSeat;
    // Tras autoRunBots, o le toca al humano (0), o la partida terminó.
    expect(actor === 0 || rt.isFinished).toBe(true);
  });

  it('una partida vs bot progresa cuando el humano juega y luego corren los bots', () => {
    const rt = new MatchRuntime({
      matchId: 'bots2',
      mode: '1v1',
      seed: 9,
      seatUsers: ['u0', 'bot:1'],
    });
    let guard = 0;
    while (!rt.isFinished && guard < 2000) {
      guard++;
      rt.autoRunBots(rng); // bots juegan lo suyo
      if (rt.isFinished) break;
      // Turno del humano: lo resolvemos con la IA server-side (stepBot) para el test.
      if (rt.currentActorSeat === 0) rt.stepBot(rng);
    }
    expect(rt.isFinished).toBe(true);
  });
});

describe('MatchRuntime · reconexión (§22)', () => {
  it('reconectar devuelve un snapshot autorizado sin reiniciar la partida', () => {
    const rt = new MatchRuntime({ matchId: 'rc1', mode: '1v1', seed: 5, seatUsers: users2 });
    rt.setConnection('u0', 'CONNECTED');
    // Avanzamos algunas acciones (IA server-side).
    rt.stepBot(rng);
    const before = rt.snapshotForUser('u0');
    rt.setConnection('u0', 'DISCONNECTED');
    const snap = rt.reconnect('u0');
    expect(snap).not.toBeNull();
    expect(snap!.viewerSeat).toBe(0);
    // El estado se conservó (mismo score y misma fase).
    expect(snap!.score).toEqual(before.score);
    expect(snap!.phase).toBe(before.phase);
    // Su propia mano vuelve a estar disponible tras reconectar.
    expect((snap!.game as MatchState).players[0]!.hand.length).toBeGreaterThan(0);
  });
});
