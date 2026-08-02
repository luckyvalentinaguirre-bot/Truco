/* =============================================================
 * TRUCO ENGINE · Creación de partida y reparto
 * ============================================================= */
import type { Card, GameMode, Ruleset, Seat, TeamId } from './types';
import { buildDeck, shuffle } from './deck';
import { handRng } from './prng';
import { OFFICIAL_40 } from './ruleset';
import { initTrucoState } from './trucoBetting';
import { initEnvidoState } from './envidoBetting';
import { initFlorState } from './florBetting';
import { initScore } from './scoring';
import type { HandState, MatchState, Player } from './state';

/** Cantidad de jugadores por modo. */
export const PLAYER_COUNT: Record<GameMode, number> = {
  '1v1': 2,
  '2v2': 4,
  '3v3': 6,
  '3players': 3,
};

/**
 * Asignación de equipos por asiento.
 *  - 1v1 / 2v2 / 3v3: bandos alternados A-B-A-B…
 *  - 3 jugadores: se decide por quién es mano (equipo del mano en solitario);
 *    aquí se asigna una base alternada que la mano ajustará.
 */
function assignTeams(mode: GameMode): TeamId[] {
  const n = PLAYER_COUNT[mode];
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'A' : 'B'));
}

export interface CreateMatchOptions {
  mode?: GameMode;
  ruleset?: Ruleset;
  /** Semilla del PRNG para partidas deterministas / reproducibles. */
  seed?: number;
}

/** Crea una partida nueva y reparte la primera mano. */
export function createMatch(opts: CreateMatchOptions = {}): MatchState {
  const mode = opts.mode ?? '1v1';
  const ruleset = opts.ruleset ?? OFFICIAL_40;
  const seed = opts.seed ?? Math.floor(Math.random() * 0xffffffff);
  const n = PLAYER_COUNT[mode];
  const teams = assignTeams(mode);

  const players: Player[] = Array.from({ length: n }, (_, seat) => ({
    seat,
    team: teams[seat],
    hand: [],
    played: [],
    folded: false,
  }));

  // Dealer inicial = último asiento ⇒ mano = asiento 0.
  const dealerSeat = n - 1;

  const base: MatchState = {
    ruleset,
    mode,
    players,
    dealerSeat,
    score: initScore(),
    hand: {} as HandState, // se completa en dealHand
    phase: 'playing',
    winner: null,
    handNumber: 0,
    seed,
  };

  return dealHand(base);
}

/** Siguiente asiento en orden circular. */
export function nextSeat(seat: Seat, count: number): Seat {
  return (seat + 1) % count;
}

/**
 * Reparte una nueva mano: baraja, reparte 3 cartas a cada jugador y
 * descubre la muestra. Rota el reparto y el mano.
 */
export function dealHand(state: MatchState): MatchState {
  const n = state.players.length;
  const nextHandNumber = state.handNumber + 1;
  const rng = handRng(state.seed, nextHandNumber);
  const deck = shuffle(buildDeck(), rng);

  const players: Player[] = state.players.map((p) => ({
    ...p,
    hand: [],
    played: [],
    folded: false,
  }));

  // Reparto de 3 cartas por jugador (comenzando por el mano).
  const manoSeat = nextSeat(state.dealerSeat, n);
  let cursor = 0;
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < n; i++) {
      const seat = nextSeat(manoSeat + i - 1, n);
      players[seat].hand.push(deck[cursor++] as Card);
    }
  }
  // La muestra es la siguiente carta del pozo.
  const muestra = deck[cursor] as Card;

  const hand: HandState = {
    muestra,
    manoSeat,
    manoTeam: players[manoSeat].team,
    turnSeat: manoSeat,
    tricks: [{ plays: [], leadSeat: manoSeat, outcome: null, winnerSeat: null }],
    truco: initTrucoState(),
    envido: initEnvidoState(),
    flor: initFlorState(),
    envidoWindowOpen: true,
    finished: false,
    winner: null,
  };

  return {
    ...state,
    players,
    hand,
    handNumber: state.handNumber + 1,
  };
}
