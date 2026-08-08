/* =============================================================
 * Integración · Pagos: idempotencia por provider_event_id + historial.
 * ============================================================= */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { hasDatabase, prepareSchema, truncateAll } from './testDb.js';
import { closePool } from '../db/pool.js';
import { createAccount } from '../services/account.service.js';
import { recordPayment, listUserPayments } from './payments.repository.js';

const d = hasDatabase ? describe : describe.skip;

d('pagos', () => {
  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it('webhook repetido NO registra el pago dos veces (idempotente)', async () => {
    const a = await createAccount({ email: 'pay@mail.com', password: 'clavefuerte9', username: 'Payer' });
    const input = {
      userId: a.id,
      provider: 'mercadopago',
      providerEventId: 'evt-1',
      amountCents: 300,
      currency: 'UYU',
      status: 'succeeded' as const,
    };
    expect(await recordPayment(input)).toBe(true); // primer webhook: inserta
    expect(await recordPayment(input)).toBe(false); // repetido: no inserta

    const list = await listUserPayments(a.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.amountCents).toBe(300);
  });
});
