/* =============================================================
 * TRUCO ENGINE · Acciones (intención del jugador)
 * -------------------------------------------------------------
 * El cliente envía Acciones; el motor decide si son válidas y
 * produce el nuevo estado + eventos. En multiplayer, el servidor
 * será quien aplique estas acciones (autoridad).
 * ============================================================= */
import type { Card, EnvidoCall, FlorCall, Seat, TrucoCall } from './types.js';
import type { PerrosResponse } from './florBetting.js';

export type Action =
  | { type: 'PLAY_CARD'; seat: Seat; card: Card }
  | { type: 'CALL_TRUCO'; seat: Seat; call: TrucoCall }
  | { type: 'CALL_ENVIDO'; seat: Seat; call: EnvidoCall }
  /** Declarar Flor (call omitido/'flor') o subir a Contraflor al resto. */
  | { type: 'CALL_FLOR'; seat: Seat; call?: FlorCall }
  | { type: 'ACCEPT'; seat: Seat }
  | { type: 'DECLINE'; seat: Seat }
  | { type: 'FOLD'; seat: Seat } // irse al mazo
  | { type: 'DECLARE_PERROS'; seat: Seat; response: PerrosResponse };

export type ActionType = Action['type'];
