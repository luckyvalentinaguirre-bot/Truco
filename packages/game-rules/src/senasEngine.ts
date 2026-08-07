/* =============================================================
 * TRUCO ENGINE · Señas disponibles según la mano
 * -------------------------------------------------------------
 * Determina qué señas puede realizar un jugador a partir de sus
 * cartas y la muestra. Es una MECÁNICA de juego (datos), no una
 * animación: la capa visual decide cómo ejecutarlas.
 * ============================================================= */
import type { Card } from './types.js';
import { SENAS, type Sena } from './senas.js';
import { matchPiece, rankCard } from './ranking.js';

/** Devuelve las señas que el jugador puede hacer con estas cartas. */
export function availableSenas(hand: Card[], muestra: Card): Sena[] {
  const ids = new Set<string>();

  for (const card of hand) {
    const piece = matchPiece(card, muestra);
    if (piece) {
      ids.add(`pieza-${piece.logicalRank}`);
      continue;
    }
    // Matas.
    if (card.rank === 1 && card.suit === 'espada') ids.add('mata-1e');
    if (card.rank === 1 && card.suit === 'basto') ids.add('mata-1b');
    if (card.rank === 7 && card.suit === 'espada') ids.add('mata-7e');
    if (card.rank === 7 && card.suit === 'oro') ids.add('mata-7o');
    // Genéricas.
    if (card.rank === 3) ids.add('any-3');
    if (card.rank === 2) ids.add('any-2');
  }

  // "Cartas malas": ninguna carta destacada (ni pieza, ni mata, ni 2/3).
  const allWeak = hand.every((card) => {
    if (matchPiece(card, muestra)) return false;
    return rankCard(card, muestra).category === 'comun' && card.rank < 3;
  });
  if (hand.length > 0 && allWeak) ids.add('malas');

  return SENAS.filter((s) => ids.has(s.id));
}
