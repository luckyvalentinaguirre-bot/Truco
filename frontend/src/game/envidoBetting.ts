/* =============================================================
 * TRUCO ENGINE · Cadena de apuestas del Envido
 * -------------------------------------------------------------
 * Modela Envido, Real Envido, Falta Envido y sus revoques
 * (Envido + Envido = 4, Envido + Real Envido = 5, …). Los cantos
 * se acumulan en una cadena; aceptar el último implica jugar por
 * la suma de todos. Puro y testeable.
 * ============================================================= */
import type { EnvidoCall, TeamId } from './types';
import { ENVIDO_BASE_POINTS, faltaEnvidoPoints } from './envido';

export interface EnvidoState {
  /** Cadena completa de cantos anunciados. */
  calls: EnvidoCall[];
  /** ¿El último canto de la cadena está pendiente de respuesta? */
  pending: boolean;
  /** Equipo del último canto. */
  callerTeam: TeamId | null;
  resolved: boolean;
  declinedBy: TeamId | null;
}

export interface Scoreboard {
  A: number;
  B: number;
}

export function initEnvidoState(): EnvidoState {
  return {
    calls: [],
    pending: false,
    callerTeam: null,
    resolved: false,
    declinedBy: null,
  };
}

/** Valor puntual de un canto según el marcador (para Falta). */
export function envidoCallValue(
  call: EnvidoCall,
  scores: Scoreboard,
  targetPoints: number,
): number {
  if (call === 'falta_envido') {
    return faltaEnvidoPoints(scores.A, scores.B, targetPoints);
  }
  return ENVIDO_BASE_POINTS[call];
}

function sumCalls(
  calls: EnvidoCall[],
  scores: Scoreboard,
  targetPoints: number,
): number {
  return calls.reduce((sum, c) => sum + envidoCallValue(c, scores, targetPoints), 0);
}

/** Puntos totales de la cadena aceptada (showdown de tantos). */
export function envidoPointsAtStake(
  state: EnvidoState,
  scores: Scoreboard,
  targetPoints: number,
): number {
  return sumCalls(state.calls, scores, targetPoints);
}

/** Escalada válida de cantos de envido. */
const CAN_FOLLOW: Record<EnvidoCall, EnvidoCall[]> = {
  envido: ['envido', 'real_envido', 'falta_envido'],
  real_envido: ['falta_envido'],
  falta_envido: [],
};

/** ¿Puede `team` cantar `call` ahora? */
export function canCallEnvido(
  state: EnvidoState,
  team: TeamId,
  call: EnvidoCall,
): boolean {
  if (state.resolved || state.declinedBy) return false;

  const last = state.calls[state.calls.length - 1];

  if (state.calls.length === 0) {
    // Apertura: cualquier canto inicia la cadena.
    return true;
  }

  // Revoque / suba: sólo el rival del último cantor, con un canto que siga.
  if (state.callerTeam === team) return false;
  return CAN_FOLLOW[last].includes(call);
}

export function callEnvido(
  state: EnvidoState,
  team: TeamId,
  call: EnvidoCall,
): EnvidoState {
  if (!canCallEnvido(state, team, call)) {
    throw new Error(`Canto de Envido inválido: ${call} por equipo ${team}`);
  }
  return {
    ...state,
    calls: [...state.calls, call],
    pending: true,
    callerTeam: team,
  };
}

export function acceptEnvido(state: EnvidoState, team: TeamId): EnvidoState {
  if (!state.pending || state.callerTeam === team) {
    throw new Error('No hay Envido pendiente para aceptar por este equipo');
  }
  // Al querer, el Envido queda RESUELTO: ya no se puede volver a cantar.
  return { ...state, pending: false, resolved: true };
}

export interface EnvidoDeclineResult {
  state: EnvidoState;
  winner: TeamId;
  points: number;
}

/**
 * "No quiero": el que cantó el último canto gana los puntos que ya estaban
 * en juego (la cadena SIN el canto rechazado), o 1 si se rechaza el primero.
 */
export function declineEnvido(
  state: EnvidoState,
  team: TeamId,
  scores: Scoreboard,
  targetPoints: number,
): EnvidoDeclineResult {
  if (!state.pending || state.callerTeam === team) {
    throw new Error('No hay Envido pendiente para rechazar por este equipo');
  }
  const prior = state.calls.slice(0, -1);
  const priorPoints = sumCalls(prior, scores, targetPoints);
  const points = priorPoints > 0 ? priorPoints : 1;
  return {
    state: { ...state, pending: false, resolved: true, declinedBy: team },
    winner: state.callerTeam!,
    points,
  };
}
