/* =============================================================
 * Capa de servicios (fachada).
 * -------------------------------------------------------------
 * Hoy devuelve datos simulados. Mañana, la MISMA firma llamará
 * a la API REST y a los WebSockets del backend. La UI depende
 * de estas funciones, no de la fuente de datos concreta.
 * ============================================================= */
import type { Friend, MatchRecord, UserProfile } from '@/types/domain';
import {
  currentUser,
  friends,
  leaderboard,
  recentMatches,
  type LeaderboardEntry,
} from './mockData';

/** Simula latencia de red para que la UI contemple estados de carga. */
function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const api = {
  getCurrentUser(): Promise<UserProfile> {
    return delay(currentUser);
  },
  getRecentMatches(): Promise<MatchRecord[]> {
    return delay(recentMatches);
  },
  getFriends(): Promise<Friend[]> {
    return delay(friends);
  },
  getLeaderboard(): Promise<LeaderboardEntry[]> {
    return delay(leaderboard);
  },
};

export type { LeaderboardEntry };
