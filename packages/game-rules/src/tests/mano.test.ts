import { describe, it, expect } from 'vitest';
import { manoOrder, manoRank, hasManoOver } from '../setup.js';
import type { Seat } from '../types.js';

/* =============================================================
 * PRIORIDAD DE MANO
 * La "mano" es un orden de prioridad circular entre TODOS los
 * jugadores, empezando por el mano y girando en el sentido del
 * reparto. No depende del equipo.
 * ============================================================= */

describe('prioridad de mano — 1v1 (2 jugadores)', () => {
  it('con mano=0: 0 > 1', () => {
    expect(manoOrder(0, 2)).toEqual([0, 1]);
    expect(hasManoOver(0, 1, 0, 2)).toBe(true);
    expect(hasManoOver(1, 0, 0, 2)).toBe(false);
  });

  it('rota: con mano=1: 1 > 0', () => {
    expect(manoOrder(1, 2)).toEqual([1, 0]);
    expect(hasManoOver(1, 0, 1, 2)).toBe(true);
    expect(hasManoOver(0, 1, 1, 2)).toBe(false);
  });
});

describe('prioridad de mano — 2v2 (4 jugadores)', () => {
  it('con mano=0: 0 > 1 > 2 > 3', () => {
    expect(manoOrder(0, 4)).toEqual([0, 1, 2, 3]);
    expect(hasManoOver(0, 3, 0, 4)).toBe(true);
    expect(hasManoOver(2, 3, 0, 4)).toBe(true);
    expect(hasManoOver(3, 2, 0, 4)).toBe(false);
  });

  it('rota a mano=1: 1 > 2 > 3 > 0', () => {
    expect(manoOrder(1, 4)).toEqual([1, 2, 3, 0]);
    expect(hasManoOver(1, 0, 1, 4)).toBe(true);
    expect(hasManoOver(3, 0, 1, 4)).toBe(true);
    expect(hasManoOver(0, 3, 1, 4)).toBe(false);
  });

  it('rota a mano=2: 2 > 3 > 0 > 1', () => {
    expect(manoOrder(2, 4)).toEqual([2, 3, 0, 1]);
    expect(hasManoOver(2, 1, 2, 4)).toBe(true);
    expect(hasManoOver(0, 1, 2, 4)).toBe(true);
    expect(hasManoOver(1, 0, 2, 4)).toBe(false);
  });

  it('la prioridad NO depende del equipo (compañeros y rivales igual)', () => {
    // Equipos alternados A-B-A-B → 0,2 = A ; 1,3 = B. Con mano=0, entre el
    // rival (1) y el compañero (2), el 1 es más mano por su lugar en la mesa.
    expect(hasManoOver(1, 2, 0, 4)).toBe(true);
    // Y entre dos compañeros del mismo equipo (0 y 2), 0 es más mano.
    expect(hasManoOver(0, 2, 0, 4)).toBe(true);
  });
});

describe('prioridad de mano — 3v3 (6 jugadores)', () => {
  it('con mano=0: 0 > 1 > 2 > 3 > 4 > 5', () => {
    expect(manoOrder(0, 6)).toEqual([0, 1, 2, 3, 4, 5]);
    for (let i = 0; i < 5; i++) {
      expect(hasManoOver(i as Seat, (i + 1) as Seat, 0, 6)).toBe(true);
    }
  });

  it('incluye a los 6 jugadores y rota circularmente (mano=4)', () => {
    expect(manoOrder(4, 6)).toEqual([4, 5, 0, 1, 2, 3]);
    expect(manoRank(4, 4, 6)).toBe(0); // el más mano
    expect(manoRank(3, 4, 6)).toBe(5); // el menos mano
    expect(hasManoOver(5, 0, 4, 6)).toBe(true);
    expect(hasManoOver(0, 5, 4, 6)).toBe(false);
  });

  it('rango bien definido para todos los asientos', () => {
    const order = manoOrder(2, 6);
    order.forEach((seat, rank) => {
      expect(manoRank(seat, 2, 6)).toBe(rank);
    });
  });
});
