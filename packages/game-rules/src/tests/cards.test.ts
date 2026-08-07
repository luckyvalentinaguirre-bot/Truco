import { describe, it, expect } from 'vitest';
import type { Card } from '../types.js';
import { rankCard, compareCards, resolvePieces, matchPiece } from '../ranking.js';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('Piezas', () => {
  const muestra = c(7, 'oro'); // muestra NO es pieza
  it('orden 2 > 4 > 5 > 11 > 10 de la muestra', () => {
    expect(compareCards(c(2, 'oro'), c(4, 'oro'), muestra)).toBeGreaterThan(0);
    expect(compareCards(c(4, 'oro'), c(5, 'oro'), muestra)).toBeGreaterThan(0);
    expect(compareCards(c(5, 'oro'), c(11, 'oro'), muestra)).toBeGreaterThan(0);
    expect(compareCards(c(11, 'oro'), c(10, 'oro'), muestra)).toBeGreaterThan(0);
  });
  it('la pieza más baja (10) vence a la mata más alta (1 de espadas)', () => {
    expect(compareCards(c(10, 'oro'), c(1, 'espada'), muestra)).toBeGreaterThan(0);
  });
  it('marca la categoría como pieza', () => {
    expect(rankCard(c(2, 'oro'), muestra).category).toBe('pieza');
  });
});

describe('Excepción del Rey', () => {
  it('si la muestra es pieza (4 de oro), el 12 de oro pasa a ser pieza', () => {
    const muestra = c(4, 'oro');
    const slot = resolvePieces(muestra).find((s) => s.logicalRank === 4);
    expect(slot?.card).toEqual(c(12, 'oro'));
    expect(matchPiece(c(12, 'oro'), muestra)).not.toBeNull();
    // El 12 de oro hereda la fuerza de la pieza "4 de muestra".
    expect(rankCard(c(12, 'oro'), muestra).category).toBe('pieza');
    // Y vence al 2 de muestra? No: 2 > 4. Pero vence al 5 de muestra.
    expect(compareCards(c(12, 'oro'), c(5, 'oro'), muestra)).toBeGreaterThan(0);
  });
});

describe('Matas', () => {
  const muestra = c(3, 'copa');
  it('orden 1E > 1B > 7E > 7O', () => {
    expect(compareCards(c(1, 'espada'), c(1, 'basto'), muestra)).toBeGreaterThan(0);
    expect(compareCards(c(1, 'basto'), c(7, 'espada'), muestra)).toBeGreaterThan(0);
    expect(compareCards(c(7, 'espada'), c(7, 'oro'), muestra)).toBeGreaterThan(0);
  });
  it('una mata vence a cualquier carta común', () => {
    expect(compareCards(c(7, 'oro'), c(3, 'copa'), muestra)).toBeGreaterThan(0);
  });
});

describe('Cartas comunes', () => {
  const muestra = c(6, 'oro'); // muestra de oro ⇒ las cartas de copa no son piezas
  it('3 vence a 2, 2 vence a 1 (de copa/oro), etc.', () => {
    expect(compareCards(c(3, 'copa'), c(2, 'copa'), muestra)).toBeGreaterThan(0);
    expect(compareCards(c(2, 'copa'), c(1, 'copa'), muestra)).toBeGreaterThan(0);
    expect(compareCards(c(1, 'copa'), c(12, 'copa'), muestra)).toBeGreaterThan(0);
    expect(compareCards(c(12, 'copa'), c(11, 'copa'), muestra)).toBeGreaterThan(0);
  });
  it('el 7 de copa/basto es común (no mata)', () => {
    expect(rankCard(c(7, 'copa'), muestra).category).toBe('comun');
  });
});

describe('Empates (parda)', () => {
  const muestra = c(6, 'copa');
  it('dos 3 de distinto palo empatan', () => {
    expect(compareCards(c(3, 'oro'), c(3, 'basto'), muestra)).toBe(0);
  });
  it('dos 12 empatan', () => {
    expect(compareCards(c(12, 'oro'), c(12, 'espada'), muestra)).toBe(0);
  });
});
