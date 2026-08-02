/* =============================================================
 * Datos simulados (placeholder).
 * NO es backend real. Vive detrás de la capa `api` para poder
 * reemplazarse por llamadas HTTP/WebSocket sin tocar la UI.
 * ============================================================= */
import type { Friend, MatchRecord, UserProfile } from '@/types/domain';

export const currentUser: UserProfile = {
  id: 'u_local',
  username: 'lucas_uy',
  displayName: 'Lucas',
  avatarUrl: null,
  level: 12,
  xp: 640,
  xpToNext: 1000,
  rankId: 'copa',
  mmr: 1180,
  stats: {
    wins: 87,
    losses: 54,
    played: 141,
    winrate: 87 / 141,
    trucosWon: 210,
    trucosRejected: 38,
    envidosWon: 96,
    floresWon: 22,
    bestStreak: 9,
  },
};

export const recentMatches: MatchRecord[] = [
  {
    id: 'm1', mode: '1v1', result: 'win', scoreSelf: 40, scoreRival: 32,
    opponent: 'elpepe', durationSec: 720, playedAt: '2026-08-02T15:10:00Z',
  },
  {
    id: 'm2', mode: '2v2', result: 'loss', scoreSelf: 28, scoreRival: 40,
    opponent: 'Los Compadres', durationSec: 940, playedAt: '2026-08-01T22:40:00Z',
  },
  {
    id: 'm3', mode: '1v1', result: 'win', scoreSelf: 40, scoreRival: 18,
    opponent: 'marito', durationSec: 560, playedAt: '2026-08-01T20:05:00Z',
  },
  {
    id: 'm4', mode: '1v1', result: 'win', scoreSelf: 40, scoreRival: 37,
    opponent: 'la_flor', durationSec: 1010, playedAt: '2026-07-31T19:00:00Z',
  },
  {
    id: 'm5', mode: '2v2', result: 'loss', scoreSelf: 35, scoreRival: 40,
    opponent: 'Bastoneros', durationSec: 880, playedAt: '2026-07-30T23:15:00Z',
  },
];

export const friends: Friend[] = [
  { id: 'f1', username: 'elpepe', avatarUrl: null, online: true, inGame: false },
  { id: 'f2', username: 'marito', avatarUrl: null, online: true, inGame: true },
  { id: 'f3', username: 'la_flor', avatarUrl: null, online: false, inGame: false },
  { id: 'f4', username: 'don_mate', avatarUrl: null, online: true, inGame: false },
];

export interface LeaderboardEntry {
  position: number;
  username: string;
  rankId: string;
  mmr: number;
  winrate: number;
}

export const leaderboard: LeaderboardEntry[] = [
  { position: 1, username: 'ElTrucazo', rankId: 'vale4', mmr: 2410, winrate: 0.78 },
  { position: 2, username: 'DoñaFlor', rankId: 'vale4', mmr: 2360, winrate: 0.74 },
  { position: 3, username: 'RetrucoKing', rankId: 'retruco', mmr: 2150, winrate: 0.71 },
  { position: 4, username: 'PiezaViva', rankId: 'retruco', mmr: 2040, winrate: 0.69 },
  { position: 5, username: 'ManoDura', rankId: 'truco', mmr: 1880, winrate: 0.66 },
  { position: 6, username: 'EnvidoSon33', rankId: 'truco', mmr: 1760, winrate: 0.63 },
  { position: 7, username: 'lucas_uy', rankId: 'copa', mmr: 1180, winrate: 0.62 },
];
