import { describe, it, expect } from 'vitest';
import { resolvePieces, matchPiece, rankCard, compareCards } from '../ranking.js';
import type { Card, Suit } from '../types.js';

const c = (rank: number, suit: Suit): Card => ({ rank: rank as Card['rank'], suit });

describe('piezas según la muestra (los cuatro palos)', () => {
  const suits: Suit[] = ['oro', 'copa', 'espada', 'basto'];

  it.each(suits)('muestra de %s ⇒ piezas 2,4,5,11,10 de ese palo', (suit) => {
    const muestra = c(3, suit); // 3 no es pieza
    const slots = resolvePieces(muestra);
    expect(slots.map((s) => s.logicalRank)).toEqual([2, 4, 5, 11, 10]);
    // Todas las piezas son del palo de la muestra.
    for (const s of slots) expect(s.card.suit).toBe(suit);
    // El 2 de la muestra es la pieza más fuerte.
    expect(matchPiece(c(2, suit), muestra)?.strength).toBeGreaterThan(
      matchPiece(c(10, suit), muestra)!.strength,
    );
    // Una carta de otro palo NO es pieza.
    const other = suits.find((x) => x !== suit)!;
    expect(matchPiece(c(2, other), muestra)).toBeNull();
  });
});

describe('caso especial del 12 (muestra que ES pieza)', () => {
  it('muestra 5 de espada ⇒ el 12 de espada ocupa la pieza "5"', () => {
    const muestra = c(5, 'espada');
    // El 12 de espada es pieza (rango lógico 5); el 5 de espada ya NO.
    expect(matchPiece(c(12, 'espada'), muestra)?.logicalRank).toBe(5);
    expect(matchPiece(c(5, 'espada'), muestra)).toBeNull();
    // No se duplica: sigue habiendo exactamente 5 piezas.
    const cards = resolvePieces(muestra).map((s) => `${s.card.rank}-${s.card.suit}`);
    expect(new Set(cards).size).toBe(5);
  });

  it('muestra 2 de oro ⇒ el 12 de oro ocupa la pieza "2" (la más fuerte)', () => {
    const muestra = c(2, 'oro');
    expect(matchPiece(c(12, 'oro'), muestra)?.logicalRank).toBe(2);
    expect(matchPiece(c(2, 'oro'), muestra)).toBeNull();
  });
});

describe('jerarquía: piezas > matas > comunes', () => {
  it('pieza le gana al 1 de espada (mata mayor)', () => {
    const muestra = c(3, 'basto'); // 2 de basto es pieza
    expect(compareCards(c(2, 'basto'), c(1, 'espada'), muestra)).toBeGreaterThan(0);
  });

  it('orden de matas: 1E > 1B > 7E > 7O > comunes', () => {
    const m = c(3, 'copa'); // muestra que no toca estas cartas
    const s = (r: number, su: Suit) => rankCard(c(r, su), m).strength;
    expect(s(1, 'espada')).toBeGreaterThan(s(1, 'basto'));
    expect(s(1, 'basto')).toBeGreaterThan(s(7, 'espada'));
    expect(s(7, 'espada')).toBeGreaterThan(s(7, 'oro'));
    expect(s(7, 'oro')).toBeGreaterThan(s(3, 'oro')); // 3 = común más alto
  });
});
