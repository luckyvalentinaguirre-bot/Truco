/* =============================================================
 * Backend · Repository de rating competitivo (tabla `competitive_ratings`)
 * -------------------------------------------------------------
 * Rating por (usuario, temporada). Queries parametrizadas. La fórmula de ELO
 * vive en el dominio (competitive/elo.ts); acá sólo se persiste el resultado.
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { query, getPool, withTransaction, type Executor } from '../db/pool.js';
import { DEFAULT_RATING } from '../competitive/elo.js';

export interface Rating {
  userId: string;
  seasonId: string;
  rating: number;
  wins: number;
  losses: number;
  bestRating: number;
  streak: number;
}

export interface LeaderboardEntry extends Rating {
  username: string;
  position: number;
}

interface Row extends QueryResultRow {
  user_id: string;
  season_id: string;
  rating: number;
  wins: number;
  losses: number;
  best_rating: number;
  streak: number;
}

const COLUMNS = 'user_id, season_id, rating, wins, losses, best_rating, streak';

function map(r: Row): Rating {
  return {
    userId: r.user_id,
    seasonId: r.season_id,
    rating: r.rating,
    wins: r.wins,
    losses: r.losses,
    bestRating: r.best_rating,
    streak: r.streak,
  };
}

/** Rating de un usuario en una temporada, o null si aún no jugó. */
export async function getRating(
  userId: string,
  seasonId: string,
  exec: Executor = getPool(),
): Promise<Rating | null> {
  const res = await exec.query<Row>(
    `SELECT ${COLUMNS} FROM competitive_ratings WHERE user_id = $1 AND season_id = $2`,
    [userId, seasonId],
  );
  return res.rows[0] ? map(res.rows[0]) : null;
}

/** Crea (si no existe) el rating inicial de un usuario en la temporada. */
export async function ensureRating(
  userId: string,
  seasonId: string,
  exec: Executor = getPool(),
): Promise<Rating> {
  const res = await exec.query<Row>(
    `INSERT INTO competitive_ratings (user_id, season_id, rating, best_rating)
       VALUES ($1, $2, $3, $3)
     ON CONFLICT (user_id, season_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING ${COLUMNS}`,
    [userId, seasonId, DEFAULT_RATING],
  );
  return map(res.rows[0]!);
}

export interface RatingUpdate {
  userId: string;
  newRating: number;
  won: boolean;
}

/**
 * Aplica el resultado de una partida clasificatoria a varios jugadores en UNA
 * transacción (consistencia: rating + wins/losses + best + streak juntos).
 * El `newRating` ya lo calculó el dominio (elo.ts); acá sólo se persiste.
 */
export async function applyMatchResult(
  seasonId: string,
  updates: RatingUpdate[],
): Promise<void> {
  await withTransaction(async (tx) => {
    for (const u of updates) {
      await ensureRating(u.userId, seasonId, tx);
      await tx.query(
        `UPDATE competitive_ratings SET
            rating = $3,
            best_rating = GREATEST(best_rating, $3),
            wins = wins + $4,
            losses = losses + $5,
            streak = CASE WHEN $6 THEN GREATEST(streak, 0) + 1 ELSE LEAST(streak, 0) - 1 END,
            updated_at = now()
          WHERE user_id = $1 AND season_id = $2`,
        [u.userId, seasonId, u.newRating, u.won ? 1 : 0, u.won ? 0 : 1, u.won],
      );
    }
  });
}

/** Ranking de una temporada (mayor rating primero). */
export async function leaderboard(
  seasonId: string,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const res = await query<Row & { username: string }>(
    `SELECT r.user_id, r.season_id, r.rating, r.wins, r.losses,
            r.best_rating, r.streak, p.username
       FROM competitive_ratings r
       JOIN profiles p ON p.user_id = r.user_id
      WHERE r.season_id = $1
      ORDER BY r.rating DESC, r.wins DESC
      LIMIT $2`,
    [seasonId, limit],
  );
  return res.rows.map((r, i) => ({ ...map(r), username: r.username, position: i + 1 }));
}
