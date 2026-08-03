/* =============================================================
 * TRUCO ENGINE · Apuestas de Flor
 * -------------------------------------------------------------
 * Estructura para Flor, Con Flor Envido y Contra Flor al Resto,
 * más los estados de "echar los perros" (en ley / a punto).
 * La resolución completa enfrentada se ampliará; la base (Flor = 3)
 * y la representación del estado ya están cubiertas.
 * ============================================================= */
import type { FlorCall, TeamId } from './types';
import { FLOR_BASE_POINTS } from './flor';

/** Respuesta a "echar los perros": si el rival tiene Flor o no. */
export type PerrosResponse = 'en_ley' | 'a_punto';

export interface FlorState {
  /** Equipos que cantaron Flor (tienen flor declarada). */
  declaredBy: TeamId[];
  /** Canto de flor en curso (si escaló a contraflor). */
  call: FlorCall;
  pendingCall: FlorCall | null;
  callerTeam: TeamId | null;
  resolved: boolean;
  /** Respuesta al "echar los perros", si aplica. */
  perros: PerrosResponse | null;
}

export function initFlorState(): FlorState {
  return {
    declaredBy: [],
    call: 'flor',
    pendingCall: null,
    callerTeam: null,
    resolved: false,
    perros: null,
  };
}

/** Registra que un equipo cantó Flor. */
export function declareFlor(state: FlorState, team: TeamId): FlorState {
  if (state.declaredBy.includes(team)) return state;
  return { ...state, declaredBy: [...state.declaredBy, team] };
}

/** Puntos de la Flor simple (rival sin flor): base 3. */
export function florPointsSimple(): number {
  return FLOR_BASE_POINTS;
}

/** Puntos de una Flor DISPUTADA que se acepta sin subir (dos flores): 6. */
export const FLOR_CONTESTED_POINTS = FLOR_BASE_POINTS * 2;

/** ¿Ambos bandos declararon Flor? Entonces hay duelo de flores. */
export function isFlorContested(state: FlorState): boolean {
  return new Set(state.declaredBy).size >= 2;
}

/* -------------------------------------------------------------
 * Apuesta de Flor disputada: Flor → Contraflor al Resto.
 * Sólo el equipo que NO cantó puede subir; el que subió espera respuesta.
 * ----------------------------------------------------------- */

/** Abre el duelo de flores (queda esperando respuesta del rival con flor). */
export function openFlorDuel(state: FlorState, team: TeamId): FlorState {
  return { ...state, call: 'flor', pendingCall: 'flor', callerTeam: team };
}

/** ¿Puede `team` cantar Contraflor al Resto ahora? */
export function canCallContraflor(
  state: FlorState,
  team: TeamId,
  call: FlorCall,
): boolean {
  if (state.resolved) return false;
  if (state.pendingCall !== 'flor') return false; // sólo se sube sobre una flor
  if (call !== 'contraflor_resto') return false; // sólo modelamos "al resto"
  return state.callerTeam !== null && team !== state.callerTeam;
}

/** El rival con flor sube a Contraflor al Resto (espera quiero/no quiero). */
export function callContraflor(
  state: FlorState,
  team: TeamId,
  call: FlorCall,
): FlorState {
  if (!canCallContraflor(state, team, call)) {
    throw new Error(`Contraflor inválida: ${call} por equipo ${team}`);
  }
  return { ...state, call, pendingCall: call, callerTeam: team };
}

/** ¿Puede `team` responder (quiero/no quiero) el canto de flor pendiente? */
export function canRespondFlor(state: FlorState, team: TeamId): boolean {
  return (
    !state.resolved &&
    state.pendingCall !== null &&
    state.callerTeam !== null &&
    team !== state.callerTeam
  );
}
