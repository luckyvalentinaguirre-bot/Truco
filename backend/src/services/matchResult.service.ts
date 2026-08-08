/* =============================================================
 * Backend · Registro del resultado competitivo de una partida
 * -------------------------------------------------------------
 * Autoridad del servidor: al terminar una partida ranked, lee los ratings
 * actuales, calcula el nuevo ELO con el dominio (resolveMatchRatings) y lo
 * persiste (partida + jugadores + ratings) en una transacción. El cliente
 * nunca envía ELO ni ganador.
 * ============================================================= */
import { getActiveSeason } from '../repositories/seasons.repository.js';
import { getRating } from '../repositories/ratings.repository.js';
import {
  recordRankedResult,
  type Mode,
  type PlayerResult,
} from '../repositories/matches.repository.js';
import { resolveMatchRatings, DEFAULT_RATING, RATING_FLOOR, type Side } from '../competitive/elo.js';

/** Penalización extra de ELO para quien ABANDONA (además de perder la partida). */
export const ABANDON_EXTRA_PENALTY = 15;
/** Pérdida (chica y fija) para los COMPAÑEROS de quien abandonó, en modo equipo. */
export const TEAMMATE_ABANDON_LOSS = 5;

export interface FinishedPlayer {
  userId: string;
  team: 0 | 1;
  abandoned?: boolean;
}

export interface FinishedMatch {
  mode: Mode;
  winnerTeam: 0 | 1;
  players: FinishedPlayer[];
}

export interface RecordOutcome {
  recorded: boolean;
  reason?: string;
  matchId?: string;
  /** ELO por jugador (para la pantalla post-partida). */
  results?: { userId: string; before: number; after: number; delta: number }[];
}

/**
 * Registra el resultado de una partida clasificatoria terminada. Devuelve el
 * detalle de ELO por jugador. No graba si no hay temporada activa o si faltan
 * jugadores humanos (bots no puntúan).
 */
export async function recordCompetitiveResult(match: FinishedMatch): Promise<RecordOutcome> {
  const humans = match.players.filter((p) => !p.userId.startsWith('bot:'));
  if (humans.length < 2) return { recorded: false, reason: 'no_ranked_players' };

  const season = await getActiveSeason();
  if (!season) return { recorded: false, reason: 'no_active_season' };

  // Rating actual de cada jugador (default si nunca jugó esta temporada).
  const current = new Map<string, number>();
  for (const p of humans) {
    const r = await getRating(p.userId, season.id);
    current.set(p.userId, r?.rating ?? DEFAULT_RATING);
  }

  const winners = humans.filter((p) => p.team === match.winnerTeam);
  const losers = humans.filter((p) => p.team !== match.winnerTeam);
  const side = (ps: FinishedPlayer[]): Side => ({
    members: ps.map((p) => ({ userId: p.userId, rating: current.get(p.userId)! })),
  });

  const res = resolveMatchRatings(side(winners), side(losers));
  const byUser = new Map<string, { before: number; after: number; delta: number }>();
  for (const w of res.winners) byUser.set(w.userId, w);
  for (const l of res.losers) byUser.set(l.userId, l);

  // Penalización por abandono: el que abandona pierde EXTRA; en modo equipo, sus
  // compañeros pierden poco (pérdida fija chica). Los ganadores no se tocan.
  const losersAbandoned = losers.some((p) => p.abandoned);
  const players: PlayerResult[] = humans.map((p) => {
    const c = byUser.get(p.userId)!;
    const isLoser = p.team !== match.winnerTeam;
    let after = c.after;
    if (isLoser && p.abandoned) {
      after = c.after - ABANDON_EXTRA_PENALTY; // abandonador: pierde de más
    } else if (isLoser && losersAbandoned) {
      after = c.before - TEAMMATE_ABANDON_LOSS; // compañero del abandonador: pierde poco
    }
    after = Math.max(RATING_FLOOR, after);
    return {
      userId: p.userId,
      team: p.team,
      ratingBefore: c.before,
      ratingAfter: after,
      abandoned: p.abandoned,
    };
  });

  const matchId = await recordRankedResult({
    seasonId: season.id,
    mode: match.mode,
    winnerTeam: match.winnerTeam,
    players,
  });

  return {
    recorded: true,
    matchId,
    results: players.map((p) => ({
      userId: p.userId,
      before: p.ratingBefore,
      after: p.ratingAfter,
      delta: p.ratingAfter - p.ratingBefore,
    })),
  };
}
