import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayingCard } from '@/components/game/PlayingCard';
import type { Card } from '@/game';

function markup(props: Record<string, unknown>): string {
  return renderToStaticMarkup(createElement(PlayingCard, props));
}

describe('PlayingCard · usa exactamente el PNG real de cada carta', () => {
  const cases: [Card, string][] = [
    [{ suit: 'oro', rank: 3 }, '/cartas_truco/OROS/oros-3.png'],
    [{ suit: 'copa', rank: 7 }, '/cartas_truco/COPAS/copas-7.png'],
    [{ suit: 'espada', rank: 1 }, '/cartas_truco/ESPADAS/espadas-1.png'],
    [{ suit: 'basto', rank: 12 }, '/cartas_truco/BASTOS/bastos-12.png'],
    [{ suit: 'oro', rank: 12 }, '/cartas_truco/OROS/oros-12.png'],
    [{ suit: 'espada', rank: 7 }, '/cartas_truco/ESPADAS/espadas-7.png'],
  ];

  it.each(cases)('%o → %s', (card, src) => {
    const html = markup({ card });
    expect(html).toContain(`src="${src}"`);
  });

  it('carta oculta (faceDown) usa card_back.png', () => {
    expect(markup({ faceDown: true })).toContain('src="/cartas_truco/card_back.png"');
  });

  it('sin carta usa card_back.png', () => {
    expect(markup({})).toContain('src="/cartas_truco/card_back.png"');
  });

  it('ser pieza NO cambia el asset (misma imagen)', () => {
    const normal = markup({ card: { suit: 'oro', rank: 2 } });
    const pieza = markup({ card: { suit: 'oro', rank: 2 }, pieza: true });
    expect(normal).toContain('src="/cartas_truco/OROS/oros-2.png"');
    expect(pieza).toContain('src="/cartas_truco/OROS/oros-2.png"');
  });
});
