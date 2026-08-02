/* =============================================================
 * TRUCO ENGINE · Marcador y fin de partida
 * ============================================================= */
import type { Ruleset, TeamId } from './types';

export interface Score {
  A: number;
  B: number;
}

export function initScore(): Score {
  return { A: 0, B: 0 };
}

/** Suma puntos a un equipo sin exceder el objetivo del reglamento. */
export function addPoints(
  score: Score,
  team: TeamId,
  points: number,
  ruleset: Ruleset,
): Score {
  const next = { ...score };
  next[team] = Math.min(ruleset.targetPoints, next[team] + points);
  return next;
}

/** Ganador de la partida si alguien alcanzó el objetivo, o null. */
export function gameWinner(score: Score, ruleset: Ruleset): TeamId | null {
  if (score.A >= ruleset.targetPoints) return 'A';
  if (score.B >= ruleset.targetPoints) return 'B';
  return null;
}

export function isGameOver(score: Score, ruleset: Ruleset): boolean {
  return gameWinner(score, ruleset) !== null;
}

/** ¿El equipo está en "buenas" (segunda mitad del chico)? */
export function isInBuenas(team: TeamId, score: Score, ruleset: Ruleset): boolean {
  return score[team] >= ruleset.malas;
}
