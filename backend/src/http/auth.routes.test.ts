import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { closePool } from '../db/pool.js';
import { hasDatabase, prepareSchema, truncateAll } from '../repositories/testDb.js';
import { createHttpServer } from '../server/http.js';
import { createAccount } from '../services/account.service.js';
import { createSession } from '../services/session.service.js';
import { SESSION_COOKIE, sessionSetCookie } from './cookies.js';

const d = hasDatabase ? describe : describe.skip;

let server: Server;
let base: string;

interface Res {
  status: number;
  text: string;
  json: () => unknown;
  setCookie: string | null;
}

async function req(
  method: string,
  path: string,
  opts: { body?: unknown; json?: boolean; cookie?: string } = {},
): Promise<Res> {
  const headers: Record<string, string> = {};
  let bodyStr: string | undefined;
  if (opts.body !== undefined) {
    bodyStr = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    if (opts.json !== false) headers['Content-Type'] = 'application/json';
  }
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  const res = await fetch(`${base}${path}`, { method, headers, body: bodyStr });
  const text = await res.text();
  return {
    status: res.status,
    text,
    json: () => (text ? JSON.parse(text) : null),
    setCookie: res.headers.get('set-cookie'),
  };
}

/** Extrae el par `session=<token>` de un Set-Cookie para reenviarlo como Cookie. */
function cookiePair(setCookie: string | null): string {
  return (setCookie ?? '').split(';')[0];
}

const CREDS = { email: 'user@mail.com', password: 'clavefuerte9', username: 'Usuario1' };

/** Registra e inicia sesión; devuelve la cookie de sesión lista para usar. */
async function loginCookie(): Promise<string> {
  await req('POST', '/auth/register', { body: CREDS });
  const r = await req('POST', '/auth/login', {
    body: { email: CREDS.email, password: CREDS.password },
  });
  return cookiePair(r.setCookie);
}

d('HTTP · /auth/* (cookie de sesión)', () => {
  beforeAll(async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    await prepareSchema();
    server = createHttpServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  // ---- REGISTER ----
  it('register correcto ⇒ 201 sin token ni Set-Cookie de sesión', async () => {
    const r = await req('POST', '/auth/register', { body: CREDS });
    expect(r.status).toBe(201);
    expect(r.text).not.toMatch(/password|hash|token/i);
    expect(r.setCookie).toBeNull(); // register NO inicia sesión
  });

  it('register email duplicado ⇒ 409', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    expect((await req('POST', '/auth/register', { body: { ...CREDS, username: 'Otro' } })).status).toBe(409);
  });

  it('register username duplicado ⇒ 409', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    expect((await req('POST', '/auth/register', { body: { ...CREDS, email: 'o@mail.com' } })).status).toBe(409);
  });

  it('register datos inválidos ⇒ 400', async () => {
    expect((await req('POST', '/auth/register', { body: { email: 'x', password: 'y', username: '!' } })).status).toBe(400);
  });

  it('register JSON inválido ⇒ 400', async () => {
    expect((await req('POST', '/auth/register', { body: '{ roto', json: true })).status).toBe(400);
  });

  // ---- LOGIN ----
  it('login correcto ⇒ 200, Set-Cookie HttpOnly y SIN token en el JSON', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    const r = await req('POST', '/auth/login', { body: { email: CREDS.email, password: CREDS.password } });
    expect(r.status).toBe(200);
    // Respuesta: sólo identidad pública, sin token/hash/password.
    const b = r.json() as { user: { id: string; email: string }; token?: string };
    expect(b.user.email).toBe('user@mail.com');
    expect(b.token).toBeUndefined();
    expect(r.text).not.toMatch(/token|hash|password/i);
    // Cookie de sesión con atributos correctos.
    const sc = r.setCookie ?? '';
    expect(sc).toContain(`${SESSION_COOKIE}=`);
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/Path=\//i);
    expect(sc).toMatch(/SameSite=/i);
    expect(sc).toMatch(/Max-Age=/i);
  });

  it('login password incorrecta ⇒ 401 sin cookie', async () => {
    await req('POST', '/auth/register', { body: CREDS });
    const r = await req('POST', '/auth/login', { body: { email: CREDS.email, password: 'malmal12' } });
    expect(r.status).toBe(401);
    expect(r.setCookie).toBeNull();
  });

  it('login email inexistente ⇒ 401', async () => {
    expect((await req('POST', '/auth/login', { body: { email: 'no@mail.com', password: CREDS.password } })).status).toBe(401);
  });

  // ---- /auth/me ----
  it('me con cookie válida ⇒ 200 (user + profile, sin datos sensibles)', async () => {
    const cookie = await loginCookie();
    const r = await req('GET', '/auth/me', { cookie });
    expect(r.status).toBe(200);
    const b = r.json() as { user: { email: string }; profile: { username: string } };
    expect(b.user.email).toBe('user@mail.com');
    expect(b.profile.username).toBe('Usuario1');
    expect(r.text).not.toMatch(/password|hash|token/i);
  });

  it('me sin cookie ⇒ 401', async () => {
    expect((await req('GET', '/auth/me', {})).status).toBe(401);
  });

  it('me cookie inválida ⇒ 401', async () => {
    expect((await req('GET', '/auth/me', { cookie: `${SESSION_COOKIE}=basura` })).status).toBe(401);
  });

  it('me cookie expirada ⇒ 401', async () => {
    const acc = await createAccount({ ...CREDS, email: 'exp@mail.com', username: 'ExpUser' });
    const expired = await createSession(acc.id, -1000);
    const cookie = cookiePair(sessionSetCookie(expired.token));
    expect((await req('GET', '/auth/me', { cookie })).status).toBe(401);
  });

  it('me cookie revocada ⇒ 401', async () => {
    const cookie = await loginCookie();
    await req('POST', '/auth/logout', { cookie });
    expect((await req('GET', '/auth/me', { cookie })).status).toBe(401);
  });

  // ---- LOGOUT ----
  it('logout con cookie válida ⇒ 204 y borra la cookie', async () => {
    const cookie = await loginCookie();
    const r = await req('POST', '/auth/logout', { cookie });
    expect(r.status).toBe(204);
    expect(r.text).toBe('');
    expect(r.setCookie ?? '').toMatch(/Max-Age=0/i); // cookie eliminada
  });

  it('logout sin cookie ⇒ 204 (idempotente/seguro)', async () => {
    expect((await req('POST', '/auth/logout', {})).status).toBe(204);
  });

  it('logout repetido sigue siendo seguro (204)', async () => {
    const cookie = await loginCookie();
    expect((await req('POST', '/auth/logout', { cookie })).status).toBe(204);
    expect((await req('POST', '/auth/logout', { cookie })).status).toBe(204);
  });

  it('/healthz sigue respondiendo 200', async () => {
    const r = await req('GET', '/healthz', {});
    expect(r.status).toBe(200);
    expect(r.json()).toEqual({ status: 'ok' });
  });
});
