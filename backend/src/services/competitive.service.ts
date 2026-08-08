/* =============================================================
 * Backend · Servicio competitivo (une dominio + persistencia)
 * -------------------------------------------------------------
 * El servidor es la autoridad: el rango se deriva del ELO, el acceso se deriva
 * de la suscripción, el ranking sale de la base. El cliente nunca los decide.
 * ============================================================= */
import { getActiveSeason, type SeasonRow } from '../repositories/seasons.repository.js';
import { getRating, leaderboard } from '../repositories/ratings.repository.js';
import { getSubscription } from '../repositories/subscriptions.repository.js';
import { rankByRating } from '../competitive/ranks.js';
import { DEFAULT_RATING } from '../competitive/elo.js';
import {
  deriveAccess,
  type SubscriptionRecord,
} from '../competitive/subscription.js';
import { canPlayCompetitive, type Eligibility } from '../competitive/eligibility.js';

/** Convierte la fila de suscripción al registro que entiende el dominio. */
function toRecord(sub: Awaited<ReturnType<typeof getSubscription>>): SubscriptionRecord | null {
  if (!sub) return null;
  return {
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() : null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

export interface CompetitiveStatus {
  season: { id: string; name: string; endsAt: string } | null;
  rating: number;
  rank: { id: string; name: string };
  wins: number;
  losses: number;
  access: string;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  eligibility: Eligibility;
}

/** Estado competitivo del usuario autenticado (rating, rango, acceso). */
export async function getCompetitiveStatus(
  userId: string,
  banned = false,
): Promise<CompetitiveStatus> {
  const season = await getActiveSeason();
  const sub = await getSubscription(userId);
  const record = toRecord(sub);

  let rating = DEFAULT_RATING;
  let wins = 0;
  let losses = 0;
  if (season) {
    const r = await getRating(userId, season.id);
    if (r) {
      rating = r.rating;
      wins = r.wins;
      losses = r.losses;
    }
  }

  const access = deriveAccess(record);
  const eligibility = canPlayCompetitive({ authenticated: true, banned, subscription: record });
  const tier = rankByRating(rating);

  return {
    season: season ? { id: season.id, name: season.name, endsAt: season.endsAt.toISOString() } : null,
    rating,
    rank: { id: tier.id, name: tier.name },
    wins,
    losses,
    access,
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : null,
    eligibility,
  };
}

export interface RankingRow {
  position: number;
  username: string;
  rating: number;
  rank: { id: string; name: string };
  wins: number;
  losses: number;
}

/** Ranking de la temporada activa (o vacío si no hay temporada). */
export async function getRanking(limit = 50): Promise<{ season: SeasonRow | null; rows: RankingRow[] }> {
  const season = await getActiveSeason();
  if (!season) return { season: null, rows: [] };
  const rows = await leaderboard(season.id, limit);
  return {
    season,
    rows: rows.map((e) => {
      const tier = rankByRating(e.rating);
      return {
        position: e.position,
        username: e.username,
        rating: e.rating,
        rank: { id: tier.id, name: tier.name },
        wins: e.wins,
        losses: e.losses,
      };
    }),
  };
}
