/* =============================================================
 * Servidor online · Protocolo WebSocket tipado (cliente ↔ servidor)
 * -------------------------------------------------------------
 * El cliente SÓLO envía intención de acción; el servidor es autoridad.
 * Las acciones se mapean a las Acciones del motor validado
 * (packages/game-rules) — no se inventan acciones que el motor no soporte.
 * El servidor nunca confía en seat/team/userId enviados por el cliente:
 * los resuelve desde la sesión + la partida.
 * ============================================================= */
import type { Card, Seat, TeamId } from '@truco/game-rules';
import type { Action } from '@truco/game-rules';
import { cardId } from '@truco/game-rules';

/** Acción que el cliente pide ejecutar. `cardId` = `${rank}-${suit}`. */
export type ClientAction =
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'CALL_ENVIDO' }
  | { type: 'CALL_REAL_ENVIDO' }
  | { type: 'CALL_FALTA_ENVIDO' }
  | { type: 'CALL_FLOR' }
  | { type: 'CALL_CONTRAFLOR' }
  | { type: 'CALL_CONTRAFLOR_RESTO' }
  | { type: 'CALL_TRUCO' }
  | { type: 'CALL_RETRUCO' }
  | { type: 'CALL_VALE_CUATRO' }
  | { type: 'ACCEPT' }
  | { type: 'DECLINE' }
  | { type: 'FOLD' }
  | { type: 'TOCA' }
  | { type: 'SELECT_TEAMMATE'; seat: Seat }
  | { type: 'VIEW_TEAMMATE_CARDS'; seat: Seat };

/** Mensajes que envía el servidor. El estado siempre va REDACTADO por asiento. */
export type ServerMessage =
  | { type: 'SNAPSHOT'; snapshot: unknown }
  | { type: 'ACTION_REJECTED'; reason: string }
  | { type: 'ERROR'; message: string }
  | { type: 'TEAMMATE_CARDS'; seat: Seat; cards: Card[]; ttlMs: number }
  | { type: 'JOINED'; matchId: string; seat: Seat; team: TeamId }
  | { type: 'PONG' };

/** Acciones que NO pasan por el reductor del motor (comunicación de equipo). */
export type MetaActionType = 'TOCA' | 'SELECT_TEAMMATE' | 'VIEW_TEAMMATE_CARDS';

/** ¿Es una meta-acción (no reglamentaria)? */
export function isMetaAction(a: ClientAction): boolean {
  return a.type === 'TOCA' || a.type === 'SELECT_TEAMMATE' || a.type === 'VIEW_TEAMMATE_CARDS';
}

/**
 * Traduce una ClientAction + asiento (resuelto por el servidor) a la Acción del
 * motor. Devuelve null si la acción no corresponde a una jugada reglamentaria
 * (p. ej. meta-acciones) o si la carta no está en la mano del jugador.
 */
export function toEngineAction(
  action: ClientAction,
  seat: Seat,
  hand: Card[],
): Action | null {
  switch (action.type) {
    case 'PLAY_CARD': {
      const card = hand.find((c) => cardId(c) === action.cardId);
      if (!card) return null; // carta inexistente o de otro jugador → rechazo
      return { type: 'PLAY_CARD', seat, card };
    }
    case 'CALL_ENVIDO':
      return { type: 'CALL_ENVIDO', seat, call: 'envido' };
    case 'CALL_REAL_ENVIDO':
      return { type: 'CALL_ENVIDO', seat, call: 'real_envido' };
    case 'CALL_FALTA_ENVIDO':
      return { type: 'CALL_ENVIDO', seat, call: 'falta_envido' };
    case 'CALL_FLOR':
      return { type: 'CALL_FLOR', seat, call: 'flor' };
    case 'CALL_CONTRAFLOR':
      return { type: 'CALL_FLOR', seat, call: 'contraflor_envido' };
    case 'CALL_CONTRAFLOR_RESTO':
      return { type: 'CALL_FLOR', seat, call: 'contraflor_resto' };
    case 'CALL_TRUCO':
      return { type: 'CALL_TRUCO', seat, call: 'truco' };
    case 'CALL_RETRUCO':
      return { type: 'CALL_TRUCO', seat, call: 'retruco' };
    case 'CALL_VALE_CUATRO':
      return { type: 'CALL_TRUCO', seat, call: 'vale4' };
    case 'ACCEPT':
      return { type: 'ACCEPT', seat };
    case 'DECLINE':
      return { type: 'DECLINE', seat };
    case 'FOLD':
      return { type: 'FOLD', seat };
    default:
      return null; // meta-acciones se manejan aparte
  }
}
