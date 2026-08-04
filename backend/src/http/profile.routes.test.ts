import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { closePool, query } from '../db/pool.js';
import { hasDatabase, prepareSchema, truncateAll } from '../repositories/testDb.js';
import { createHttpServer } from '../server/http.js';
import { createAccount } from '../services/account.service.js';
import { createSession, revokeSession } from '../services/session.service.js';

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

const CREDS = { email: 'prof@mail.com', password: 'clavefuerte9', username: 'ProfUser' };

/** Crea la cuenta y devuelve un token de sesión válido. */
async function newToken(): Promise<{ userId: string; token: string }> {
  const acc = await createAccount(CREDS);
  const s = await createSession(acc.id);
  return { userId: acc.id, token: s.token };
}

d('HTTP · requireAuth + /profile', () => {
  beforeAll(async () => {
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

  // ---- requireAuth (a través de GET /profile) ----
  it('Bearer válido ⇒ 200 y contexto con el usuario correcto', async () => {
    const { userId, token } = await newToken();
    const r = await req('GET', '/profile', { token });
    expect(r.status).toBe(200);
    const b = r.json() as { userId: string; username: string };
    expect(b.userId).toBe(userId);
    expect(b.username).toBe('ProfUser');
    // El token nunca aparece en la respuesta.
    expect(r.text).not.toContain(token);
    expect(r.text).not.toMatch(/password|hash|token/i);
  });

  it('sin Authorization ⇒ 401', async () => {
    expect((await req('GET', '/profile', {})).status).toBe(401);
  });

  it('Bearer inválido ⇒ 401', async () => {
    expect((await req('GET', '/profile', { token: 'basura' })).status).toBe(401);
  });

  it('sesión expirada ⇒ 401', async () => {
    const acc = await createAccount(CREDS);
    const expired = await createSession(acc.id, -1000);
    expect((await req('GET', '/profile', { token: expired.token })).status).toBe(401);
  });

  it('sesión revocada ⇒ 401', async () => {
    const { token } = await newToken();
    await revokeSession(token);
    expect((await req('GET', '/profile', { token })).status).toBe(401);
  });

  // ---- GET /profile ----
  it('GET /profile devuelve el perfil sin datos sensibles', async () => {
    const { token } = await newToken();
    const r = await req('GET', '/profile', { token });
    const b = r.json() as Record<string, unknown>;
    expect(Object.keys(b).sort()).toEqual(['avatar', 'displayName', 'userId', 'username']);
    expect(r.text).not.toMatch(/password|hash|token|email/i);
  });

  // ---- PATCH /profile ----
  it('PATCH displayName ⇒ 200 y persiste', async () => {
    const { userId, token } = await newToken();
    const r = await req('PATCH', '/profile', { token, body: { displayName: 'Lucas' } });
    expect(r.status).toBe(200);
    expect((r.json() as { displayName: string }).displayName).toBe('Lucas');
    const row = await query<{ display_name: string }>(
      'SELECT display_name FROM profiles WHERE user_id = $1',
      [userId],
    );
    expect(row.rows[0]!.display_name).toBe('Lucas');
  });

  it('PATCH avatar ⇒ 200', async () => {
    const { token } = await newToken();
    const r = await req('PATCH', '/profile', { token, body: { avatar: 'avatar_01' } });
    expect(r.status).toBe(200);
    expect((r.json() as { avatar: string }).avatar).toBe('avatar_01');
  });

  it('PATCH ambos campos ⇒ 200', async () => {
    const { token } = await newToken();
    const r = await req('PATCH', '/profile', {
      token,
      body: { displayName: 'Ana', avatar: 'a2' },
    });
    expect(r.status).toBe(200);
    const b = r.json() as { displayName: string; avatar: string };
    expect(b.displayName).toBe('Ana');
    expect(b.avatar).toBe('a2');
  });

  it('PATCH sin autenticación ⇒ 401', async () => {
    expect((await req('PATCH', '/profile', { body: { displayName: 'x' } })).status).toBe(401);
  });

  it('PATCH JSON inválido ⇒ 400', async () => {
    const { token } = await newToken();
    expect((await req('PATCH', '/profile', { token, body: '{ roto', json: true })).status).toBe(400);
  });

  it('PATCH Content-Type incorrecto ⇒ 415', async () => {
    const { token } = await newToken();
    expect(
      (await req('PATCH', '/profile', { token, body: '{}', json: false })).status,
    ).toBe(415);
  });

  it('PATCH body demasiado grande ⇒ 413', async () => {
    const { token } = await newToken();
    const big = { displayName: 'x'.repeat(11 * 1024) };
    expect((await req('PATCH', '/profile', { token, body: big })).status).toBe(413);
  });

  it('PATCH sin campos válidos ⇒ 400', async () => {
    const { token } = await newToken();
    expect((await req('PATCH', '/profile', { token, body: {} })).status).toBe(400);
  });

  it('PATCH con user_id ⇒ 400 y NO cambia el user_id', async () => {
    const { userId, token } = await newToken();
    const r = await req('PATCH', '/profile', {
      token,
      body: { user_id: '00000000-0000-0000-0000-000000000000', displayName: 'x' },
    });
    expect(r.status).toBe(400);
    const row = await query<{ user_id: string }>(
      'SELECT user_id FROM profiles WHERE user_id = $1',
      [userId],
    );
    expect(row.rows[0]!.user_id).toBe(userId);
  });

  it('PATCH con email/username/password ⇒ 400 (no editables)', async () => {
    const { token } = await newToken();
    for (const body of [{ email: 'x@y.com' }, { username: 'nuevo' }, { password: 'x' }]) {
      expect((await req('PATCH', '/profile', { token, body })).status).toBe(400);
    }
  });

  it('PATCH actualiza updated_at', async () => {
    const { userId, token } = await newToken();
    const before = await query<{ updated_at: Date }>(
      'SELECT updated_at FROM profiles WHERE user_id = $1',
      [userId],
    );
    await new Promise((r) => setTimeout(r, 15));
    await req('PATCH', '/profile', { token, body: { displayName: 'Z' } });
    const after = await query<{ updated_at: Date }>(
      'SELECT updated_at FROM profiles WHERE user_id = $1',
      [userId],
    );
    expect(new Date(after.rows[0]!.updated_at).getTime()).toBeGreaterThan(
      new Date(before.rows[0]!.updated_at).getTime(),
    );
  });
});
