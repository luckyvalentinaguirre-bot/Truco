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
  /**
   * Cantidad de cartas en mano SIN revelar su contenido. Lo completa la
   * redacción por asiento (privacy.redactStateFor): el cliente conoce cuántas
   * cartas tiene un rival, nunca cuáles. Opcional: sólo aparece en estado
   * redactado para la red.
   */
  handCount?: number;
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
  /**
   * En Pico a Pico, la muestra sólo puede verla quien participa del 1v1 en
   * curso. Cuando la redacción oculta la muestra a un espectador, `muestra`
   * queda con un marcador y esta bandera se pone en true. Opcional: sólo en
   * estado redactado para la red.
   */
  muestraHidden?: boolean;
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
  /** Modalidad "pico a pico" (sólo 3v3): fase interna de duelos 1v1 en malas. */
  picoAPico?: boolean;
  /**
   * Ronda de Pico a Pico en curso (reparto único + mazo congelado + tantos
   * ocultos). Cuando está presente, `hand`/`players` representan el DUELO actual
   * y `score` es el marcador AISLADO del duelo (0-0). El marcador público real
   * de la partida vive en `picoPublic` mientras dura la ronda.
   */
  picoRound?: PicoRoundData;
  /** Marcador público real durante una ronda de pico (los tantos del duelo van ocultos). */
  picoPublic?: Score;
  /** Contador de rondas de pico jugadas (reparto determinista). */
  picoRoundNumber?: number;
}

/** Datos de una ronda de Pico a Pico embebidos en el estado (ver picoRound.ts). */
export interface PicoRoundData {
  muestra: Card;
  hands: Card[][];
  deckPosition: number;
  currentDuel: number;
  phase: string;
  hiddenResults: {
    pairIndex: number;
    seatA: Seat;
    seatB: Seat;
    deltas: Score;
    entries: { reason: string; winner: TeamId; points: number }[];
  }[];
  revealed: boolean;
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
