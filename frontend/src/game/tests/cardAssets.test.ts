import { describe, it, expect } from 'vitest';
import {
  getCardAsset,
  getCardBackAsset,
  allCards,
} from '../../components/game/cardAssets';

describe('getCardAsset · vinculación exacta palo+valor → PNG', () => {
  it('mapea los ejemplos exigidos', () => {
    expect(getCardAsset({ suit: 'oro', rank: 3 })).toBe('/cartas_truco/OROS/oros-3.png');
    expect(getCardAsset({ suit: 'copa', rank: 7 })).toBe('/cartas_truco/COPAS/copas-7.png');
    expect(getCardAsset({ suit: 'espada', rank: 1 })).toBe('/cartas_truco/ESPADAS/espadas-1.png');
    expect(getCardAsset({ suit: 'basto', rank: 12 })).toBe('/cartas_truco/BASTOS/bastos-12.png');
  });

  it('carpetas en MAYÚSCULAS y archivos en minúsculas para todo palo', () => {
    expect(getCardAsset({ suit: 'oro', rank: 10 })).toBe('/cartas_truco/OROS/oros-10.png');
    expect(getCardAsset({ suit: 'copa', rank: 11 })).toBe('/cartas_truco/COPAS/copas-11.png');
    expect(getCardAsset({ suit: 'espada', rank: 12 })).toBe('/cartas_truco/ESPADAS/espadas-12.png');
    expect(getCardAsset({ suit: 'basto', rank: 1 })).toBe('/cartas_truco/BASTOS/bastos-1.png');
  });

  it('el reverso es card_back.png (con guion bajo)', () => {
    expect(getCardBackAsset()).toBe('/cartas_truco/card_back.png');
  });

  it('las 40 cartas producen 40 rutas únicas y ninguna con 8/9', () => {
    const cards = allCards();
    expect(cards).toHaveLength(40);
    const paths = cards.map(getCardAsset);
    expect(new Set(paths).size).toBe(40);
    expect(paths.some((p) => /-(8|9)\.png$/.test(p))).toBe(false);
  });

  it('rechaza palo o valor inválidos (no inventa asset)', () => {
    // @ts-expect-error palo inválido
    expect(() => getCardAsset({ suit: 'diamante', rank: 3 })).toThrow();
    // @ts-expect-error valor inexistente en la baraja española
    expect(() => getCardAsset({ suit: 'oro', rank: 8 })).toThrow();
  });
});
