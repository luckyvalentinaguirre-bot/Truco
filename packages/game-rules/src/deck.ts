/* =============================================================
 * TRUCO ENGINE · Mazo
 * ============================================================= */
import type { Card, CardId, Rank, Suit } from './types.js';

export const SUITS: Suit[] = ['oro', 'copa', 'espada', 'basto'];

/** Rangos vigentes: se eliminan 8, 9 y comodines. */
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export function cardId(card: Card): CardId {
  return `${card.rank}-${card.suit}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** Baraja española de 40 cartas. */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Barajado Fisher-Yates. Recibe un RNG inyectable para ser
 * determinista (tests, replays) y verificable en el servidor.
 */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SUIT_LABEL: Record<Suit, string> = {
  oro: 'Oros',
  copa: 'Copas',
  espada: 'Espadas',
  basto: 'Bastos',
};

export function suitLabel(suit: Suit): string {
  return SUIT_LABEL[suit];
}

export function cardLabel(card: Card): string {
  return `${card.rank} de ${SUIT_LABEL[card.suit]}`;
}
