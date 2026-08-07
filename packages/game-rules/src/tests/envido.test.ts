import { describe, it, expect } from 'vitest';
import type { Card } from '../types.js';
import { calcEnvido, faltaEnvidoPoints } from '../envido.js';

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

  it('dos piezas suman sus APORTES, no sus valores (2+4 = 39, no 59)', () => {
    const muestra = c(7, 'basto'); // muestra no-pieza ⇒ 2 y 4 de basto son piezas
    // 2 de basto (aporte 10) + 4 de basto (aporte 9) ⇒ 20 + 10 + 9 = 39.
    const v = calcEnvido([c(2, 'basto'), c(4, 'basto'), c(6, 'copa')], muestra).value;
    expect(v).toBe(39);
  });

  it('una pieza sola (resto figuras de otro palo) = valor de la pieza', () => {
    const muestra = c(7, 'basto'); // 2 de basto es pieza (30)
    // 2 de basto (30) + 12 oro (0) + 11 copa (0) ⇒ 30.
    const v = calcEnvido([c(2, 'basto'), c(12, 'oro'), c(11, 'copa')], muestra).value;
    expect(v).toBe(30);
  });

  it('muestra que ES pieza: el 12 sustituye y combina con el número del palo', () => {
    const muestra = c(5, 'espada'); // 12 de espada ocupa la pieza "5" (28)
    // 12 de espada (pieza 28) + 5 de espada (común, 5 unidades) ⇒ 20 + 8 + 5 = 33.
    const v = calcEnvido([c(12, 'espada'), c(5, 'espada'), c(3, 'oro')], muestra).value;
    expect(v).toBe(33);
  });
});

describe('faltaEnvidoPoints', () => {
  it('depende del marcador: lo que le falta al líder', () => {
    expect(faltaEnvidoPoints(30, 12, 40)).toBe(10);
    expect(faltaEnvidoPoints(0, 0, 40)).toBe(40);
  });
});
