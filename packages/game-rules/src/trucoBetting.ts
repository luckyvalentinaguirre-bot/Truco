/* =============================================================
 * TRUCO ENGINE · Cadena de apuestas del Truco
 * -------------------------------------------------------------
 * Máquina de estados pura: none → truco → retruco → vale4.
 * Valida quién puede subir (alternancia entre equipos) y resuelve
 * los puntos según se acepte (querer) o rechace (no querer).
 * ============================================================= */
import type { TeamId, TrucoCall } from './types.js';
import { TRUCO_ESCALATION, TRUCO_VALUES } from './ruleset.js';

export type TrucoLevel = 'none' | TrucoCall;

export interface TrucoState {
  /** Nivel actualmente cantado (aceptado o pendiente). */
  level: TrucoLevel;
  /** Nivel ya aceptado por ambos (puntos en juego si se gana la mano). */
  acceptedLevel: TrucoLevel;
  /** ¿Hay un canto esperando respuesta? */
  pending: boolean;
  /** Equipo que hizo el último canto (el que debe responder es el otro). */
  callerTeam: TeamId | null;
  /** Si la mano ya se cerró por un "no quiero". */
  declinedBy: TeamId | null;
}

export function initTrucoState(): TrucoState {
  return {
    level: 'none',
    acceptedLevel: 'none',
    pending: false,
    callerTeam: null,
    declinedBy: null,
  };
}

/** Puntos en juego si la mano se juega con el nivel aceptado. */
export function trucoPointsAtStake(state: TrucoState): number {
  if (state.acceptedLevel === 'none') return 1;
  return TRUCO_VALUES[state.acceptedLevel].accepted;
}

const ORDER: TrucoLevel[] = ['none', 'truco', 'retruco', 'vale4'];

/** Próximo nivel que un equipo puede cantar (o null si no hay). */
function nextLevel(level: TrucoLevel): TrucoCall | null {
  if (level === 'none') return 'truco';
  return TRUCO_ESCALATION[level];
}

/**
 * ¿Puede `team` cantar `call` ahora?
 *  - Si no hay canto pendiente: sólo el próximo nivel de la escalera, y no
 *    puede cantar el mismo equipo que ya tiene el nivel aceptado a su favor
 *    (debe ser el rival quien sube, salvo el primer Truco).
 *  - Si hay canto pendiente: sólo el equipo que debe responder puede subir
 *    (contra-cantar) al nivel siguiente.
 */
export function canCallTruco(
  state: TrucoState,
  team: TeamId,
  call: TrucoCall,
): boolean {
  if (state.declinedBy) return false;
  const expected = nextLevel(state.level);
  if (expected !== call) return false;

  if (state.pending) {
    // Contra-canto: sólo responde el rival del que cantó.
    return state.callerTeam !== null && team !== state.callerTeam;
  }

  // Sin canto pendiente. El primer Truco lo puede cantar cualquiera.
  if (state.acceptedLevel === 'none') return true;
  // Para subir, debe hacerlo el equipo distinto al último que cantó/aceptó.
  return team !== state.callerTeam;
}

export function callTruco(
  state: TrucoState,
  team: TeamId,
  call: TrucoCall,
): TrucoState {
  if (!canCallTruco(state, team, call)) {
    throw new Error(`Canto de Truco inválido: ${call} por equipo ${team}`);
  }
  return { ...state, level: call, pending: true, callerTeam: team };
}

/**
 * El rival acepta ("quiero"): el nivel pasa a estar en juego.
 * `callerTeam` se conserva (el que aceptó = rival del cantor) para que la
 * alternancia siga funcionando: sólo el rival del último cantor puede subir.
 */
export function acceptTruco(state: TrucoState, team: TeamId): TrucoState {
  if (!state.pending || state.callerTeam === team) {
    throw new Error('No hay Truco pendiente para aceptar por este equipo');
  }
  return { ...state, pending: false, acceptedLevel: state.level };
}

export interface TrucoDeclineResult {
  state: TrucoState;
  /** Equipo que se lleva los puntos por el rechazo. */
  winner: TeamId;
  points: number;
}

/**
 * El rival rechaza ("no quiero"): la mano termina. El que cantó gana los
 * puntos "rechazado" del nivel cantado.
 */
export function declineTruco(state: TrucoState, team: TeamId): TrucoDeclineResult {
  if (!state.pending || state.callerTeam === team) {
    throw new Error('No hay Truco pendiente para rechazar por este equipo');
  }
  const level = state.level as TrucoCall;
  const points = TRUCO_VALUES[level].declined;
  return {
    state: { ...state, pending: false, declinedBy: team },
    winner: state.callerTeam!,
    points,
  };
}

export { ORDER as TRUCO_LEVEL_ORDER };
