import { describe, it, expect } from 'vitest';
import { envidoWinnerFrom, type EnvidoEntry } from '../engine.js';

/* =============================================================
 * RESOLUCIÓN DEL ENVIDO (showdown de tantos)
 * Gana el tanto más alto; empate ⇒ gana el que tiene MANO
 * (prioridad circular, independiente del equipo). Sin azar.
 * ============================================================= */

describe('envido — gana el mayor tanto', () => {
  it('A=27 vs B=24 ⇒ gana A', () => {
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 27 },
      { seat: 1, team: 'B', value: 24 },
    ];
    expect(envidoWinnerFrom(entries, 0, 2)).toBe('A');
  });

  it('A=28 vs B=25 ⇒ gana A (más tantos)', () => {
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 28 },
      { seat: 1, team: 'B', value: 25 },
    ];
    expect(envidoWinnerFrom(entries, 0, 2)).toBe('A');
  });

  it('el orden de la lista no cambia el resultado', () => {
    const entries: EnvidoEntry[] = [
      { seat: 1, team: 'B', value: 33 },
      { seat: 0, team: 'A', value: 20 },
    ];
    expect(envidoWinnerFrom(entries, 0, 2)).toBe('B');
  });
});

describe('envido — empate se resuelve por MANO (nunca al azar)', () => {
  it('1v1: A=27, B=27, mano=0 ⇒ gana A', () => {
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 27 },
      { seat: 1, team: 'B', value: 27 },
    ];
    expect(envidoWinnerFrom(entries, 0, 2)).toBe('A');
  });

  it('1v1: mismo empate pero mano=1 ⇒ gana B', () => {
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 27 },
      { seat: 1, team: 'B', value: 27 },
    ];
    expect(envidoWinnerFrom(entries, 1, 2)).toBe('B');
  });

  it('es determinista: mismas entradas ⇒ mismo ganador siempre', () => {
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 27 },
      { seat: 1, team: 'B', value: 27 },
    ];
    for (let i = 0; i < 20; i++) {
      expect(envidoWinnerFrom(entries, 0, 2)).toBe('A');
    }
  });
});

describe('envido 2v2 — empate por mano con el orden de la mesa', () => {
  // Asientos 0,2 = equipo A ; 1,3 = equipo B (alternados).
  it('A(0) y A(2) empatan en 27, mano=0 ⇒ gana A (0 es más mano)', () => {
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 27 },
      { seat: 1, team: 'B', value: 20 },
      { seat: 2, team: 'A', value: 27 },
      { seat: 3, team: 'B', value: 22 },
    ];
    expect(envidoWinnerFrom(entries, 0, 4)).toBe('A');
  });

  it('empate entre RIVALES: A(2)=27 y B(3)=27, mano=2 ⇒ gana A (2 antes que 3)', () => {
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 10 },
      { seat: 1, team: 'B', value: 12 },
      { seat: 2, team: 'A', value: 27 },
      { seat: 3, team: 'B', value: 27 },
    ];
    expect(envidoWinnerFrom(entries, 2, 4)).toBe('A');
  });

  it('empate entre rivales A(0) y B(3) con mano=1 ⇒ gana B (3 es más mano que 0)', () => {
    // Orden mano=1: [1,2,3,0] ⇒ 3 tiene rango 2, 0 tiene rango 3.
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 27 },
      { seat: 1, team: 'B', value: 15 },
      { seat: 2, team: 'A', value: 15 },
      { seat: 3, team: 'B', value: 27 },
    ];
    expect(envidoWinnerFrom(entries, 1, 4)).toBe('B');
  });
});

describe('envido 3v3 — incluye a los 6 y empata por mano', () => {
  it('empate máximo entre 3 jugadores ⇒ gana el más mano', () => {
    // mano=3 ⇒ orden [3,4,5,0,1,2]. Empatan en 31 los asientos 5(A? ) ...
    // Equipos: 0,2,4=A ; 1,3,5=B.
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 31 },
      { seat: 1, team: 'B', value: 20 },
      { seat: 2, team: 'A', value: 25 },
      { seat: 3, team: 'B', value: 31 },
      { seat: 4, team: 'A', value: 18 },
      { seat: 5, team: 'B', value: 31 },
    ];
    // Empatan 0(A), 3(B), 5(B) en 31. Orden mano=3: 3 primero ⇒ gana B.
    expect(envidoWinnerFrom(entries, 3, 6)).toBe('B');
  });

  it('mismo empate pero mano=6→0 ⇒ gana A (asiento 0 es el más mano)', () => {
    const entries: EnvidoEntry[] = [
      { seat: 0, team: 'A', value: 31 },
      { seat: 1, team: 'B', value: 20 },
      { seat: 2, team: 'A', value: 25 },
      { seat: 3, team: 'B', value: 31 },
      { seat: 4, team: 'A', value: 18 },
      { seat: 5, team: 'B', value: 31 },
    ];
    expect(envidoWinnerFrom(entries, 0, 6)).toBe('A');
  });
});
