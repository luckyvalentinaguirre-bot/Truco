/* =============================================================
 * TRUCO ENGINE · Apuestas de Flor
 * -------------------------------------------------------------
 * Estructura para Flor, Con Flor Envido y Contra Flor al Resto,
 * más los estados de "echar los perros" (en ley / a punto).
 * La resolución completa enfrentada se ampliará; la base (Flor = 3)
 * y la representación del estado ya están cubiertas.
 * ============================================================= */
import type { FlorCall, Seat, TeamId } from './types';
import { FLOR_BASE_POINTS } from './flor';

/** Respuesta a "echar los perros": si el rival tiene Flor o no. */
export type PerrosResponse = 'en_ley' | 'a_punto';

export interface FlorState {
  /** Equipos que cantaron Flor (tienen flor declarada). */
  declaredBy: TeamId[];
  /** Asientos que YA anunciaron su Flor (cada jugador la canta por separado). */
  declaredSeats: Seat[];
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
    declaredSeats: [],
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
 * Registra el anuncio de Flor de UN jugador (asiento). Cada jugador con Flor la
 * anuncia por separado; que un compañero ya la haya cantado NO bloquea a los
 * demás. También deja registrado el equipo.
 */
export function declareFlorSeat(state: FlorState, seat: Seat, team: TeamId): FlorState {
  const declaredSeats = state.declaredSeats.includes(seat)
    ? state.declaredSeats
    : [...state.declaredSeats, seat];
  const declaredBy = state.declaredBy.includes(team)
    ? state.declaredBy
    : [...state.declaredBy, team];
  return { ...state, declaredSeats, declaredBy };
}

/** Puntos de la Flor simple (rival sin flor): base 3. */
export function florPointsSimple(): number {
  return FLOR_BASE_POINTS;
}

/* -------------------------------------------------------------
 * Escalera de la Flor disputada:
 *   Flor (3)  →  Con Flor Envido (5)  →  Contraflor al resto (falta).
 * Con dos flores enfrentadas, gana la más alta el valor del nivel aceptado.
 * ----------------------------------------------------------- */
export const FLOR_LEVEL_ORDER: FlorCall[] = [
  'flor',
  'contraflor_envido',
  'contraflor_resto',
];

/** Puntos fijos por nivel (Contraflor al resto vale la FALTA, la calcula el motor). */
export const FLOR_LEVEL_VALUE: Record<'flor' | 'contraflor_envido', number> = {
  flor: FLOR_BASE_POINTS, // 3
  contraflor_envido: 5,
};

function levelRank(call: FlorCall): number {
  return FLOR_LEVEL_ORDER.indexOf(call);
}

/** ¿Ambos bandos declararon Flor? Entonces hay duelo de flores. */
export function isFlorContested(state: FlorState): boolean {
  return new Set(state.declaredBy).size >= 2;
}

/** Abre el duelo de flores (queda esperando respuesta del rival con flor). */
export function openFlorDuel(state: FlorState, team: TeamId): FlorState {
  return { ...state, call: 'flor', pendingCall: 'flor', callerTeam: team };
}

/** ¿Puede `team` subir la apuesta de flor a `call` ahora? */
export function canCallContraflor(
  state: FlorState,
  team: TeamId,
  call: FlorCall,
): boolean {
  if (state.resolved || !state.pendingCall) return false;
  if (call === 'flor') return false; // 'flor' no es una subida
  if (levelRank(call) <= levelRank(state.pendingCall)) return false; // debe subir
  return state.callerTeam !== null && team !== state.callerTeam;
}

/** El rival con flor sube (Con Flor Envido / Contraflor al resto). */
export function callContraflor(
  state: FlorState,
  team: TeamId,
  call: FlorCall,
): FlorState {
  if (!canCallContraflor(state, team, call)) {
    throw new Error(`Subida de Flor inválida: ${call} por equipo ${team}`);
  }
  // El nivel que quedaba en la mesa (state.pendingCall) pasa a ser el "acordado":
  // si el rival NO quiere la nueva subida, se cobra ese nivel anterior.
  return { ...state, call: state.pendingCall!, pendingCall: call, callerTeam: team };
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
