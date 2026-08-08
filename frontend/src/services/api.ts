/* =============================================================
 * Capa de servicios (fachada) — AHORA contra el backend real.
 * -------------------------------------------------------------
 * Ranking, amigos e historial salen de la API REST. La UI depende de estas
 * funciones, no de la fuente concreta. Si una llamada falla (p. ej. sin
 * sesión), se devuelve un valor vacío para que la página no rompa.
 * ============================================================= */
import type { Friend, MatchRecord, UserProfile, GameMode } from '@/types/domain';
import { apiFetch } from '@/api/client';
import { currentUser, type LeaderboardEntry } from './mockData';

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

interface RankingResp {
  ranking: {
    position: number;
    username: string;
    rating: number;
    rank: { id: string; name: string };
    wins: number;
    losses: number;
  }[];
}
interface FriendsResp {
  friends: { userId: string; username: string }[];
}
interface HistoryResp {
  history: {
    matchId: string;
    mode: string;
    won: boolean;
    ratingDelta: number | null;
    resolvedAt: string;
  }[];
}

export const api = {
  /** Identidad + stats. La identidad real la da useAuth; se conserva el perfil
   *  base que la UI espera (se puede enriquecer con /competitive/me). */
  getCurrentUser(): Promise<UserProfile> {
    return Promise.resolve(currentUser);
  },

  async getRecentMatches(): Promise<MatchRecord[]> {
    const r = await safe(apiFetch<HistoryResp>('/competitive/history'), { history: [] });
    return r.history.map((h) => ({
      id: h.matchId,
      mode: (h.mode as GameMode) ?? '1v1',
      result: h.won ? 'win' : 'loss',
      scoreSelf: 0,
      scoreRival: 0,
      opponent: '—',
      durationSec: 0,
      playedAt: h.resolvedAt,
    }));
  },

  async getFriends(): Promise<Friend[]> {
    const r = await safe(apiFetch<FriendsResp>('/friends'), { friends: [] });
    return r.friends.map((f) => ({
      id: f.userId,
      username: f.username,
      avatarUrl: null,
      online: false, // el estado en tiempo real es una etapa aparte
      inGame: false,
    }));
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const r = await safe(apiFetch<RankingResp>('/competitive/ranking'), { ranking: [] });
    return r.ranking.map((e) => ({
      position: e.position,
      username: e.username,
      rankId: e.rank.id,
      mmr: e.rating,
      winrate: e.wins + e.losses > 0 ? e.wins / (e.wins + e.losses) : 0,
    }));
  },
};

export type { LeaderboardEntry };
