/* =============================================================
 * §23 · Panel admin end-to-end: autorización server-side, bloqueo 8h,
 * reset, baneo, búsqueda, premium y auditoría. Contra Postgres real.
 * ============================================================= */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { hasDatabase, prepareSchema } from '../repositories/testDb.js';
import { closePool, query } from '../db/pool.js';
import { createHttpServer } from '../server/http.js';
import { createAccount } from '../services/account.service.js';
import { createSession } from '../services/session.service.js';
import { hashPassword } from '../services/password.js';
import { setRole } from '../repositories/admin.repository.js';
import { sessionSetCookie } from './cookies.js';

const d = hasDatabase ? describe : describe.skip;

let server: Server;
let base: string;

interface Res {
  status: number;
  json: () => any;
  setCookie: string | null;
}
async function req(method: string, path: string, opts: { body?: unknown; cookie?: string } = {}): Promise<Res> {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  let body: string | undefined;
  if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  const text = await res.text();
  return { status: res.status, json: () => (text ? JSON.parse(text) : null), setCookie: res.headers.get('set-cookie') };
}

/** Registra + inicia sesión; devuelve { userId, cookie }. */
async function makeUser(username: string) {
  const acc = await createAccount({ email: `${username}@mail.com`, password: 'clavefuerte9', username });
  const sess = await createSession(acc.id);
  return { userId: acc.id, cookie: sessionSetCookie(sess.token).split(';')[0] };
}
function cookiePair(setCookie: string | null): string {
  return (setCookie ?? '').split(';')[0];
}

d('admin · panel (server-side)', () => {
  beforeAll(async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.ADMIN_PASSWORD_HASH = await hashPassword('claveAdmin123');
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
    await query('TRUNCATE users, seasons, admin_lockout, admin_sessions, admin_audit_log RESTART IDENTITY CASCADE');
  });

  it('usuario normal NO puede acceder a endpoints admin (403)', async () => {
    const u = await makeUser('normal');
    const r = await req('GET', '/admin/stats', { cookie: u.cookie });
    expect(r.status).toBe(403);
  });

  it('flujo completo: 3 intentos permitidos, 4º bloquea 8h, reset y acceso', async () => {
    const admin = await makeUser('boss');
    await setRole(admin.userId, 'admin');

    // 3 intentos incorrectos: permitidos (401), sin bloqueo.
    for (let i = 0; i < 3; i++) {
      const r = await req('POST', '/admin/login', { cookie: admin.cookie, body: { password: 'mal' } });
      expect(r.status).toBe(401);
      expect(r.json().attemptsLeft).toBeGreaterThanOrEqual(0);
    }
    // 4º intento incorrecto: BLOQUEO 8h.
    const locked = await req('POST', '/admin/login', { cookie: admin.cookie, body: { password: 'mal' } });
    expect(locked.status).toBe(423);
    expect(locked.json().retryAfterMs).toBeGreaterThan(7 * 3600_000);

    // El bloqueo persiste: aun con la clave correcta, sigue bloqueado.
    const stillLocked = await req('POST', '/admin/login', { cookie: admin.cookie, body: { password: 'claveAdmin123' } });
    expect(stillLocked.status).toBe(423);

    // Se registró el bloqueo en auditoría.
    const audit = await query<{ action: string }>(`SELECT action FROM admin_audit_log`);
    expect(audit.rows.map((x) => x.action)).toContain('ADMIN_LOCKOUT');

    // Levantamos el bloqueo (como pasaría tras 8h) y probamos el acceso correcto.
    await query('UPDATE admin_lockout SET locked_until = NULL, failed_attempts = 0');
    const ok = await req('POST', '/admin/login', { cookie: admin.cookie, body: { password: 'claveAdmin123' } });
    expect(ok.status).toBe(200);
    const adminCookie = `${admin.cookie}; ${cookiePair(ok.setCookie)}`;

    // Ahora sí, con sesión admin elevada, accede.
    const stats = await req('GET', '/admin/stats', { cookie: adminCookie });
    expect(stats.status).toBe(200);
    expect(typeof stats.json().stats.users).toBe('number');
  });

  it('buscar (username/email/id), banear, premium y auditoría', async () => {
    const admin = await makeUser('root');
    await setRole(admin.userId, 'admin');
    await query('UPDATE admin_lockout SET locked_until = NULL, failed_attempts = 0');
    const login = await req('POST', '/admin/login', { cookie: admin.cookie, body: { password: 'claveAdmin123' } });
    const c = `${admin.cookie}; ${cookiePair(login.setCookie)}`;

    const target = await makeUser('victima');

    // Buscar por username, email e id.
    expect((await req('GET', '/admin/users/search?q=victima', { cookie: c })).json().results.length).toBe(1);
    expect((await req('GET', '/admin/users/search?q=victima@mail.com', { cookie: c })).json().results.length).toBe(1);
    expect((await req('GET', `/admin/users/search?q=${target.userId}`, { cookie: c })).json().results.length).toBe(1);

    // Premium: otorgar 30 días.
    expect((await req('POST', '/admin/users/premium', { cookie: c, body: { userId: target.userId, days: 30 } })).status).toBe(200);
    const detail = (await req('GET', `/admin/users/detail?userId=${target.userId}`, { cookie: c })).json();
    expect(detail.user.subscriptionStatus).toBe('active');

    // Banear → el baneado no puede operar (403) aunque tenga sesión.
    expect((await req('POST', '/admin/users/ban', { cookie: c, body: { userId: target.userId, reason: 'abuso' } })).status).toBe(200);
    expect((await req('GET', '/profile', { cookie: target.cookie })).status).toBe(403);
    // Desbanear → vuelve a operar.
    expect((await req('POST', '/admin/users/unban', { cookie: c, body: { userId: target.userId } })).status).toBe(200);
    expect((await req('GET', '/profile', { cookie: target.cookie })).status).toBe(200);

    // Auditoría: quedaron registradas las acciones.
    const audit = (await req('GET', '/admin/audit', { cookie: c })).json().audit.map((a: any) => a.action);
    expect(audit).toContain('BAN');
    expect(audit).toContain('UNBAN');
    expect(audit).toContain('PREMIUM_GRANT');
  });
});
