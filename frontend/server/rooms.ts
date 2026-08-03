/* =============================================================
 * TRUCO · Salas LAN (lógica pura, sin transporte)
 * -------------------------------------------------------------
 * Reutiliza el MISMO Rules Engine que el cliente. El servidor es
 * la autoridad: valida que cada jugador sólo actúe por su asiento.
 * Sin `ws` acá para poder testear la lógica de salas aislada.
 * ============================================================= */
import {
  createMatch,
  applyAction,
  startNextHand,
  type Action,
  type GameEvent,
  type GameMode,
  type MatchState,
  type Seat,
} from '../src/game';

export const SEATS_FOR_MODE: Record<GameMode, number> = {
  '1v1': 2,
  '2v2': 4,
  '3v3': 6,
  '3players': 3,
};

/** Sala genérica sobre un tipo de conexión `C` (WebSocket en producción). */
export interface Room<C> {
  code: string;
  mode: GameMode;
  /** Conexión por asiento (index = seat). null = asiento libre. */
  conns: (C | null)[];
  names: string[];
  state: MatchState | null;
  seed: number;
}

export function neededSeats(mode: GameMode): number {
  return SEATS_FOR_MODE[mode];
}

export function createRoom<C>(code: string, mode: GameMode, seed: number): Room<C> {
  const n = neededSeats(mode);
  return {
    code,
    mode,
    conns: Array.from({ length: n }, () => null),
    names: Array.from({ length: n }, () => ''),
    state: null,
    seed,
  };
}

export function filledSeats<C>(room: Room<C>): number {
  return room.conns.filter((c) => c !== null).length;
}

export function isFull<C>(room: Room<C>): boolean {
  return filledSeats(room) === neededSeats(room.mode);
}

/** Sienta a un jugador en el primer asiento libre. Devuelve el asiento o -1. */
export function addPlayer<C>(room: Room<C>, conn: C, name: string): Seat {
  const seat = room.conns.findIndex((c) => c === null);
  if (seat === -1) return -1;
  room.conns[seat] = conn;
  room.names[seat] = name || `Jugador ${seat + 1}`;
  return seat;
}

/** Libera el asiento de una conexión (al desconectarse). Devuelve el asiento o -1. */
export function removePlayer<C>(room: Room<C>, conn: C): Seat {
  const seat = room.conns.findIndex((c) => c === conn);
  if (seat === -1) return -1;
  room.conns[seat] = null;
  return seat;
}

/** Si la sala está llena y no empezó, reparte la primera mano. */
export function startIfReady<C>(room: Room<C>): boolean {
  if (isFull(room) && !room.state) {
    room.state = createMatch({ mode: room.mode, seed: room.seed });
    return true;
  }
  return false;
}

/**
 * Aplica una acción EN NOMBRE de `seat`. Rechaza si el jugador intenta actuar
 * por otro asiento (autoridad del servidor). Devuelve los eventos emitidos.
 */
export function applyForSeat<C>(
  room: Room<C>,
  seat: Seat,
  action: Action,
): GameEvent[] {
  if (!room.state) throw new Error('La partida todavía no empezó');
  if (action.seat !== seat) {
    throw new Error('No podés jugar por otro asiento');
  }
  const { state, events } = applyAction(room.state, action);
  room.state = state;
  return events;
}

/** Reparte la próxima mano si la actual terminó (la llama el servidor tras un delay). */
export function dealNextHand<C>(room: Room<C>): boolean {
  if (room.state && room.state.phase === 'playing' && room.state.hand.finished) {
    room.state = startNextHand(room.state);
    return true;
  }
  return false;
}
