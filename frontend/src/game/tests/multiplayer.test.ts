import { describe, it, expect } from 'vitest';
import {
  createMatch,
  applyAction,
  actorNow,
  chooseAiAction,
  startNextHand,
  legalActions,
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

  it('el mano es el asiento siguiente al repartidor', () => {
    for (const mode of modes) {
      const s = createMatch({ mode, seed: 3 });
      const n = s.players.length;
      expect(s.hand.manoSeat).toBe((s.dealerSeat + 1) % n);
      expect(s.hand.turnSeat).toBe(s.hand.manoSeat);
    }
  });
});
