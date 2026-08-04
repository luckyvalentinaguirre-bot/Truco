import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { closePool } from '../db/pool.js';
import { hasDatabase, prepareSchema, truncateAll } from '../repositories/testDb.js';
import { createHttpServer } from '../server/http.js';
import { createAccount } from '../services/account.service.js';
import { createSession } from '../services/session.service.js';

const d = hasDatabase ? describe : describe.skip;

let server: Server;
let base: string;

async function req(
  method: string,
  path: string,
  opts: { body?: unknown; json?: boolean; token?: string } = {},
): Promise<{ status: number; text: string; json: () => unknown }> {
  const headers: Record<string, string> = {};
  let bodyStr: string | undefined;
  if (opts.body !== undefined) {
    bodyStr = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    if (opts.json !== false) headers['Content-Type'] = 'application/json';
  }
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: bodyStr });
  const text = await res.text();
  return { status: res.status, text, json: () => (text ? JSON.parse(text) : null) };
}

d('HTTP · /auth/*', () => {
  beforeAll(async () => {
    await prepareSchema();
    server = createHttpServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  const CREDS = { email: 'user@mail.com', password: 'clavefuerte9', username: 'Usuario1' };

  // ---- REGISTER ----
  it('register correcto ⇒ 201 y datos públicos sin password/hash', async () => {
    const r = await req('POST', '/auth/register', { body: CREDS });
    expect(r.status).toBe(201);
    const b = r.json() as { user: { id: string; email: string } };
    expect(b.user.email).toBe('user@mail.com');
    expect(r.text).not.toMatch(/password|hash/i);
    expect(r.text).not.toContain('clavefuerte9');
  });

  it('register email duplicado ⇒ 409', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    const r = await req('POST', '/auth/register', {
      body: { ...CREDS, username: 'Otro' },
    });
    expect(r.status).toBe(409);
  });

  it('register username duplicado ⇒ 409', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    const r = await req('POST', '/auth/register', {
      body: { ...CREDS, email: 'otro@mail.com' },
    });
    expect(r.status).toBe(409);
  });

  it('register datos inválidos ⇒ 400', async () => {
    const r = await req('POST', '/auth/register', {
      body: { email: 'no-email', password: 'x', username: '!' },
    });
    expect(r.status).toBe(400);
  });

  it('register JSON inválido ⇒ 400', async () => {
    const r = await req('POST', '/auth/register', { body: '{ roto', json: true });
    expect(r.status).toBe(400);
  });

  it('register sin Content-Type JSON ⇒ 415', async () => {
    const r = await req('POST', '/auth/register', { body: '{}', json: false });
    expect(r.status).toBe(415);
  });

  // ---- LOGIN ----
  it('login correcto ⇒ 200 + token + identidad mínima (sin hash)', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    const r = await req('POST', '/auth/login', {
      body: { email: CREDS.email, password: CREDS.password },
    });
    expect(r.status).toBe(200);
    const b = r.json() as { token: string; user: { id: string; email: string } };
    expect(b.token).toBeTruthy();
    expect(b.user.email).toBe('user@mail.com');
    expect(r.text).not.toMatch(/hash/i);
    expect(r.text).not.toContain(CREDS.password);
  });

  it('login password incorrecta ⇒ 401', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    const r = await req('POST', '/auth/login', {
      body: { email: CREDS.email, password: 'malmalmal1' },
    });
    expect(r.status).toBe(401);
  });

  it('login email inexistente ⇒ 401', async () => {
    const r = await req('POST', '/auth/login', {
      body: { email: 'nadie@mail.com', password: CREDS.password },
    });
    expect(r.status).toBe(401);
  });

  // ---- LOGOUT ----
  it('logout con Bearer válido ⇒ 204', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    const login = (await req('POST', '/auth/login', {
      body: { email: CREDS.email, password: CREDS.password },
    })).json() as { token: string };
    const r = await req('POST', '/auth/logout', { token: login.token });
    expect(r.status).toBe(204);
    expect(r.text).toBe('');
  });

  it('logout token inexistente ⇒ 204 (idempotente/seguro)', async () => {
    const r = await req('POST', '/auth/logout', { token: 'no-existe' });
    expect(r.status).toBe(204);
    expect(r.text).not.toContain('no-existe');
  });

  it('logout sin Authorization ⇒ 401', async () => {
    const r = await req('POST', '/auth/logout', {});
    expect(r.status).toBe(401);
  });

  // ---- ME ----
  it('me con Bearer válido ⇒ 200 con user/profile (sin datos sensibles)', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    const login = (await req('POST', '/auth/login', {
      body: { email: CREDS.email, password: CREDS.password },
    })).json() as { token: string };
    const r = await req('GET', '/auth/me', { token: login.token });
    expect(r.status).toBe(200);
    const b = r.json() as { user: { email: string }; profile: { username: string } };
    expect(b.user.email).toBe('user@mail.com');
    expect(b.profile.username).toBe('Usuario1');
    expect(r.text).not.toMatch(/password|hash/i);
    expect(r.text).not.toContain(login.token);
  });

  it('me sin Authorization ⇒ 401', async () => {
    const r = await req('GET', '/auth/me', {});
    expect(r.status).toBe(401);
  });

  it('me token inválido ⇒ 401', async () => {
    const r = await req('GET', '/auth/me', { token: 'invalido' });
    expect(r.status).toBe(401);
  });

  it('me sesión expirada ⇒ 401', async () => {
    const acc = await createAccount({ ...CREDS, email: 'exp@mail.com', username: 'ExpUser' });
    const expired = await createSession(acc.id, -1000);
    const r = await req('GET', '/auth/me', { token: expired.token });
    expect(r.status).toBe(401);
  });

  // ---- healthz sigue vivo ----
  it('/healthz sigue respondiendo 200 {status:ok}', async () => {
    const r = await req('GET', '/healthz', {});
    expect(r.status).toBe(200);
    expect(r.json()).toEqual({ status: 'ok' });
  });
});
