import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '../server/http.js';

const ALLOWED = 'http://localhost:5173';
const DENIED = 'http://evil.example.com';

let server: Server;
let base: string;

// CORS no depende de la base de datos: estos tests corren siempre.
describe('HTTP · CORS', () => {
  beforeAll(async () => {
    process.env.CORS_ORIGINS = ALLOWED;
    server = createHttpServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it('origin permitido ⇒ headers CORS correctos', async () => {
    const res = await fetch(`${base}/healthz`, { headers: { Origin: ALLOWED } });
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    expect(res.headers.get('vary')).toContain('Origin');
    expect(res.status).toBe(200);
  });

  it('origin NO permitido ⇒ no concede CORS', async () => {
    const res = await fetch(`${base}/healthz`, { headers: { Origin: DENIED } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    // El endpoint sigue respondiendo normal (el bloqueo lo hace el navegador).
    expect(res.status).toBe(200);
  });

  it('preflight OPTIONS permitido ⇒ 204 con métodos y headers', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    const allowHeaders = res.headers.get('access-control-allow-headers') ?? '';
    expect(allowHeaders).toContain('Authorization');
    expect(allowHeaders).toContain('Content-Type');
  });

  it('preflight de origin NO permitido ⇒ 204 sin headers CORS', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: DENIED, 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('/healthz sigue funcionando (sin Origin)', async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
