import { describe, it, expect } from 'vitest';
import type { Card } from '../types.js';
import { availableSenas } from '../senasEngine.js';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const ids = (cards: Card[], muestra: Card) =>
  availableSenas(cards, muestra).map((s) => s.id);

describe('availableSenas', () => {
  it('detecta la seña de una pieza (2 de la muestra)', () => {
    const muestra = c(7, 'oro'); // 2 de oro es pieza
    expect(ids([c(2, 'oro'), c(4, 'copa'), c(6, 'basto')], muestra)).toContain('pieza-2');
  });

  it('detecta señas de matas', () => {
    const muestra = c(3, 'copa');
    const got = ids([c(1, 'espada'), c(7, 'oro'), c(6, 'basto')], muestra);
    expect(got).toContain('mata-1e');
    expect(got).toContain('mata-7o');
  });

  it('detecta señas genéricas (cualquier 3 / cualquier 2)', () => {
    const muestra = c(6, 'copa');
    // 2 de espada (no es pieza porque la muestra es de copa) ⇒ any-2.
    const got = ids([c(3, 'basto'), c(2, 'espada'), c(4, 'oro')], muestra);
    expect(got).toContain('any-3');
    expect(got).toContain('any-2');
  });

  it('la excepción del Rey habilita la seña de la pieza correspondiente', () => {
    const muestra = c(4, 'oro'); // 12 de oro pasa a ser pieza "4 de muestra"
    expect(ids([c(12, 'oro'), c(6, 'copa'), c(5, 'basto')], muestra)).toContain('pieza-4');
  });

  it('mano de cartas malas ⇒ seña de malas', () => {
    const muestra = c(3, 'oro');
    // 1 de copa (común, rank<3), 12/11 no aplican <3... usar cartas bajas comunes.
    const got = ids([c(1, 'copa'), c(1, 'oro'), c(2, 'copa')], muestra);
    // Hay un 2 ⇒ no todas son "malas" (rank<3 pero el 2 dispara any-2).
    expect(got).toContain('any-2');
  });
});
