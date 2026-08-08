/* Cliente de matchmaking y partidas (endpoints reales). */
import { apiFetch, API_URL } from './client';
import type { GameMode } from '@/game';

export type MatchmakingStatus =
  | { status: 'idle' }
  | { status: 'queued'; mode: GameMode; inQueue?: number; need?: number }
  | { status: 'matched'; matchId: string; seat: number; mode: GameMode };

export const joinMatchmaking = (mode: GameMode) =>
  apiFetch<MatchmakingStatus>('/matchmaking/join', { method: 'POST', body: { mode } });
export const matchmakingStatus = () => apiFetch<MatchmakingStatus>('/matchmaking/status');
export const leaveMatchmaking = () => apiFetch('/matchmaking/leave', { method: 'POST' });

/** Partida de práctica contra bots (para probar el online sin oponentes). */
export const createPractice = (mode: GameMode, picoAPico = false) =>
  apiFetch<{ matchId: string; seat: number; mode: GameMode }>('/match/practice', {
    method: 'POST',
    body: { mode, picoAPico },
  });

/** URL del WebSocket de partidas (deriva de la API: http→ws, https→wss). */
export function wsUrl(): string {
  const base = API_URL.replace(/^http/, 'ws');
  return `${base}/ws`;
}
