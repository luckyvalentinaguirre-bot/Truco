/* =============================================================
 * Competitivo · Motor de ELO (server-authoritative, puro y auditable)
 * -------------------------------------------------------------
 * AUTORIDAD del cambio de rating. El cliente NUNCA envía el ELO
 * resultante: el servidor lo calcula acá y lo persiste.
 *
 * FÓRMULA (ELO clásico, documentada):
 *   E_A = 1 / (1 + 10^((R_B - R_A) / 400))     // puntaje esperado del lado A
 *   R_A' = round( R_A + K * (S_A - E_A) )       // S_A ∈ {1 gana, 0 pierde}
 *
 * EQUIPOS (2v2, 3v3): se usa el PROMEDIO de rating de cada equipo como
 * "rating del lado". El mismo delta calculado para el lado se aplica a
 * cada integrante de ese lado (elección simple, justa y documentada:
 * todos los del equipo ganan/pierden lo mismo, y el balance depende del
 * promedio rival). No se calcula como N duelos 1v1 independientes.
 *
 * Pico a Pico: es parte de UNA partida competitiva global; su resultado
 * alimenta un único cálculo de equipo, no tres partidas separadas.
 * ============================================================= */

/** Rating inicial de un jugador sin historial competitivo. */
export const DEFAULT_RATING = 1000;

/** Piso de rating: el ELO nunca baja de acá. */
export const RATING_FLOOR = 100;

/** K-factor por defecto (sensibilidad del ajuste). */
export const DEFAULT_K = 32;

/** Puntaje esperado del lado A frente al lado B (0..1). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface RatingChange {
  /** Rating anterior. */
  before: number;
  /** Rating posterior (con piso aplicado). */
  after: number;
  /** Delta efectivo (after - before). */
  delta: number;
}

/**
 * Cambio de rating de UN lado (jugador o equipo) contra su rival.
 * @param rating   rating propio (o promedio del equipo)
 * @param opponent rating rival (o promedio del equipo rival)
 * @param won      true si el lado ganó
 * @param k        K-factor (default 32)
 */
export function calculateRatingChange(
  rating: number,
  opponent: number,
  won: boolean,
  k: number = DEFAULT_K,
): RatingChange {
  const score = won ? 1 : 0;
  const expected = expectedScore(rating, opponent);
  const raw = Math.round(rating + k * (score - expected));
  const after = Math.max(RATING_FLOOR, raw);
  return { before: rating, after, delta: after - rating };
}

/** Promedio (redondeado) de una lista de ratings. Vacío ⇒ DEFAULT_RATING. */
export function teamAverage(ratings: number[]): number {
  if (ratings.length === 0) return DEFAULT_RATING;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round(sum / ratings.length);
}

export interface TeamMemberResult {
  userId: string;
  before: number;
  after: number;
  delta: number;
}

export interface MatchRatingResult {
  winners: TeamMemberResult[];
  losers: TeamMemberResult[];
}

export interface Side {
  /** Integrantes con su rating actual. Para 1v1, un solo integrante. */
  members: { userId: string; rating: number }[];
}

/**
 * Resuelve el cambio de ELO de una partida competitiva completa.
 * Sirve para 1v1, 2v2 y 3v3: el "lado" es un equipo (1..3 jugadores).
 * El delta se calcula con el promedio de cada equipo y se aplica por igual
 * a cada integrante del equipo correspondiente.
 */
export function resolveMatchRatings(
  winnerSide: Side,
  loserSide: Side,
  k: number = DEFAULT_K,
): MatchRatingResult {
  const winAvg = teamAverage(winnerSide.members.map((m) => m.rating));
  const loseAvg = teamAverage(loserSide.members.map((m) => m.rating));

  const winChange = calculateRatingChange(winAvg, loseAvg, true, k);
  const loseChange = calculateRatingChange(loseAvg, winAvg, false, k);

  const winners: TeamMemberResult[] = winnerSide.members.map((m) => ({
    userId: m.userId,
    before: m.rating,
    after: Math.max(RATING_FLOOR, m.rating + winChange.delta),
    delta: Math.max(RATING_FLOOR, m.rating + winChange.delta) - m.rating,
  }));
  const losers: TeamMemberResult[] = loserSide.members.map((m) => ({
    userId: m.userId,
    before: m.rating,
    after: Math.max(RATING_FLOOR, m.rating + loseChange.delta),
    delta: Math.max(RATING_FLOOR, m.rating + loseChange.delta) - m.rating,
  }));

  return { winners, losers };
}
