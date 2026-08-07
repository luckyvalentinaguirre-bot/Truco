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
} from '../index.js';

/* =============================================================
 * Estrés: muchas partidas completas conducidas por la IA para
 * cazar bugs. Verifica invariantes en CADA paso.
 * ============================================================= */

function checkInvariants(s: MatchState, ctx: string) {
  const n = s.players.length;
  expect(s.score.A, `${ctx}: score.A>=0`).toBeGreaterThanOrEqual(0);
  expect(s.score.B, `${ctx}: score.B>=0`).toBeGreaterThanOrEqual(0);

  if (s.phase === 'finished') {
    expect(s.winner === 'A' || s.winner === 'B', `${ctx}: ganador`).toBe(true);
    expect(
      s.score[s.winner!],
      `${ctx}: ganador alcanzó objetivo`,
    ).toBeGreaterThanOrEqual(s.ruleset.targetPoints);
    return;
  }
  if (s.hand.finished) return;

  const actor = actorNow(s);
  expect(actor, `${ctx}: actorNow no nulo`).not.toBeNull();
  if (actor !== null) {
    expect(actor).toBeGreaterThanOrEqual(0);
    expect(actor).toBeLessThan(n);
    expect(legalActions(s, actor).length, `${ctx}: acciones legales`).toBeGreaterThan(0);
  }
  expect(s.hand.turnSeat).toBeGreaterThanOrEqual(0);
  expect(s.hand.turnSeat).toBeLessThan(n);
  expect(s.hand.manoSeat).toBeGreaterThanOrEqual(0);
  expect(s.hand.manoSeat).toBeLessThan(n);
  for (const p of s.players) {
    expect(
      p.hand.length + p.played.length,
      `${ctx}: 3 cartas seat ${p.seat}`,
    ).toBe(3);
  }
}

function playOneGame(mode: GameMode, seed: number): MatchState {
  let s = createMatch({ mode, seed });
  // PRNG determinista por semilla: cualquier fallo es reproducible.
  let r = (seed * 2654435761) >>> 0;
  const rng = () => {
    r = (r * 1103515245 + 12345) >>> 0;
    return r / 0xffffffff;
  };

  let guard = 0;
  while (s.phase !== 'finished') {
    if (++guard > 8000) throw new Error(`${mode}/${seed}: bucle infinito`);

    if (s.hand.finished) {
      const before = { ...s.score };
      s = startNextHand(s);
      expect(s.score.A).toBeGreaterThanOrEqual(before.A);
      expect(s.score.B).toBeGreaterThanOrEqual(before.B);
      checkInvariants(s, `${mode}/${seed} newhand`);
      continue;
    }
    const actor = actorNow(s);
    if (actor === null) throw new Error(`${mode}/${seed}: actorNow=null en curso`);
    const acts = legalActions(s, actor);
    const action = chooseAiAction(s, actor, rng, { difficulty: 'normal' });
    if (action === null) throw new Error(`${mode}/${seed}: IA devolvió null`);
    expect(acts.some((a) => a.type === action.type)).toBe(true);
    s = applyAction(s, action).state;
    checkInvariants(s, `${mode}/${seed} step ${guard}`);
  }
  checkInvariants(s, `${mode}/${seed} end`);
  return s;
}

describe('estrés del motor', () => {
  const modes: GameMode[] = ['1v1', '2v2', '3v3'];
  for (const mode of modes) {
    it(`${mode}: 60 partidas sin romper invariantes`, () => {
      for (let seed = 1; seed <= 60; seed++) {
        expect(playOneGame(mode, seed).phase).toBe('finished');
      }
    }, 30000);
  }
});
