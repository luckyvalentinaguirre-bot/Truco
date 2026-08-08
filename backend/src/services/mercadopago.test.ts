/* =============================================================
 * Mercado Pago — mapeos y verificación de firma (sin red).
 * ============================================================= */
import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  mapPreapprovalStatus,
  mapPaymentStatus,
  isConfigured,
  verifyWebhookSignature,
} from './mercadopago.js';

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

describe('mercadopago · mapeos', () => {
  it('preapproval → estado de suscripción', () => {
    expect(mapPreapprovalStatus('authorized')).toBe('active');
    expect(mapPreapprovalStatus('pending')).toBe('pending');
    expect(mapPreapprovalStatus('paused')).toBe('past_due');
    expect(mapPreapprovalStatus('cancelled')).toBe('canceled');
    expect(mapPreapprovalStatus('lo_que_sea')).toBe('pending');
  });

  it('payment → estado de pago', () => {
    expect(mapPaymentStatus('approved')).toBe('succeeded');
    expect(mapPaymentStatus('refunded')).toBe('refunded');
    expect(mapPaymentStatus('rejected')).toBe('failed');
    expect(mapPaymentStatus('in_process')).toBe('pending');
  });
});

describe('mercadopago · configuración', () => {
  it('isConfigured según MP_ACCESS_TOKEN', () => {
    delete process.env.MP_ACCESS_TOKEN;
    expect(isConfigured()).toBe(false);
    process.env.MP_ACCESS_TOKEN = 'x';
    expect(isConfigured()).toBe(true);
  });
});

describe('mercadopago · verificación de firma del webhook', () => {
  function sign(secret: string, dataId: string, reqId: string, ts: string): string {
    const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return `ts=${ts},v1=${v1}`;
  }

  it('acepta una firma válida y rechaza una inválida', () => {
    process.env.MP_WEBHOOK_SECRET = 'secreto';
    const xSignature = sign('secreto', '123', 'req-1', '1700000000');
    expect(
      verifyWebhookSignature({ xSignature, xRequestId: 'req-1', dataId: '123' }),
    ).toBe(true);
    // Firma con otro secreto ⇒ inválida.
    const bad = sign('otro', '123', 'req-1', '1700000000');
    expect(verifyWebhookSignature({ xSignature: bad, xRequestId: 'req-1', dataId: '123' })).toBe(false);
  });

  it('sin secreto: permite en dev, rechaza en producción', () => {
    delete process.env.MP_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'development';
    expect(verifyWebhookSignature({ xSignature: undefined, xRequestId: undefined, dataId: '1' })).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(verifyWebhookSignature({ xSignature: undefined, xRequestId: undefined, dataId: '1' })).toBe(false);
  });
});
