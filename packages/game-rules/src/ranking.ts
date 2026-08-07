/* =============================================================
 * TRUCO ENGINE · Jerarquía de cartas (piezas, matas, comunes)
 * -------------------------------------------------------------
 * Toda la jerarquía depende de la MUESTRA. La lógica vive acá,
 * NUNCA hardcodeada dentro de componentes.
 * ============================================================= */
import type { Card, CardCategory, RankedCard, Rank, Suit } from './types.js';
import { sameCard } from './deck.js';

/** Rangos que forman las piezas, en orden de fuerza descendente. */
export const PIECE_RANK_ORDER: Rank[] = [2, 4, 5, 11, 10];

/** Fuerza base de cada pieza (mayor = más fuerte). */
const PIECE_STRENGTH: Record<number, number> = {
  2: 100,
  4: 99,
  5: 98,
  11: 97,
  10: 96,
};

/**
 * Resuelve qué carta ocupa cada "casillero" de pieza para una muestra.
 * Excepción del Rey: si la muestra ES una pieza (su rango está en
 * PIECE_RANK_ORDER), el 12 del mismo palo pasa a reemplazarla.
 */
export interface PieceSlot {
  /** Rango "lógico" de la pieza (2,4,5,11,10) para valor de envido/flor. */
  logicalRank: Rank;
  card: Card;
  strength: number;
}

export function resolvePieces(muestra: Card): PieceSlot[] {
  const suit = muestra.suit;
  return PIECE_RANK_ORDER.map((logicalRank) => {
    const isMuestraRank = muestra.rank === logicalRank;
    const card: Card = isMuestraRank
      ? { suit, rank: 12 } // Rey reemplaza a la pieza mostrada
      : { suit, rank: logicalRank };
    return { logicalRank, card, strength: PIECE_STRENGTH[logicalRank] };
  });
}

/** Devuelve el slot de pieza si `card` es pieza para esa muestra. */
export function matchPiece(card: Card, muestra: Card): PieceSlot | null {
  return resolvePieces(muestra).find((p) => sameCard(p.card, card)) ?? null;
}

/** Matas fijas (independientes de la muestra), de mayor a menor. */
const MATAS: { card: Card; strength: number }[] = [
  { card: { rank: 1, suit: 'espada' }, strength: 90 },
  { card: { rank: 1, suit: 'basto' }, strength: 89 },
  { card: { rank: 7, suit: 'espada' }, strength: 88 },
  { card: { rank: 7, suit: 'oro' }, strength: 87 },
];

/** Fuerza de cartas comunes por rango (cuando no son pieza ni mata). */
const COMMON_STRENGTH: Record<number, number> = {
  3: 80,
  2: 70,
  1: 60, // 1 de copa / 1 de oro (los 1 de espada/basto son matas)
  12: 50,
  11: 40,
  10: 30,
  7: 20, // 7 de copa / 7 de basto (7 de espada/oro son matas)
  6: 15,
  5: 10,
  4: 5,
};

/**
 * Fuerza de una carta para resolver bazas, dada la muestra.
 * Igual fuerza entre dos cartas => PARDA.
 */
export function rankCard(card: Card, muestra: Card): RankedCard {
  const piece = matchPiece(card, muestra);
  if (piece) {
    return { ...card, strength: piece.strength, category: 'pieza' };
  }

  const mata = MATAS.find((m) => sameCard(m.card, card));
  if (mata) {
    return { ...card, strength: mata.strength, category: 'mata' };
  }

  return { ...card, strength: COMMON_STRENGTH[card.rank], category: 'comun' };
}

export function cardCategory(card: Card, muestra: Card): CardCategory {
  return rankCard(card, muestra).category;
}

/**
 * Compara dos cartas en el contexto de una muestra.
 * > 0 si `a` gana, < 0 si `b` gana, 0 si PARDA.
 */
export function compareCards(a: Card, b: Card, muestra: Card): number {
  return rankCard(a, muestra).strength - rankCard(b, muestra).strength;
}

export function isPieza(card: Card, muestra: Card): boolean {
  return matchPiece(card, muestra) !== null;
}

export function suitOf(card: Card): Suit {
  return card.suit;
}
