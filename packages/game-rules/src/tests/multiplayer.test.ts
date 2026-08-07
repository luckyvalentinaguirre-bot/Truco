import { describe, it, expect } from 'vitest';
import {
  createMatch,
  applyAction,
  actorNow,
  chooseAiAction,
  startNextHand,
  legalActions,
  responderSeat,
  envidoWinnerFrom,
  manoRank,
  type EnvidoEntry,
  type MatchState,
  type GameMode,
} from '../index.js';

/* =============================================================
 * Integración: partidas COMPLETAS 1v1 / 2v2 / 3v3 conducidas por
 * la IA (el mismo motor para todos). Verifica que el motor no se
 * rompa con múltiples jugadores y que se respeten las invariantes.
 * ============================================================= */

function playFullGame(mode: GameMode, seed: number): MatchState {
  let s = createMatch({ mode, seed });
  let guard = 0;
  while (s.phase !== 'finished') {
    if (++guard > 5000) throw new Error('bucle: la partida no termina');

    if (s.hand.finished) {
      s = startNextHand(s);
      continue;
    }
    const actor = actorNow(s);
    if (actor === null) {
      // Nadie debe actuar y la mano no terminó: estado inválido.
      throw new Error('actorNow=null con mano en curso');
    }
    // Invariante: el actor siempre tiene al menos una acción legal.
    const acts = legalActions(s, actor);
    expect(acts.length).toBeGreaterThan(0);

    const action = chooseAiAction(s, actor, Math.random, { difficulty: 'normal' });
    expect(action).not.toBeNull();
    s = applyAction(s, action!).state;
  }
  return s;
}

describe('partidas completas por modo', () => {
  const modes: GameMode[] = ['1v1', '2v2', '3v3'];
  const seeds = [1, 7, 42, 123, 999];

  for (const mode of modes) {
    it(`${mode}: varias partidas terminan con un ganador válido`, () => {
      for (const seed of seeds) {
        const end = playFullGame(mode, seed);
        expect(end.phase).toBe('finished');
        expect(end.winner === 'A' || end.winner === 'B').toBe(true);
        // El ganador llegó (o superó) el objetivo.
        expect(end.score[end.winner!]).toBeGreaterThanOrEqual(
          end.ruleset.targetPoints,
        );
      }
    });
  }

  it('cantidad de jugadores correcta por modo', () => {
    expect(createMatch({ mode: '1v1', seed: 1 }).players).toHaveLength(2);
    expect(createMatch({ mode: '2v2', seed: 1 }).players).toHaveLength(4);
    expect(createMatch({ mode: '3v3', seed: 1 }).players).toHaveLength(6);
  });

  it('equipos alternados A-B alrededor de la mesa', () => {
    for (const mode of modes) {
      const s = createMatch({ mode, seed: 3 });
      s.players.forEach((p, i) => {
        expect(p.team).toBe(i % 2 === 0 ? 'A' : 'B');
      });
    }
  });

  it('al Envido responde el PIE del equipo contrario (último en la ronda)', () => {
    for (const mode of ['2v2', '3v3'] as GameMode[]) {
      // Buscar una mano donde el mano pueda cantar Envido (sin Flor de por medio).
      let s: MatchState | null = null;
      for (let seed = 1; seed < 60 && !s; seed++) {
        const cand = createMatch({ mode, seed });
        const m = cand.players[cand.hand.manoSeat];
        if (legalActions(cand, m.seat).some((a) => a.type === 'CALL_ENVIDO')) s = cand;
      }
      expect(s).not.toBeNull();
      const n = s!.players.length;
      const caller = s!.players[s!.hand.manoSeat];
      const s1 = applyAction(s!, {
        type: 'CALL_ENVIDO',
        seat: caller.seat,
        call: 'envido',
      }).state;
      const resp = responderSeat(s1);
      expect(resp).not.toBeNull();
      // Es del equipo rival…
      expect(s1.players[resp!].team).not.toBe(caller.team);
      // …y es el de MAYOR rango de mano de ese equipo (el pie / último).
      const rivals = s1.players.filter((p) => p.team !== caller.team);
      const maxRank = Math.max(
        ...rivals.map((p) => manoRank(p.seat, s1.hand.manoSeat, n)),
      );
      expect(manoRank(resp!, s1.hand.manoSeat, n)).toBe(maxRank);
    }
  });

  it('el ganador de la baza juega primero en la siguiente', () => {
    for (const mode of modes) {
      // Jugar hasta resolver la primera baza sin que sea parda.
      for (let seed = 1; seed < 40; seed++) {
        let s = createMatch({ mode, seed });
        let guard = 0;
        let resolved = false;
        while (!s.hand.finished && guard++ < 200) {
          const actor = actorNow(s);
          if (actor === null) break;
          // Sólo jugar cartas para forzar la resolución de la baza.
          const acts = legalActions(s, actor);
          const play = acts.find((a) => a.type === 'PLAY_CARD');
          if (!play) {
            // Si hay un canto pendiente, resolver con la IA.
            s = applyAction(
              s,
              chooseAiAction(s, actor, () => 0, { difficulty: 'normal' })!,
            ).state;
            continue;
          }
          const before = s.hand.tricks.length;
          s = applyAction(s, play).state;
          const trick = s.hand.tricks[before - 1];
          if (trick?.winnerSeat != null && s.hand.tricks.length > before) {
            // Baza resuelta con ganador y hay una nueva baza abierta.
            expect(s.hand.turnSeat).toBe(trick.winnerSeat);
            resolved = true;
            break;
          }
        }
        if (resolved) break;
      }
    }
  });

  it('3v3 · envido "pico a pico": gana el mejor tanto de cualquier jugador', () => {
    // Asientos 0,2,4 = equipo A ; 1,3,5 = equipo B (intercalados). Mano = 0.
    // El pie de B (asiento 5) tiene el tanto más alto: su equipo gana el envido
    // aunque esté último en la ronda (se compara pico a pico, no por posición).
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 27 },
      { seat: 1, team: 'B', value: 20 },
      { seat: 2, team: 'A', value: 31 },
      { seat: 3, team: 'B', value: 18 },
      { seat: 4, team: 'A', value: 25 },
      { seat: 5, team: 'B', value: 33 }, // el más alto de la mesa
    ];
    expect(envidoWinnerFrom(entries, 0, 6)).toBe('B');
  });

  it('3v3 · pico a pico: a igual mejor tanto, gana el equipo más mano', () => {
    // Mejor tanto de A = 30 (asiento 2) ; mejor de B = 30 (asiento 3).
    // Empate: gana quien tenga MENOR rango de mano. Con mano=0, el asiento 2
    // (rank 2) es más mano que el 3 (rank 3) ⇒ gana A.
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 22 },
      { seat: 1, team: 'B', value: 19 },
      { seat: 2, team: 'A', value: 30 },
      { seat: 3, team: 'B', value: 30 },
      { seat: 4, team: 'A', value: 28 },
      { seat: 5, team: 'B', value: 26 },
    ];
    expect(envidoWinnerFrom(entries, 0, 6)).toBe('A');
    // Si movemos la mano al asiento 3, ahora B (asiento 3, rank 0) es el más
    // mano de los dos empatados ⇒ gana B.
    expect(envidoWinnerFrom(entries, 3, 6)).toBe('B');
  });

  it('el mano es el asiento siguiente al repartidor', () => {
    for (const mode of modes) {
      const s = createMatch({ mode, seed: 3 });
      const n = s.players.length;
      expect(s.hand.manoSeat).toBe((s.dealerSeat + 1) % n);
      expect(s.hand.turnSeat).toBe(s.hand.manoSeat);
    }
  });
});
