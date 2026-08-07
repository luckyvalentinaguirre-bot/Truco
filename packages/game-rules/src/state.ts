/* =============================================================
 * TRUCO ENGINE · Estado de la partida (Game State)
 * -------------------------------------------------------------
 * Estructuras de datos serializables (aptas para enviar por red).
 * El estado es la fuente de verdad; la UI lo renderiza.
 * ============================================================= */
import type {
  Card,
  GameMode,
  Ruleset,
  Seat,
  TeamId,
  TrickOutcome,
} from './types.js';
import type { TrucoState } from './trucoBetting.js';
import type { EnvidoState } from './envidoBetting.js';
import type { FlorState } from './florBetting.js';
import type { Play } from './tricks.js';
import type { Score } from './scoring.js';

export interface Player {
  seat: Seat;
  team: TeamId;
  /** Cartas en mano (ocultas al resto en multiplayer). */
  hand: Card[];
  /** Cartas ya jugadas por este jugador en la mano actual. */
  played: Card[];
  folded: boolean;
}

export interface Trick {
  plays: Play[];
  /** Asiento que abrió la baza. */
  leadSeat: Seat;
  outcome: TrickOutcome | null;
  winnerSeat: Seat | null;
}

export interface HandState {
  muestra: Card;
  /** Asiento mano (primero en jugar) y su equipo. */
  manoSeat: Seat;
  manoTeam: TeamId;
  /** Asiento cuyo turno es jugar/cantar. */
  turnSeat: Seat;
  tricks: Trick[];
  truco: TrucoState;
  envido: EnvidoState;
  flor: FlorState;
  /** Envido/Flor sólo pueden cantarse mientras esto sea true. */
  envidoWindowOpen: boolean;
  finished: boolean;
  /** Equipo ganador de la mano (cuando finished). */
  winner: TeamId | null;
}

export type GamePhase = 'playing' | 'finished';

export interface MatchState {
  ruleset: Ruleset;
  mode: GameMode;
  players: Player[];
  /** Asiento que reparte esta mano. */
  dealerSeat: Seat;
  score: Score;
  hand: HandState;
  phase: GamePhase;
  /** Ganador de la PARTIDA (cuando phase === 'finished'). */
  winner: TeamId | null;
  /** Contador de manos jugadas (para rotación del reparto). */
  handNumber: number;
  /** Semilla del PRNG: hace la partida determinista y serializable. */
  seed: number;
  /** Modalidad "pico a pico" (sólo 3v3): duelos 1v1 mientras haya malas. */
  picoAPico?: boolean;
  /** Duelistas actualmente "al pico" (uno por equipo), si la modalidad está on. */
  picoActive?: { A: Seat; B: Seat };
  /** Equipo cuyo duelista es mano en la mano pico actual (alterna cada mano). */
  picoManoTeam?: TeamId;
}

/** Ayuda: obtener un jugador por asiento. */
export function playerAt(state: MatchState, seat: Seat): Player {
  const p = state.players.find((pl) => pl.seat === seat);
  if (!p) throw new Error(`No existe jugador en el asiento ${seat}`);
  return p;
}

/** Ayuda: equipo del asiento. */
export function teamOf(state: MatchState, seat: Seat): TeamId {
  return playerAt(state, seat).team;
}
