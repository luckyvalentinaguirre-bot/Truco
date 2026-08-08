/* =============================================================
 * Integración · ensureActiveSeason (bootstrap de temporada).
 * ============================================================= */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { hasDatabase, prepareSchema, truncateAll } from '../repositories/testDb.js';
import { closePool, query } from '../db/pool.js';
import { ensureActiveSeason } from './season.service.js';
import { getActiveSeason } from '../repositories/seasons.repository.js';

const d = hasDatabase ? describe : describe.skip;

d('ensureActiveSeason', () => {
  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await query('TRUNCATE seasons CASCADE');
    await truncateAll();
  });

  it('crea una temporada si no hay ninguna vigente', async () => {
    expect(await getActiveSeason()).toBeNull();
    const s = await ensureActiveSeason();
    expect(s).toBeTruthy();
    expect(await getActiveSeason()).not.toBeNull();
  });

  it('no crea una segunda si ya hay una vigente', async () => {
    const first = await ensureActiveSeason();
    const again = await ensureActiveSeason();
    expect(again.id).toBe(first.id);
    const all = await query<{ n: string }>('SELECT count(*)::text AS n FROM seasons');
    expect(all.rows[0]!.n).toBe('1');
  });
});
