/* =============================================================
 * Tipos de dominio de la plataforma (usuario, partidas, ranking).
 * Separados del motor de reglas del juego.
 * ============================================================= */
import type { GameMode } from '@/game';

export interface RankTier {
  id: string;
  name: string;
  order: number;
  color: string;
  /** MMR mínimo (preparado para el sistema competitivo futuro). */
  minMmr: number;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  xpToNext: number;
  rankId: string;
  mmr: number;
  stats: UserStats;
}

export interface UserStats {
  wins: number;
  losses: number;
  played: number;
  winrate: number; // 0..1
  trucosWon: number;
  trucosRejected: number;
  envidosWon: number;
  floresWon: number;
  bestStreak: number;
}

export type MatchResult = 'win' | 'loss';

export interface MatchRecord {
  id: string;
  mode: GameMode;
  result: MatchResult;
  scoreSelf: number;
  scoreRival: number;
  opponent: string;
  durationSec: number;
  playedAt: string; // ISO
}

export interface Friend {
  id: string;
  username: string;
  avatarUrl: string | null;
  online: boolean;
  inGame: boolean;
}
