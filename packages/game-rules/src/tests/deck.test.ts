import { describe, it, expect } from 'vitest';
import { buildDeck, cardId } from '../deck.js';

describe('Mazo español de 40 cartas', () => {
  const deck = buildDeck();

  it('tiene exactamente 40 cartas', () => {
    expect(deck).toHaveLength(40);
  });

  it('no contiene 8 ni 9', () => {
    expect(deck.some((c) => c.rank === 8 as unknown as number)).toBe(false);
    expect(deck.some((c) => c.rank === 9 as unknown as number)).toBe(false);
  });

  it('usa los 4 palos con 10 valores cada uno', () => {
    for (const suit of ['oro', 'copa', 'espada', 'basto'] as const) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(10);
    }
  });

  it('los valores son 1..7, 10, 11, 12', () => {
    const ranks = [...new Set(deck.map((c) => c.rank))].sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 10, 11, 12]);
  });

  it('no hay cartas repetidas', () => {
    const ids = new Set(deck.map(cardId));
    expect(ids.size).toBe(40);
  });
});
