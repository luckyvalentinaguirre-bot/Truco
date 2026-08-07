/* =============================================================
 * TRUCO ENGINE · Modalidad "Pico a pico" (3v3)
 * -------------------------------------------------------------
 * En 3v3, mientras AMBOS equipos están en malas, la partida se
 * juega como una sucesión de duelos 1 contra 1 entre los jugadores
 * ENFRENTADOS (el de enfrente en la mesa, no el de al lado). Cada
 * duelo se juega con todo (envido/flor/truco) y los puntos suman al
 * tanteador compartido del equipo. Terminada la mano se pasa al
 * siguiente par enfrentado (ronda por medio). Apenas un equipo entra
 * a BUENAS, se pasa a 3v3 normal (todos juntos).
 *
 * Asientos y posiciones (humano abajo = asiento 0):
 *   0 abajo   ↔ 3 arriba        (enfrente)
 *   1 abajo-der ↔ 4 arriba-izq  (enfrente)
 *   2 arriba-der ↔ 5 abajo-izq  (enfrente)
 * En general, el de enfrente del asiento i es (i + 3) % 6. Cada par
 * cruza equipos (A = asientos pares, B = impares).
 * ============================================================= */
import type { Seat } from './types.js';
import type { MatchState } from './state.js';
import { isInBuenas } from './scoring.js';

/** Duelistas actualmente "al pico" (uno por equipo). */
export interface PicoActive {
  A: Seat;
  B: Seat;
}

/** Pares de jugadores enfrentados (cruzados en la mesa): asiento i con i+3. */
export const PICO_PAIRS: [Seat, Seat][] = [
  [0, 3],
  [1, 4],
  [2, 5],
];

/** Convierte un par enfrentado en duelistas por equipo (A = par, B = impar). */
function pairToActive(pair: [Seat, Seat]): PicoActive {
  const [x, y] = pair;
  const a = x % 2 === 0 ? x : y;
  const b = x % 2 === 0 ? y : x;
  return { A: a, B: b };
}

/** Duelistas iniciales: el primer par enfrentado (0 ↔ 3). */
export function initPicoActive(): PicoActive {
  return pairToActive(PICO_PAIRS[0]);
}

/** Índice del par enfrentado que contiene a estos duelistas. */
function pairIndexOf(active: PicoActive): number {
  const idx = PICO_PAIRS.findIndex(
    (pair) => pair.includes(active.A) && pair.includes(active.B),
  );
  return idx < 0 ? 0 : idx;
}

/**
 * ¿La fase pico a pico está activa AHORA? Requiere que la modalidad esté
 * habilitada y que NINGÚN equipo haya entrado todavía a buenas.
 */
export function picoPhaseActive(state: MatchState): boolean {
  if (!state.picoAPico) return false;
  return (
    !isInBuenas('A', state.score, state.ruleset) &&
    !isInBuenas('B', state.score, state.ruleset)
  );
}

/**
 * Pasa al siguiente par ENFRENTADO (ronda por medio). Terminada una mano,
 * entran los dos jugadores del siguiente cruce.
 */
export function picoNextPair(active: PicoActive): PicoActive {
  const next = (pairIndexOf(active) + 1) % PICO_PAIRS.length;
  return pairToActive(PICO_PAIRS[next]);
}
