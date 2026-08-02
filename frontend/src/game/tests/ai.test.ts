import { describe, it, expect } from 'vitest';
import { createMatch } from '../setup';
import { applyAction, actorNow, legalActions, isLegal, startNextHand } from '../engine';
import { chooseAiAction } from '../ai';
import { mulberry32 } from '../prng';
import type { MatchState } from '../state';
import type { Seat } from '../types';
import type { Action } from '../actions';
import { OFFICIAL_40 } from '../ruleset';

const HUMAN: Seat = 0;

/** Política "humana" determinista: preferir jugar carta para avanzar. */
function humanPolicy(state: MatchState, seat: Seat, rng: () => number): Action {
  const legal = legalActions(state, seat);
  const plays = legal.filter((a) => a.type === 'PLAY_CARD');
  if (plays.length > 0) return plays[Math.floor(rng() * plays.length)];
  return legal[0];
}

/** Simula una partida completa como lo haría el controlador (sin React). */
function simulate(seed: number) {
  let state = createMatch({ mode: '1v1', seed });
  const rng = mulberry32(seed ^ 0x1234);
  const applied: { seat: Seat; action: Action }[] = [];
  let guard = 0;

  while (state.phase === 'playing') {
    if (guard++ > 5000) throw new Error('la partida no termina');
    if (state.hand.finished) {
      state = startNextHand(state);
      continue;
    }
    const actor = actorNow(state);
    if (actor === null) break;
    const action =
      actor === HUMAN ? humanPolicy(state, actor, rng) : chooseAiAction(state, actor, rng)!;

    // INVARIANTE: toda acción aplicada debe ser legal según el motor.
    expect(isLegal(state, action)).toBe(true);

    const prevTotal = state.score.A + state.score.B;
    state = applyAction(state, action).state;
    applied.push({ seat: actor, action });

    // INVARIANTE: el marcador nunca decrece.
    expect(state.score.A + state.score.B).toBeGreaterThanOrEqual(prevTotal);
  }

  return { state, applied };
}

describe('IA: sólo acciones legales', () => {
  it('chooseAiAction devuelve siempre una acción legal', () => {
    const state = createMatch({ mode: '1v1', seed: 77 });
    const rng = mulberry32(1);
    for (let i = 0; i < 50; i++) {
      const action = chooseAiAction(state, 1, rng);
      expect(action).not.toBeNull();
      expect(isLegal(state, action!)).toBe(true);
    }
  });
});

describe('Partida completa humano vs IA', () => {
  it('varias semillas terminan con un ganador y sin acciones ilegales', () => {
    for (const seed of [1, 2, 3, 42, 100, 2024]) {
      const { state } = simulate(seed);
      expect(state.phase).toBe('finished');
      expect(state.winner).not.toBeNull();
      expect(state.score[state.winner!]).toBeGreaterThanOrEqual(
        OFFICIAL_40.targetPoints,
      );
    }
  });

  it('el perdedor nunca supera el objetivo', () => {
    const { state } = simulate(555);
    const loser = state.winner === 'A' ? 'B' : 'A';
    expect(state.score[loser]).toBeLessThan(OFFICIAL_40.targetPoints);
  });
});
