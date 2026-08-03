import { describe, it, expect } from 'vitest';
import {
  createMatch,
  applyAction,
  actorNow,
  chooseAiAction,
  startNextHand,
  legalActions,
  responderSeat,
  manoRank,
  type MatchState,
  type GameMode,
} from '../index';

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

  it('el mano es el asiento siguiente al repartidor', () => {
    for (const mode of modes) {
      const s = createMatch({ mode, seed: 3 });
      const n = s.players.length;
      expect(s.hand.manoSeat).toBe((s.dealerSeat + 1) % n);
      expect(s.hand.turnSeat).toBe(s.hand.manoSeat);
    }
  });
});
