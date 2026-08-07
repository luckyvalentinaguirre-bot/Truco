/* =============================================================
 * TRUCO ENGINE · Bazas (tricks) y resolución de la mano
 * -------------------------------------------------------------
 * Funciones PURAS y deterministas. Centralizan las reglas de
 * pardas y la ventaja de la mano. Sin estado global, sin React.
 * ============================================================= */
import type { Card, Seat, TeamId, TrickOutcome } from './types.js';
import { rankCard } from './ranking.js';

/** Una carta jugada por un jugador en una baza. */
export interface Play {
  seat: Seat;
  team: TeamId;
  card: Card;
}

export interface TrickResult {
  /** Asiento ganador, o null si fue parda. */
  winnerSeat: Seat | null;
  outcome: TrickOutcome;
}

/**
 * Resuelve una baza completa. Gana la carta de mayor fuerza; si la
 * fuerza máxima está empatada entre cartas de equipos distintos ⇒ parda.
 * Si el empate en la cima es del mismo equipo (posible en 2v2/3v3),
 * gana ese equipo (asiento del que jugó primero entre los empatados).
 */
export function resolveTrick(plays: Play[], muestra: Card): TrickResult {
  if (plays.length === 0) {
    return { winnerSeat: null, outcome: 'parda' };
  }

  let maxStrength = -Infinity;
  for (const p of plays) {
    const s = rankCard(p.card, muestra).strength;
    if (s > maxStrength) maxStrength = s;
  }

  const top = plays.filter((p) => rankCard(p.card, muestra).strength === maxStrength);
  const topTeams = new Set(top.map((p) => p.team));

  if (topTeams.size > 1) {
    return { winnerSeat: null, outcome: 'parda' };
  }

  // Un único equipo en la cima: gana el primero que la jugó.
  const winner = top[0];
  return { winnerSeat: winner.seat, outcome: winner.team };
}

/**
 * Determina el ganador de la MANO a partir de los resultados de las
 * bazas jugadas hasta el momento. Devuelve null si aún no está decidida.
 *
 * Reglas de pardas (Truco Uruguayo):
 *  - Gana quien gane 2 bazas.
 *  - Una parda se acredita al PRIMER equipo que ganó una baza en la mano
 *    (retroactivo): por eso, tras una baza ganada + parda, gana ese equipo;
 *    y si la primera baza es parda, la segunda pasa a ser decisiva.
 *  - Si las tres bazas son pardas ⇒ gana quien es mano.
 */
export function resolveHand(
  outcomes: TrickOutcome[],
  manoTeam: TeamId,
): TeamId | null {
  const firstWinner = outcomes.find((o): o is TeamId => o !== 'parda') ?? null;

  const scored: Record<TeamId, number> = { A: 0, B: 0 };
  for (const o of outcomes) {
    const owner = o === 'parda' ? firstWinner : o;
    if (owner) scored[owner] += 1;
  }

  if (scored.A >= 2) return 'A';
  if (scored.B >= 2) return 'B';

  // Con 3 bazas jugadas sin dos aciertos: sólo ocurre con todas pardas.
  if (outcomes.length >= 3) {
    return firstWinner ?? manoTeam;
  }

  return null;
}

/**
 * ¿Puede terminar la mano ya? (por ejemplo, un equipo ganó las dos
 * primeras bazas y no hace falta jugar la tercera).
 */
export function isHandDecided(
  outcomes: TrickOutcome[],
  manoTeam: TeamId,
): boolean {
  return resolveHand(outcomes, manoTeam) !== null;
}
