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

/**
 * Puntos de la Flor cuando no hay Flor rival: base 3 para el equipo que
 * la cantó. (Con Flor Envido / Contra Flor al Resto se resuelven con la
 * comparación de tantos, a implementar en la etapa de duelo de flores.)
 */
export function florPointsSimple(): number {
  return FLOR_BASE_POINTS;
}

/** ¿Ambos bandos declararon Flor? Entonces hay duelo de flores. */
export function isFlorContested(state: FlorState): boolean {
  return new Set(state.declaredBy).size >= 2;
}
