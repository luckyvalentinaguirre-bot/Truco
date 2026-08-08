/* =============================================================
 * Backend · Repository de partidas clasificatorias
 * (tablas `competitive_matches` + `competitive_match_players`)
 * -------------------------------------------------------------
 * Persiste el resultado de una partida ranked de forma CONSISTENTE (§19): la
 * partida, sus jugadores (ELO antes/después) y la actualización de ratings van
 * en UNA transacción. El ELO ya lo calculó el dominio (elo.ts); acá sólo se
 * guarda. Idempotente por partida (no se puede resolver dos veces).
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { query, withTransaction } from '../db/pool.js';
import { ensureRating } from './ratings.repository.js';

export type Mode = '1v1' | '2v2' | '3v3';

export interface PlayerResult {
  userId: string;
  team: 0 | 1;
  ratingBefore: number;
  ratingAfter: number;
  abandoned?: boolean;
}

export interface RecordRankedInput {
  seasonId: string;
  mode: Mode;
  winnerTeam: 0 | 1;
  players: PlayerResult[];
}

interface MatchRow extends QueryResultRow {
  id: string;
}

/**
 * Registra una partida clasificatoria resuelta y actualiza los ratings de sus
 * jugadores, TODO en una transacción. Devuelve el id de la partida.
 */
export async function recordRankedResult(input: RecordRankedInput): Promise<string> {
  return withTransaction(async (tx) => {
    const m = await tx.query<MatchRow>(
      `INSERT INTO competitive_matches (season_id, mode, ranked, status, winner_team, resolved_at)
         VALUES ($1, $2, TRUE, 'resolved', $3, now())
       RETURNING id`,
      [input.seasonId, input.mode, input.winnerTeam],
    );
    const matchId = m.rows[0]!.id;

    for (const p of input.players) {
      const delta = p.ratingAfter - p.ratingBefore;
      const won = p.team === input.winnerTeam;

      await tx.query(
        `INSERT INTO competitive_match_players
            (match_id, user_id, team, rating_before, rating_after, rating_delta, abandoned)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [matchId, p.userId, p.team, p.ratingBefore, p.ratingAfter, delta, p.abandoned ?? false],
      );

      await ensureRating(p.userId, input.seasonId, tx);
      await tx.query(
        `UPDATE competitive_ratings SET
            rating = $3,
            best_rating = GREATEST(best_rating, $3),
            wins = wins + $4,
            losses = losses + $5,
            streak = CASE WHEN $6 THEN GREATEST(streak, 0) + 1 ELSE LEAST(streak, 0) - 1 END,
            updated_at = now()
          WHERE user_id = $1 AND season_id = $2`,
        [p.userId, input.seasonId, p.ratingAfter, won ? 1 : 0, won ? 0 : 1, won],
      );
    }
    return matchId;
  });
}

/** Historial competitivo de un usuario (partidas con su ELO antes/después). */
export interface HistoryEntry {
  matchId: string;
  mode: Mode;
  team: number;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  won: boolean;
  resolvedAt: Date;
}

export async function getUserHistory(userId: string, limit = 30): Promise<HistoryEntry[]> {
  const res = await query<QueryResultRow>(
    `SELECT m.id AS match_id, m.mode, m.winner_team, m.resolved_at,
            mp.team, mp.rating_before, mp.rating_after, mp.rating_delta
       FROM competitive_match_players mp
       JOIN competitive_matches m ON m.id = mp.match_id
      WHERE mp.user_id = $1 AND m.status = 'resolved'
      ORDER BY m.resolved_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return res.rows.map((r) => ({
    matchId: r.match_id as string,
    mode: r.mode as Mode,
    team: r.team as number,
    ratingBefore: r.rating_before as number | null,
    ratingAfter: r.rating_after as number | null,
    ratingDelta: r.rating_delta as number | null,
    won: (r.team as number) === (r.winner_team as number),
    resolvedAt: r.resolved_at as Date,
  }));
}
