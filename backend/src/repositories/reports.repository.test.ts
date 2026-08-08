/* =============================================================
 * Integración · Reportes (crear, listar, resolver).
 * ============================================================= */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { hasDatabase, prepareSchema, truncateAll } from './testDb.js';
import { closePool } from '../db/pool.js';
import { createAccount } from '../services/account.service.js';
import { createReport, listReports, resolveReport } from './reports.repository.js';

const d = hasDatabase ? describe : describe.skip;

d('reportes', () => {
  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  async function user(n: number, name: string) {
    return (await createAccount({ email: `rep${n}@mail.com`, password: 'clavefuerte9', username: name })).id;
  }

  it('crear → aparece como abierto → resolver lo saca de abiertos', async () => {
    const a = await user(1, 'Reporter');
    const b = await user(2, 'Target');
    await createReport(a, b, 'insultos');

    const open = await listReports('open');
    expect(open).toHaveLength(1);
    expect(open[0]!.targetUsername).toBe('Target');

    const ok = await resolveReport(open[0]!.id, a, 'resolved');
    expect(ok).toBe(true);
    expect(await listReports('open')).toHaveLength(0);
    expect(await listReports('resolved')).toHaveLength(1);
  });
});
