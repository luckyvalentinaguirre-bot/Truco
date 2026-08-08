/* =============================================================
 * PICO A PICO 3v3 — ronda como fase interna (spec definitiva).
 * Tests obligatorios (§39/§40): reparto único, mazo congelado, tres
 * duelos en orden, tantos ocultos hasta la revelación, máquina de
 * estados, corte al entrar a buenas, privacidad por asiento.
 * ============================================================= */
import { describe, it, expect } from 'vitest';
import {
  applyAction,
  actorNow,
  chooseAiAction,
  OFFICIAL_40,
  type MatchState,
} from '../index.js';
import {
  startPicoRound,
  buildDuelState,
  finishDuel,
  revealTotals,
  redactPicoRoundFor,
  pairSeats,
  picoCycleContinues,
  PICO_DUEL_PHASES,
  type PicoRound,
  type GameEvent,
} from '../index.js';

const rng = () => 0.5;

/** Juega un duelo COMPLETO con la IA usando el reductor existente. */
function playDuel(duel: MatchState): { state: MatchState; events: GameEvent[] } {
  let s = duel;
  const events: GameEvent[] = [];
  let guard = 0;
  while (!s.hand.finished && s.phase !== 'finished') {
    if (++guard > 500) throw new Error('bucle en duelo');
    const actor = actorNow(s);
    if (actor === null) throw new Error('actorNow=null en duelo');
    const action = chooseAiAction(s, actor, rng, { difficulty: 'normal' });
    const applied = applyAction(s, action!);
    s = applied.state;
    events.push(...applied.events);
  }
  return { state: s, events };
}

/** Corre una ronda de pico completa (tres duelos) devolviendo la ronda final. */
function runRound(seed: number): PicoRound {
  let round = startPicoRound(seed, 1);
  for (let i = 0; i < 3; i++) {
    const duel = buildDuelState(round, round.currentDuel, OFFICIAL_40, seed);
    const { state, events } = playDuel(duel);
    round = finishDuel(round, state, events);
  }
  return round;
}

describe('picoRound · reparto único y mazo congelado (§5/§27)', () => {
  it('reparte 3 cartas a cada uno de los 6 y una muestra, sin repetir cartas', () => {
    const r = startPicoRound(7, 1);
    expect(r.hands).toHaveLength(6);
    for (const h of r.hands) expect(h).toHaveLength(3);
    const all = r.hands.flat().map((c) => `${c.rank}-${c.suit}`);
    all.push(`${r.muestra.rank}-${r.muestra.suit}`);
    expect(new Set(all).size).toBe(all.length); // 19 cartas distintas
    expect(r.deckPosition).toBe(18);
  });

  it('deckPosition es IDÉNTICO durante los tres duelos (mazo quieto)', () => {
    let round = startPicoRound(3, 1);
    const positions: number[] = [];
    for (let i = 0; i < 3; i++) {
      positions.push(round.deckPosition);
      const duel = buildDuelState(round, round.currentDuel, OFFICIAL_40, 3);
      const { state, events } = playDuel(duel);
      round = finishDuel(round, state, events);
    }
    expect(positions).toEqual([18, 18, 18]);
  });

  it('cada duelo usa las MISMAS cartas repartidas (no se vuelve a repartir)', () => {
    const round = startPicoRound(11, 1);
    const { seatA, seatB } = pairSeats(1);
    const duel = buildDuelState(round, 1, OFFICIAL_40, 11);
    expect(duel.players[seatA]!.hand).toEqual(round.hands[seatA]);
    expect(duel.players[seatB]!.hand).toEqual(round.hands[seatB]);
    // Los otros cuatro están al mazo, sin cartas.
    for (const p of duel.players) {
      if (p.seat !== seatA && p.seat !== seatB) {
        expect(p.folded).toBe(true);
        expect(p.hand).toHaveLength(0);
      }
    }
  });
});

describe('picoRound · tres duelos en orden y máquina de estados (§6/§33)', () => {
  it('pares enfrentados: 0→(0,3) A0/B3, 1→(1,4) A4/B1, 2→(2,5) A2/B5', () => {
    expect(pairSeats(0)).toEqual({ seatA: 0, seatB: 3 });
    expect(pairSeats(1)).toEqual({ seatA: 4, seatB: 1 });
    expect(pairSeats(2)).toEqual({ seatA: 2, seatB: 5 });
  });

  it('avanza PICO_1V1_1 → _2 → _3 → PICO_REVELACION', () => {
    let round = startPicoRound(5, 1);
    expect(round.phase).toBe('PICO_1V1_1');
    const seen: string[] = [round.phase];
    for (let i = 0; i < 3; i++) {
      const duel = buildDuelState(round, round.currentDuel, OFFICIAL_40, 5);
      const { state, events } = playDuel(duel);
      round = finishDuel(round, state, events);
      seen.push(round.phase);
    }
    expect(seen).toEqual([
      'PICO_1V1_1',
      'PICO_1V1_2',
      'PICO_1V1_3',
      'PICO_REVELACION',
    ]);
    expect(PICO_DUEL_PHASES).toEqual(['PICO_1V1_1', 'PICO_1V1_2', 'PICO_1V1_3']);
  });
});

describe('picoRound · tantos ocultos hasta la revelación (§10/§11/§12/§20)', () => {
  it('se registran resultados en los tres duelos y se revelan sólo al final', () => {
    let round = startPicoRound(7, 1);
    for (let i = 0; i < 3; i++) {
      // Antes de terminar el duelo actual, nada revelado.
      expect(round.revealed).toBe(false);
      const duel = buildDuelState(round, round.currentDuel, OFFICIAL_40, 7);
      const { state, events } = playDuel(duel);
      round = finishDuel(round, state, events);
    }
    expect(round.revealed).toBe(true);
    expect(round.hiddenResults).toHaveLength(3);
    // Cada duelo tuvo un ganador de mano ⇒ aportó puntos (deltas no ambos cero).
    for (const r of round.hiddenResults) {
      expect(r.deltas.A + r.deltas.B).toBeGreaterThan(0);
    }
    // El total a aplicar al score real = suma de los deltas ocultos.
    const totals = revealTotals(round);
    const sumA = round.hiddenResults.reduce((a, r) => a + r.deltas.A, 0);
    const sumB = round.hiddenResults.reduce((a, r) => a + r.deltas.B, 0);
    expect(totals).toEqual({ A: sumA, B: sumB });
  });

  it('los puntos del duelo NO tocan un score público durante el duelo (score aislado)', () => {
    const round = startPicoRound(7, 1);
    const duel = buildDuelState(round, 0, OFFICIAL_40, 7);
    expect(duel.score).toEqual({ A: 0, B: 0 }); // arranca aislado en 0-0
    const { state } = playDuel(duel);
    // El sub-estado acumula sus propios puntos, que quedarán OCULTOS en la ronda.
    expect(state.score.A + state.score.B).toBeGreaterThan(0);
  });
});

describe('picoRound · privacidad por asiento (§8/§24/§38)', () => {
  it('un espectador no recibe cartas de los duelistas ni resultados ocultos', () => {
    const round = startPicoRound(3, 1); // duelo 0 = asientos 0 y 3
    const spectator = 1; // no participa del duelo en curso
    const view = redactPicoRoundFor(round, spectator);
    for (const h of view.hands!) expect(h).toHaveLength(0);
    expect(view.hiddenResults).toEqual([]);
  });

  it('el duelista ve SÓLO sus cartas, nunca las del rival', () => {
    const round = startPicoRound(3, 1); // duelo 0 = A0 vs B3
    const viewA = redactPicoRoundFor(round, 0);
    expect(viewA.hands![0]).toEqual(round.hands[0]); // sus cartas
    expect(viewA.hands![3]).toEqual([]); // las del rival, ocultas
  });

  it('los resultados ocultos sólo viajan cuando revealed=true', () => {
    let round = startPicoRound(7, 1);
    for (let i = 0; i < 3; i++) {
      const duel = buildDuelState(round, round.currentDuel, OFFICIAL_40, 7);
      const { state, events } = playDuel(duel);
      round = finishDuel(round, state, events);
    }
    const view = redactPicoRoundFor(round, 1);
    expect(round.revealed).toBe(true);
    expect(view.hiddenResults).toHaveLength(3); // ya revelados
  });
});

describe('picoRound · corte del ciclo al entrar a buenas (§32)', () => {
  it('picoCycleContinues: true en malas, false cuando un equipo llega a buenas', () => {
    expect(picoCycleContinues({ A: 5, B: 3 }, OFFICIAL_40)).toBe(true);
    // OFFICIAL_40: malas hasta la mitad del objetivo.
    const buenas = OFFICIAL_40.malas;
    expect(picoCycleContinues({ A: buenas, B: 3 }, OFFICIAL_40)).toBe(false);
  });
});

describe('picoRound · determinismo', () => {
  it('misma semilla ⇒ mismos resultados ocultos', () => {
    const a = runRound(42);
    const b = runRound(42);
    expect(a.hiddenResults).toEqual(b.hiddenResults);
    expect(revealTotals(a)).toEqual(revealTotals(b));
  });
});
