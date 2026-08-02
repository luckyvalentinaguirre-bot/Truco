import { describe, it, expect } from 'vitest';
import type { Card } from '../types';
import { calcEnvido, faltaEnvidoPoints } from '../envido';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('calcEnvido', () => {
  const noPieza = c(1, 'copa'); // muestra sin relación con los ejemplos

  it('dos cartas del mismo palo: 20 + ambas', () => {
    expect(
      calcEnvido([c(7, 'espada'), c(6, 'espada'), c(4, 'oro')], noPieza).value,
    ).toBe(33);
  });

  it('tres palos diferentes: la carta más alta', () => {
    expect(
      calcEnvido([c(7, 'copa'), c(4, 'basto'), c(2, 'espada')], noPieza).value,
    ).toBe(7);
  });

  it('las figuras valen 0 para el envido (sin piezas)', () => {
    // muestra de oro ⇒ 11/10 de copa/basto NO son piezas.
    expect(
      calcEnvido([c(12, 'oro'), c(11, 'copa'), c(10, 'basto')], c(3, 'oro')).value,
    ).toBe(0);
  });

  it('con pieza: 4 de muestra + 7 de otro palo = 36', () => {
    const muestra = c(4, 'oro'); // el 12 de oro es la pieza "4 de muestra"
    expect(
      calcEnvido([c(12, 'oro'), c(7, 'copa'), c(5, 'basto')], muestra).value,
    ).toBe(36);
  });

  it('máximo normal = 37 (pieza de 30 + 7)', () => {
    const muestra = c(7, 'basto'); // muestra no-pieza ⇒ 2 de muestra existe
    // Necesitamos el 2 de la muestra (=30) + un 7.
    const v = calcEnvido([c(2, 'basto'), c(7, 'oro'), c(4, 'copa')], muestra).value;
    expect(v).toBe(37);
  });
});

describe('faltaEnvidoPoints', () => {
  it('depende del marcador: lo que le falta al líder', () => {
    expect(faltaEnvidoPoints(30, 12, 40)).toBe(10);
    expect(faltaEnvidoPoints(0, 0, 40)).toBe(40);
  });
});
