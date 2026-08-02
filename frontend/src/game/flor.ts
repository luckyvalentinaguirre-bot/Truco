/* =============================================================
 * TRUCO ENGINE · Detección y valor de la Flor (v1)
 * ============================================================= */
import type { Card, Rank } from './types';
import { matchPiece } from './ranking';

/** Aporte de cada pieza al valor de flor. */
const PIECE_FLOR_BONUS: Record<number, number> = {
  2: 10,
  4: 9,
  5: 8,
  11: 7,
  10: 7,
};

function commonFlorPoints(rank: Rank): number {
  return rank >= 10 ? 0 : rank; // figuras no-pieza aportan 0
}

export interface FlorResult {
  hasFlor: boolean;
  value: number;
  /** Qué caso disparó la flor, para UI. */
  reason: 'tres_mismo_palo' | 'dos_piezas' | 'pieza_mas_dos_palo' | null;
}

/**
 * Detecta Flor considerando piezas:
 *  Caso 1: tres cartas del mismo palo.
 *  Caso 2: dos piezas.
 *  Caso 3: una pieza + dos cartas del mismo palo.
 *
 * Valor: 20 + aportes (piezas suman su bonus, comunes su número,
 * figuras no-pieza 0).
 */
export function calcFlor(hand: Card[], muestra: Card): FlorResult {
  if (hand.length !== 3) {
    return { hasFlor: false, value: 0, reason: null };
  }

  const pieceSlots = hand.map((c) => matchPiece(c, muestra));
  const pieceCount = pieceSlots.filter(Boolean).length;

  const suits = hand.map((c) => c.suit);
  const allSameSuit = suits.every((s) => s === suits[0]);

  // Palos de las cartas que NO son pieza (las piezas cuentan como muestra).
  const nonPieceSuits = hand
    .filter((_, i) => pieceSlots[i] === null)
    .map((c) => c.suit);
  const twoNonPieceSameSuit =
    nonPieceSuits.length === 2 && nonPieceSuits[0] === nonPieceSuits[1];

  let reason: FlorResult['reason'] = null;
  if (allSameSuit) reason = 'tres_mismo_palo';
  else if (pieceCount >= 2) reason = 'dos_piezas';
  else if (pieceCount === 1 && twoNonPieceSameSuit) reason = 'pieza_mas_dos_palo';

  if (!reason) {
    return { hasFlor: false, value: 0, reason: null };
  }

  const value =
    20 +
    hand.reduce((sum, c, i) => {
      const slot = pieceSlots[i];
      if (slot) return sum + PIECE_FLOR_BONUS[slot.logicalRank];
      return sum + commonFlorPoints(c.rank);
    }, 0);

  return { hasFlor: true, value, reason };
}

/** Puntos base de la flor simple. */
export const FLOR_BASE_POINTS = 3;
