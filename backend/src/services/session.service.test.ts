import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { closePool, query } from '../db/pool.js';
import { hasDatabase, prepareSchema, truncateAll } from '../repositories/testDb.js';
import { InvalidSessionError } from '../repositories/errors.js';
import { createAccount } from './account.service.js';
import {
  createSession,
  validateSession,
  revokeSession,
  getSessionUser,
} from './session.service.js';
import { hashToken } from './token.js';

const d = hasDatabase ? describe : describe.skip;

d('session.service · createSession/validateSession/revokeSession', () => {
  let userId: string;

  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
    const acc = await createAccount({
      email: 'sess@mail.com',
      password: 'clavefuerte9',
      username: 'SessUser',
    });
    userId = acc.id;
  });

  it('createSession crea una sesión y devuelve el token al caller', async () => {
    const s = await createSession(userId);
    expect(s.token).toBeTruthy();
    expect(s.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.userId).toBe(userId);
    expect(s.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('la base guarda SÓLO el token_hash, nunca el token', async () => {
    const s = await createSession(userId);
    const row = await query<{ token_hash: string }>(
      'SELECT token_hash FROM sessions WHERE id = $1',
      [s.sessionId],
    );
    const stored = row.rows[0]!.token_hash;
    expect(stored).not.toBe(s.token);
    expect(stored).toBe(hashToken(s.token)); // consistente con la estrategia
    // El token en claro no aparece en ninguna columna de la fila.
    const full = await query('SELECT * FROM sessions WHERE id = $1', [s.sessionId]);
    expect(JSON.stringify(full.rows[0])).not.toContain(s.token);
  });

  it('validateSession acepta un token válido y devuelve identidad mínima', async () => {
    const s = await createSession(userId);
    const id = await validateSession(s.token);
    expect(id).toEqual({ userId, sessionId: s.sessionId });
  });

  it('token incorrecto ⇒ InvalidSessionError', async () => {
    await createSession(userId);
    await expect(validateSession('token-que-no-existe')).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it('sesión expirada ⇒ InvalidSessionError', async () => {
    const s = await createSession(userId, -1000); // ya expirada
    await expect(validateSession(s.token)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it('sesión revocada ⇒ InvalidSessionError', async () => {
    const s = await createSession(userId);
    await revokeSession(s.token);
    await expect(validateSession(s.token)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it('revokeSession invalida el token', async () => {
    const s = await createSession(userId);
    expect(await revokeSession(s.token)).toBe(true);
    const row = await query<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM sessions WHERE id = $1',
      [s.sessionId],
    );
    expect(row.rows[0]!.revoked_at).not.toBeNull();
  });

  it('revokeSession es idempotente/segura (token inexistente o ya revocado)', async () => {
    const s = await createSession(userId);
    expect(await revokeSession(s.token)).toBe(true); // primera vez revoca
    expect(await revokeSession(s.token)).toBe(false); // ya revocada, no rompe
    expect(await revokeSession('inexistente')).toBe(false); // no existe, no rompe
  });

  it('last_used_at se actualiza al validar', async () => {
    const s = await createSession(userId);
    const before = await query<{ last_used_at: Date | null }>(
      'SELECT last_used_at FROM sessions WHERE id = $1',
      [s.sessionId],
    );
    expect(before.rows[0]!.last_used_at).toBeNull();
    await validateSession(s.token);
    const after = await query<{ last_used_at: Date | null }>(
      'SELECT last_used_at FROM sessions WHERE id = $1',
      [s.sessionId],
    );
    expect(after.rows[0]!.last_used_at).not.toBeNull();
  });

  it('la identidad devuelta nunca incluye token ni hashes', async () => {
    const s = await createSession(userId);
    const id = await validateSession(s.token);
    expect(Object.keys(id).sort()).toEqual(['sessionId', 'userId']);
    const asJson = JSON.stringify(id);
    expect(asJson).not.toContain(s.token);
    expect(asJson).not.toMatch(/hash/i);
  });

  // ---- getSessionUser ----
  it('getSessionUser: token válido ⇒ user + profile + session', async () => {
    const s = await createSession(userId);
    const me = await getSessionUser(s.token);
    expect(me.user.id).toBe(userId);
    expect(me.user.email).toBe('sess@mail.com');
    expect(me.profile.username).toBe('SessUser');
    expect(me.profile.displayName).toBeNull();
    expect(me.profile.avatar).toBeNull();
    expect(me.session.id).toBe(s.sessionId);
  });

  it('getSessionUser: token inválido ⇒ InvalidSessionError', async () => {
    await expect(getSessionUser('no-existe')).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it('getSessionUser: sesión expirada ⇒ InvalidSessionError', async () => {
    const s = await createSession(userId, -1000);
    await expect(getSessionUser(s.token)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it('getSessionUser: sesión revocada ⇒ InvalidSessionError', async () => {
    const s = await createSession(userId);
    await revokeSession(s.token);
    await expect(getSessionUser(s.token)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it('getSessionUser: usuario inexistente ⇒ manejo seguro (InvalidSessionError)', async () => {
    const s = await createSession(userId);
    // Borrar el user elimina en cascada su sesión: getSessionUser falla seguro.
    await query('DELETE FROM users WHERE id = $1', [userId]);
    await expect(getSessionUser(s.token)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it('getSessionUser: el resultado nunca contiene password_hash/token/token_hash', async () => {
    const s = await createSession(userId);
    const me = await getSessionUser(s.token);
    const asJson = JSON.stringify(me);
    expect(asJson).not.toMatch(/password/i);
    expect(asJson).not.toMatch(/hash/i);
    expect(asJson).not.toContain(s.token);
    expect(asJson).not.toContain(hashToken(s.token));
  });
});
