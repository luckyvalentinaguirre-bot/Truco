/* =============================================================
 * TRUCO ENGINE · Pico a Pico 3v3 — RONDA como fase interna (autoridad)
 * -------------------------------------------------------------
 * Implementa el Pico a Pico como lo define la especificación definitiva:
 * NO son tres partidas 1v1 separadas, sino UNA fase dentro de la partida
 * 3v3 con un ÚNICO reparto, mazo CONGELADO durante los tres duelos, y los
 * tantos (envido/flor) que se cantan y resuelven pero quedan OCULTOS hasta
 * la REVELACIÓN final.
 *
 * Diseño clave (no rompe el motor validado):
 *   - Cada duelo se juega con el REDUCTOR EXISTENTE (applyAction) sobre un
 *     sub-estado AISLADO cuyo score arranca en 0-0. Así las reglas (orden de
 *     cartas, turnos, envido/real/falta, flor/contraflor, truco/retruco/
 *     vale4, pardas, mano) son EXACTAMENTE las mismas, sin una segunda lógica
 *     de Truco.
 *   - Como el sub-estado tiene su propio score, los puntos del duelo NO tocan
 *     el tanteador público: quedan registrados en `hiddenResults`. Recién en
 *     `revealPicoRound` se suman al score real de la partida.
 *   - El reparto es único: `deckPosition` queda FIJO y es idéntico en los tres
 *     duelos (invariante testeada, §27).
 *
 * Máquina de estados (§33):
 *   NORMAL_3V3 → PICO_1V1_1 → PICO_1V1_2 → PICO_1V1_3 → PICO_REVELACION → NORMAL_3V3 …
 * El ciclo se detiene cuando un equipo entra a BUENAS (§32).
 * ============================================================= */
import type { Card, Ruleset, Seat, TeamId } from './types.js';
import type { MatchState, Player, HandState } from './state.js';
import type { GameEvent } from './events.js';
import { buildDeck, shuffle } from './deck.js';
import { handRng } from './prng.js';
import { initTrucoState } from './trucoBetting.js';
import { initEnvidoState } from './envidoBetting.js';
import { initFlorState } from './florBetting.js';
import { initScore, isInBuenas, type Score } from './scoring.js';
import { PICO_PAIRS } from './pico.js';

/** Fases del Pico a Pico (§33). Determinista: nunca estados imposibles. */
export type PicoPhase =
  | 'NORMAL_3V3'
  | 'PICO_1V1_1'
  | 'PICO_1V1_2'
  | 'PICO_1V1_3'
  | 'PICO_REVELACION';

/** Las tres fases de duelo, en orden (§6). */
export const PICO_DUEL_PHASES: PicoPhase[] = [
  'PICO_1V1_1',
  'PICO_1V1_2',
  'PICO_1V1_3',
];

/** Un aporte de puntos resuelto durante un duelo (queda oculto hasta revelar). */
export interface HiddenScoreEntry {
  reason: string; // envido | flor | truco | mazo | *_no_querido …
  winner: TeamId;
  points: number;
}

/** Resultado (oculto) de un duelo del Pico a Pico. */
export interface PicoDuelResult {
  /** Índice del par enfrentado (0→(0,3), 1→(1,4), 2→(2,5)). */
  pairIndex: number;
  seatA: Seat; // duelista del equipo A
  seatB: Seat; // duelista del equipo B
  /** Puntos netos del duelo por equipo (van al score real recién al revelar). */
  deltas: Score;
  /** Detalle para la revelación (tantos de envido/flor, resultado de truco). */
  entries: HiddenScoreEntry[];
}

/** Datos de la ronda de Pico a Pico (fase interna del 3v3). */
export interface PicoRound {
  /** Muestra única de la ronda (frozen). */
  muestra: Card;
  /** Seis manos repartidas de una sola vez (frozen). Índice = asiento. */
  hands: Card[][];
  /** Posición del mazo tras el reparto: FIJA durante los tres duelos (§27). */
  deckPosition: number;
  /** Duelo en curso: 0,1,2. */
  currentDuel: number;
  /** Fase de la máquina de estados. */
  phase: PicoPhase;
  /** Resultados ocultos acumulados de los duelos ya terminados. */
  hiddenResults: PicoDuelResult[];
  /** Se pone en true al pasar a PICO_REVELACION. */
  revealed: boolean;
}

/** ¿Deben seguir jugándose duelos? (ambos equipos en malas). §32 */
export function picoCycleContinues(score: Score, ruleset: Ruleset): boolean {
  return !isInBuenas('A', score, ruleset) && !isInBuenas('B', score, ruleset);
}

/** Convierte un par enfrentado [x,y] en asientos por equipo (A par, B impar). */
export function pairSeats(pairIndex: number): { seatA: Seat; seatB: Seat } {
  const [x, y] = PICO_PAIRS[pairIndex % PICO_PAIRS.length]!;
  return x % 2 === 0 ? { seatA: x, seatB: y } : { seatA: y, seatB: x };
}

/**
 * Reparto ÚNICO de la ronda: baraja una vez y da 3 cartas a cada uno de los 6
 * asientos; la muestra es la carta siguiente. `deckPosition` queda fijo.
 * `roundNumber` hace el reparto determinista y reproducible.
 */
export function dealPicoRound(
  seed: number,
  roundNumber: number,
): { hands: Card[][]; muestra: Card; deckPosition: number } {
  const rng = handRng(seed, roundNumber);
  const deck = shuffle(buildDeck(), rng);
  const hands: Card[][] = [[], [], [], [], [], []];
  let cursor = 0;
  for (let round = 0; round < 3; round++) {
    for (let seat = 0; seat < 6; seat++) {
      hands[seat]!.push(deck[cursor++]!);
    }
  }
  const muestra = deck[cursor]!; // deckPosition apunta acá y NO se mueve
  return { hands, muestra, deckPosition: cursor };
}

/** Inicia la ronda de Pico a Pico (primer duelo, mazo congelado). */
export function startPicoRound(seed: number, roundNumber: number): PicoRound {
  const { hands, muestra, deckPosition } = dealPicoRound(seed, roundNumber);
  return {
    muestra,
    hands,
    deckPosition,
    currentDuel: 0,
    phase: 'PICO_1V1_1',
    hiddenResults: [],
    revealed: false,
  };
}

/**
 * Construye el sub-estado AISLADO de un duelo, usando las cartas YA repartidas
 * (no vuelve a repartir: mazo congelado). Score arranca en 0-0 para que los
 * puntos del duelo NO toquen el tanteador público. Los cuatro que no juegan
 * quedan al mazo (folded) sin cartas.
 */
export function buildDuelState(
  round: PicoRound,
  duelIndex: number,
  ruleset: Ruleset,
  seed: number,
  dealerSeat?: Seat,
): MatchState {
  const { seatA, seatB } = pairSeats(duelIndex);
  // Mano del duelo = el duelista que está a la DERECHA del mazo (repartidor):
  // el primero que se alcanza yendo a la derecha desde `dealerSeat + 1`. Si no
  // se pasa el repartidor, se alterna (compat) A en pares, B en impares.
  let manoSeat: Seat;
  if (dealerSeat !== undefined) {
    const start = (dealerSeat + 1) % 6;
    const dist = (s: Seat) => (s - start + 6) % 6;
    manoSeat = dist(seatA) <= dist(seatB) ? seatA : seatB;
  } else {
    manoSeat = duelIndex % 2 === 0 ? seatA : seatB;
  }
  const pieSeat: Seat = manoSeat === seatA ? seatB : seatA;

  const players: Player[] = Array.from({ length: 6 }, (_, seat) => {
    const team: TeamId = seat % 2 === 0 ? 'A' : 'B';
    const inDuel = seat === seatA || seat === seatB;
    return {
      seat,
      team,
      hand: inDuel ? [...round.hands[seat]!] : [],
      played: [],
      folded: !inDuel,
    };
  });

  const hand: HandState = {
    muestra: round.muestra,
    manoSeat,
    manoTeam: players[manoSeat]!.team,
    turnSeat: manoSeat,
    tricks: [{ plays: [], leadSeat: manoSeat, outcome: null, winnerSeat: null }],
    truco: initTrucoState(),
    envido: initEnvidoState(),
    flor: initFlorState(),
    envidoWindowOpen: true,
    finished: false,
    winner: null,
  };
  void pieSeat;

  return {
    ruleset,
    mode: '3v3',
    players,
    dealerSeat: 5,
    score: initScore(),
    hand,
    phase: 'playing',
    winner: null,
    handNumber: 0,
    seed,
  };
}

/** Convierte los POINTS_AWARDED de un duelo terminado en entradas ocultas. */
export function collectDuelEntries(events: GameEvent[]): HiddenScoreEntry[] {
  const entries: HiddenScoreEntry[] = [];
  for (const e of events) {
    if (e.type === 'POINTS_AWARDED') {
      entries.push({ reason: e.reason, winner: e.team, points: e.points });
    }
  }
  return entries;
}

/**
 * Cierra el duelo en curso: registra su resultado OCULTO (deltas + detalle) y
 * avanza la máquina de estados. Tras el tercer duelo pasa a PICO_REVELACION.
 * NO mueve el mazo ni reparte de nuevo (§13/§16/§27).
 */
export function finishDuel(
  round: PicoRound,
  finishedDuel: MatchState,
  events: GameEvent[],
): PicoRound {
  const { seatA, seatB } = pairSeats(round.currentDuel);
  const result: PicoDuelResult = {
    pairIndex: round.currentDuel,
    seatA,
    seatB,
    deltas: { A: finishedDuel.score.A, B: finishedDuel.score.B },
    entries: collectDuelEntries(events),
  };
  const hiddenResults = [...round.hiddenResults, result];

  const nextDuel = round.currentDuel + 1;
  if (nextDuel >= PICO_DUEL_PHASES.length) {
    // Tres duelos jugados → revelación (§19/§20).
    return { ...round, hiddenResults, phase: 'PICO_REVELACION', revealed: true };
  }
  return {
    ...round,
    hiddenResults,
    currentDuel: nextDuel,
    phase: PICO_DUEL_PHASES[nextDuel]!,
  };
}

/** Suma de los deltas ocultos de todos los duelos (lo que se aplicará al revelar). */
export function revealTotals(round: PicoRound): Score {
  return round.hiddenResults.reduce<Score>(
    (acc, r) => ({ A: acc.A + r.deltas.A, B: acc.B + r.deltas.B }),
    initScore(),
  );
}

/**
 * Vista redactada de la ronda para `viewer` (§8/§24/§38): un espectador (o un
 * duelista que no participa del duelo en curso) NUNCA recibe las cartas ajenas
 * ni los resultados ocultos aún no revelados.
 */
export function redactPicoRoundFor(round: PicoRound, viewer: Seat): Partial<PicoRound> {
  const { seatA, seatB } = pairSeats(round.currentDuel);
  const isDuelist = viewer === seatA || viewer === seatB;
  return {
    deckPosition: round.deckPosition,
    currentDuel: round.currentDuel,
    phase: round.phase,
    revealed: round.revealed,
    // Sólo el propio duelista ve SUS cartas; jamás las del rival ni de terceros.
    hands: round.hands.map((h, seat) => (seat === viewer && isDuelist ? [...h] : [])),
    // Los resultados ocultos NO viajan hasta la revelación.
    hiddenResults: round.revealed ? round.hiddenResults : [],
  };
}
