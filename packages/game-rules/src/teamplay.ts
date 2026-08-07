/* =============================================================
 * TRUCO ENGINE · Coordinación entre compañeros (Etapa 0)
 * -------------------------------------------------------------
 * Autoridad PURA para tres capacidades de comunicación de equipo:
 *   - TOCA: seña de equipo (no revela información privada).
 *   - Selección de compañero por el ÚLTIMO jugador del equipo en la
 *     ronda actual.
 *   - "Peek": autorización para ver temporalmente las cartas de un
 *     compañero (5 s en la UI). La AUTORIDAD de qué cartas puede ver
 *     un jugador vive acá; el servidor la usa para no filtrar cartas.
 *
 * Todo es determinista y no muta el estado. Respeta equipos, orden
 * real de mano, 1v1 (sin compañeros) y pico a pico (los jugadores que
 * no están al pico están "folded" y no tienen cartas: no se pueden ver).
 * NO modifica el reglamento (envido/flor/truco/puntos/mano).
 * ============================================================= */
import type { Card, Seat, TeamId } from './types.js';
import type { MatchState, Player } from './state.js';
import { manoRank } from './setup.js';

/** ¿La partida está en juego y la mano en curso? */
function inPlay(state: MatchState): boolean {
  return state.phase === 'playing' && !state.hand.finished;
}

/** Jugador por asiento (o undefined). */
function at(state: MatchState, seat: Seat): Player | undefined {
  return state.players.find((p) => p.seat === seat);
}

/** ¿El jugador participa de la mano actual? (existe y no se fue al mazo). */
export function isActivePlayer(state: MatchState, seat: Seat): boolean {
  const p = at(state, seat);
  return !!p && !p.folded;
}

/**
 * Compañeros ACTIVOS de `seat` en la mano actual (mismo equipo, sin incluirse a
 * sí mismo, sin los que se fueron al mazo / no están al pico). En 1v1 → [].
 */
export function teammatesOf(state: MatchState, seat: Seat): Seat[] {
  const me = at(state, seat);
  if (!me) return [];
  return state.players
    .filter((p) => p.team === me.team && p.seat !== seat && !p.folded)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}

/**
 * TOCA: seña de equipo. Disponible para CUALQUIER jugador activo del equipo
 * mientras la mano esté en juego (no se limita al mano ni al último). No revela
 * información privada. En 1v1 también existe como seña individual, pero como es
 * coordinación de equipo la habilitamos sólo si el modo tiene equipos de >1;
 * para 1v1 se considera no disponible (no hay compañero con quien coordinar).
 */
export function canToca(state: MatchState, seat: Seat): boolean {
  if (!inPlay(state)) return false;
  if (!isActivePlayer(state, seat)) return false;
  // Coordinación de equipo: requiere al menos un compañero en el modo.
  return teamSize(state, at(state, seat)!.team) > 1;
}

/** Cantidad total de jugadores de un equipo en la mesa (no depende de folded). */
function teamSize(state: MatchState, team: TeamId): number {
  return state.players.filter((p) => p.team === team).length;
}

/**
 * ¿Es `seat` el ÚLTIMO jugador de su equipo en el orden real de la ronda?
 * Se calcula por prioridad de mano (manoRank) entre los compañeros ACTIVOS del
 * equipo (incluido `seat`): el de mayor manoRank es el último en jugar. No usa
 * posición visual. Sigue valiendo aunque cambie el mano, rote el mazo o sea
 * 2v2/3v3/pico a pico.
 */
export function isLastTeammateToAct(state: MatchState, seat: Seat): boolean {
  if (!isActivePlayer(state, seat)) return false;
  const me = at(state, seat)!;
  const n = state.players.length;
  const mates = state.players.filter((p) => p.team === me.team && !p.folded);
  if (mates.length < 2) return false; // sin compañeros no hay "último de equipo"
  const myRank = manoRank(seat, state.hand.manoSeat, n);
  const maxRank = Math.max(
    ...mates.map((p) => manoRank(p.seat, state.hand.manoSeat, n)),
  );
  return myRank === maxRank;
}

/**
 * ¿Puede `seat` usar la acción especial de "seleccionar compañero"? Sólo el
 * último jugador de su equipo en la ronda, y sólo si tiene compañeros activos.
 */
export function canSelectTeammate(state: MatchState, seat: Seat): boolean {
  if (!inPlay(state)) return false;
  return isLastTeammateToAct(state, seat) && teammatesOf(state, seat).length > 0;
}

/**
 * Autoridad de PRIVACIDAD: ¿puede `viewer` ver temporalmente las cartas de
 * `target`? Requiere: partida en juego; viewer y target distintos; ambos
 * activos; MISMO equipo; y que target tenga cartas ocultas por revelar. Los
 * rivales JAMÁS. En pico a pico, los que no están al pico están folded → no se
 * pueden ver (respeta la restricción de privacidad del pico).
 */
export function canPeekTeammate(state: MatchState, viewer: Seat, target: Seat): boolean {
  if (!inPlay(state)) return false;
  if (viewer === target) return false;
  const v = at(state, viewer);
  const t = at(state, target);
  if (!v || !t) return false;
  if (v.folded || t.folded) return false;
  if (v.team !== t.team) return false; // nunca rivales
  return t.hand.length > 0;
}

/**
 * Devuelve las cartas del compañero `target` SÓLO si `viewer` está autorizado.
 * Es la única fuente que debe usar el servidor para responder un "peek": nunca
 * enviar cartas de rivales ni de jugadores no solicitados. Lanza si no procede.
 */
export function teammatePeekCards(
  state: MatchState,
  viewer: Seat,
  target: Seat,
): Card[] {
  if (!canPeekTeammate(state, viewer, target)) {
    throw new Error('No autorizado a ver las cartas de ese jugador');
  }
  // Copia defensiva: no exponer la referencia interna.
  return at(state, target)!.hand.map((c) => ({ ...c }));
}
