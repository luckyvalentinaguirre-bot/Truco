/* =============================================================
 * TRUCO · Protocolo de red (LAN / online)
 * -------------------------------------------------------------
 * Mensajes JSON entre cliente y servidor. Ambos comparten este
 * archivo. El servidor es la AUTORIDAD: valida cada Action con el
 * Rules Engine y difunde el estado resultante.
 *   Imports RELATIVOS a ../game para que funcione también en Node
 *   (el servidor no resuelve el alias "@/").
 * ============================================================= */
import type { Action, GameEvent, GameMode, MatchState, Seat } from '../game';

/** Puerto por defecto del servidor LAN. */
export const DEFAULT_LAN_PORT = 8787;

/** Mensajes que envía el CLIENTE al servidor. */
export type ClientMsg =
  | { t: 'create'; mode: GameMode; name: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'action'; action: Action }
  | { t: 'restart' };

/** Info de la sala mientras se espera que se llene. */
export interface LobbyInfo {
  code: string;
  mode: GameMode;
  filled: number;
  needed: number;
  names: string[];
}

/** Mensajes que envía el SERVIDOR al cliente. */
export type ServerMsg =
  | { t: 'joined'; code: string; seat: Seat; mode: GameMode }
  | { t: 'lobby'; info: LobbyInfo }
  | { t: 'state'; state: MatchState; events: GameEvent[]; yourSeat: Seat }
  | { t: 'error'; msg: string };
