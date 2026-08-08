/* =============================================================
 * §17 · Rate limiting de rutas sensibles.
 * ============================================================= */
import { describe, it, expect, beforeEach } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { rateLimit, clientIp, __resetRateLimit } from './rateLimit.js';
import { HttpError } from './httpError.js';

/** Request mínimo simulado con IP controlable. */
function fakeReq(ip: string, forwarded?: string): IncomingMessage {
  return {
    headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
    socket: { remoteAddress: ip },
  } as unknown as IncomingMessage;
}

describe('rateLimit (§17)', () => {
  beforeEach(() => __resetRateLimit());

  it('permite hasta el máximo y luego lanza 429', () => {
    const req = fakeReq('1.2.3.4');
    for (let i = 0; i < 3; i++) {
      expect(() => rateLimit(req, 'login', { max: 3, windowMs: 1000 })).not.toThrow();
    }
    try {
      rateLimit(req, 'login', { max: 3, windowMs: 1000 });
      throw new Error('debería haber lanzado');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(429);
    }
  });

  it('IPs distintas tienen cubetas independientes', () => {
    const a = fakeReq('1.1.1.1');
    const b = fakeReq('2.2.2.2');
    rateLimit(a, 'login', { max: 1, windowMs: 1000 });
    expect(() => rateLimit(b, 'login', { max: 1, windowMs: 1000 })).not.toThrow();
    expect(() => rateLimit(a, 'login', { max: 1, windowMs: 1000 })).toThrow();
  });

  it('acciones distintas no comparten cubeta', () => {
    const req = fakeReq('9.9.9.9');
    rateLimit(req, 'login', { max: 1, windowMs: 1000 });
    expect(() => rateLimit(req, 'register', { max: 1, windowMs: 1000 })).not.toThrow();
  });

  it('la ventana se reinicia cuando expira', async () => {
    const req = fakeReq('5.5.5.5');
    rateLimit(req, 'login', { max: 1, windowMs: 20 });
    expect(() => rateLimit(req, 'login', { max: 1, windowMs: 20 })).toThrow();
    await new Promise((r) => setTimeout(r, 30));
    expect(() => rateLimit(req, 'login', { max: 1, windowMs: 20 })).not.toThrow();
  });

  it('clientIp prioriza el primer hop de x-forwarded-for (proxy de Render)', () => {
    expect(clientIp(fakeReq('10.0.0.1', '203.0.113.7, 10.0.0.1'))).toBe('203.0.113.7');
    expect(clientIp(fakeReq('10.0.0.1'))).toBe('10.0.0.1');
  });
});
