/* =============================================================
 * TRUCO ENGINE · Privacidad de la información (redacción por asiento)
 * -------------------------------------------------------------
 * AUTORIDAD para lo que un jugador PUEDE recibir por la red. El servidor
 * autoritativo debe enviar SIEMPRE `redactStateFor(state, seat)` en lugar
 * del estado completo, para que un cliente nunca reciba:
 *   - las cartas privadas de otros jugadores (sólo su cantidad);
 *   - la muestra de un enfrentamiento de Pico a Pico en el que no participa.
 * Las cartas ya JUGADAS son públicas (van sobre la mesa) y no se ocultan.
 * Función pura y determinista; no muta el estado original.
 * ============================================================= */
import type { Card, Seat } from './types.js';
import type { MatchState, Player } from './state.js';

/** Marcador de muestra oculta (acompañado de hand.muestraHidden = true). */
const HIDDEN_MUESTRA: Card = { rank: 1, suit: 'oro' };

/**
 * Devuelve una copia del estado SEGURA para enviar a `viewer`:
 *  - las cartas en mano del resto se reemplazan por [] + `handCount`;
 *  - las del propio `viewer` se conservan;
 *  - en Pico a Pico, si `viewer` NO es duelista (está fuera del 1v1 actual),
 *    la muestra se oculta (`muestraHidden = true`).
 */
export function redactStateFor(state: MatchState, viewer: Seat): MatchState {
  const players: Player[] = state.players.map((p) => {
    if (p.seat === viewer) {
      return { ...p, handCount: p.hand.length };
    }
    // Oculta el contenido de la mano ajena: sólo viaja la cantidad.
    return { ...p, hand: [], handCount: p.hand.length };
  });

  // Muestra oculta a los espectadores de un 1v1 de Pico a Pico: durante una
  // ronda de pico, quien NO es duelista (está al mazo) no ve la muestra ajena.
  const me = state.players.find((p) => p.seat === viewer);
  const picoSpectator = !!state.picoRound && !!me?.folded;

  const hand = picoSpectator
    ? { ...state.hand, muestra: { ...HIDDEN_MUESTRA }, muestraHidden: true }
    : { ...state.hand };

  return { ...state, players, hand };
}
