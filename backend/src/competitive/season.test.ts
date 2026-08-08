/* =============================================================
 * §53 · Temporadas: upcoming → active → finished; sin perder historial.
 * §52 · Rangos derivados del ELO.
 * ============================================================= */
import { describe, it, expect } from 'vitest';
import { seasonStatus, activeSeason, type Season } from './season.js';
import { rankByRating, RANK_TIERS } from './ranks.js';

const day = 24 * 3600_000;
const NOW = 1_000_000_000_000;

const s = (id: string, startOffset: number, endOffset: number): Season => ({
  id,
  name: id,
  startsAt: NOW + startOffset,
  endsAt: NOW + endOffset,
});

describe('season · seasonStatus', () => {
  it('antes del inicio ⇒ upcoming', () => {
    expect(seasonStatus(s('t2', day, 30 * day), NOW)).toBe('upcoming');
  });
  it('dentro del rango ⇒ active', () => {
    expect(seasonStatus(s('t1', -day, 30 * day), NOW)).toBe('active');
  });
  it('después del fin ⇒ finished', () => {
    expect(seasonStatus(s('t0', -60 * day, -30 * day), NOW)).toBe('finished');
  });
  it('transición: T1 termina justo cuando T2 empieza; sólo una activa', () => {
    const t1 = s('t1', -30 * day, 0); // termina en NOW
    const t2 = s('t2', 0, 30 * day); // empieza en NOW
    expect(seasonStatus(t1, NOW)).toBe('finished');
    expect(seasonStatus(t2, NOW)).toBe('active');
    expect(activeSeason([t1, t2], NOW)?.id).toBe('t2');
  });
});

describe('ranks · rankByRating (server-authoritative)', () => {
  it('ELO bajo ⇒ principiante', () => {
    expect(rankByRating(0).id).toBe('principiante');
    expect(rankByRating(799).id).toBe('principiante');
  });
  it('umbrales exactos suben de rango', () => {
    expect(rankByRating(800).id).toBe('mate');
    expect(rankByRating(1400).id).toBe('flor');
    expect(rankByRating(2300).id).toBe('vale4');
  });
  it('ELO altísimo ⇒ el rango más alto', () => {
    expect(rankByRating(9999).id).toBe(RANK_TIERS[RANK_TIERS.length - 1]!.id);
  });
  it('monótono: nunca baja de rango al subir de ELO', () => {
    let lastOrder = -1;
    for (let r = 0; r <= 3000; r += 50) {
      const order = rankByRating(r).order;
      expect(order).toBeGreaterThanOrEqual(lastOrder);
      lastOrder = order;
    }
  });
});
