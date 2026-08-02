import { describe, it, expect } from 'vitest';
import type { Card } from '../types';
import { calcFlor } from '../flor';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('calcFlor', () => {
  it('Caso 1: tres cartas del mismo palo ⇒ Flor; 7+6+3 = 36', () => {
    const r = calcFlor([c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], c(1, 'oro'));
    expect(r.hasFlor).toBe(true);
    expect(r.reason).toBe('tres_mismo_palo');
    expect(r.value).toBe(36);
  });

  it('Caso 2: dos piezas ⇒ Flor', () => {
    const muestra = c(7, 'oro'); // piezas: 2,4,5,11,10 de oro
    const r = calcFlor([c(2, 'oro'), c(4, 'oro'), c(6, 'copa')], muestra);
    expect(r.hasFlor).toBe(true);
    expect(r.reason).toBe('dos_piezas');
    // 20 + 10 (2 muestra) + 9 (4 muestra) + 6 = 45
    expect(r.value).toBe(45);
  });

  it('Caso 3: una pieza + dos cartas del mismo palo ⇒ Flor', () => {
    const muestra = c(7, 'oro'); // 5 de oro es pieza
    const r = calcFlor([c(5, 'oro'), c(6, 'copa'), c(4, 'copa')], muestra);
    expect(r.hasFlor).toBe(true);
    expect(r.reason).toBe('pieza_mas_dos_palo');
    // 20 + 8 (5 muestra) + 6 + 4 = 38
    expect(r.value).toBe(38);
  });

  it('mano sin Flor', () => {
    const r = calcFlor([c(1, 'espada'), c(6, 'copa'), c(4, 'basto')], c(3, 'oro'));
    expect(r.hasFlor).toBe(false);
    expect(r.value).toBe(0);
  });
});
