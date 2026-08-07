/* =============================================================
 * TRUCO ENGINE · Eventos (qué ocurrió)
 * -------------------------------------------------------------
 * El motor devuelve una lista de eventos por cada acción aplicada.
 * La UI (y en el futuro el cliente de red) los usa para animar y
 * mostrar mensajes. Los eventos son un registro, no deciden nada.
 * ============================================================= */
import type { Card, EnvidoCall, FlorCall, Seat, TeamId, TrickOutcome, TrucoCall } from './types.js';

export type GameEvent =
  | { type: 'CARD_PLAYED'; seat: Seat; card: Card }
  | { type: 'TRICK_RESOLVED'; index: number; outcome: TrickOutcome; winnerSeat: Seat | null }
  | { type: 'TRUCO_CALLED'; seat: Seat; call: TrucoCall }
  | { type: 'ENVIDO_CALLED'; seat: Seat; call: EnvidoCall }
  | { type: 'FLOR_DECLARED'; seat: Seat; team: TeamId }
  | { type: 'FLOR_CONTRA_CALLED'; seat: Seat; call: FlorCall }
  | { type: 'CALL_ACCEPTED'; seat: Seat }
  | { type: 'CALL_DECLINED'; seat: Seat }
  | { type: 'ENVIDO_RESOLVED'; winner: TeamId; points: number }
  | { type: 'FLOR_RESOLVED'; winner: TeamId; points: number }
  | { type: 'PLAYER_FOLDED'; seat: Seat }
  | { type: 'POINTS_AWARDED'; team: TeamId; points: number; reason: string }
  | { type: 'HAND_ENDED'; winner: TeamId | null }
  | { type: 'GAME_OVER'; winner: TeamId };

/** Resultado de aplicar una acción: nuevo estado + eventos emitidos. */
export interface Applied<TState> {
  state: TState;
  events: GameEvent[];
}
