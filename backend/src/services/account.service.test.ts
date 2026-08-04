import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { closePool, query } from '../db/pool.js';
import { hasDatabase, prepareSchema, truncateAll } from '../repositories/testDb.js';
import {
  EmailAlreadyExistsError,
  UsernameTakenError,
  ValidationError,
} from '../repositories/errors.js';
import { findUserByEmail, findUserById } from '../repositories/users.repository.js';
import { findProfileByUserId } from '../repositories/profiles.repository.js';
import { createAccount } from './account.service.js';
import { verifyPassword } from './password.js';

const d = hasDatabase ? describe : describe.skip;

d('account.service · createAccount (transaccional)', () => {
  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it('crea la cuenta y devuelve datos públicos (sin hash ni password)', async () => {
    const acc = await createAccount({
      email: 'Nueva@Mail.com',
      password: 'superseguro1',
      username: 'Jugador1',
    });
    expect(acc.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(acc.email).toBe('Nueva@Mail.com');
    expect(acc.username).toBe('Jugador1');
    // La respuesta pública NUNCA incluye hash/contraseña.
    expect(JSON.stringify(acc)).not.toMatch(/password|hash|superseguro1/i);
  });

  it('crea users y profiles juntos (ambos persistidos)', async () => {
    const acc = await createAccount({
      email: 'ambos@mail.com',
      password: 'clavefuerte9',
      username: 'Ambos',
    });
    const user = await findUserById(acc.id);
    const profile = await findProfileByUserId(acc.id);
    expect(user).not.toBeNull();
    expect(profile).not.toBeNull();
    expect(profile?.username).toBe('Ambos');
  });

  it('la contraseña se guarda hasheada, nunca en claro', async () => {
    const plain = 'noEnClaro123';
    const acc = await createAccount({ email: 'h@mail.com', password: plain, username: 'Hasher' });
    const row = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [acc.id],
    );
    const stored = row.rows[0]!.password_hash;
    expect(stored).not.toBe(plain);
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword(plain, stored)).toBe(true);
    expect(await verifyPassword('otra', stored)).toBe(false);
  });

  it('normaliza el email (email_normalized en minúsculas)', async () => {
    const acc = await createAccount({
      email: '  MixCase@Mail.COM ',
      password: 'clavefuerte9',
      username: 'Normal',
    });
    const found = await findUserByEmail('mixcase@mail.com');
    expect(found?.id).toBe(acc.id);
    expect(found?.emailNormalized).toBe('mixcase@mail.com');
  });

  it('normaliza el username (trim) según la lógica actual', async () => {
    const acc = await createAccount({
      email: 'trim@mail.com',
      password: 'clavefuerte9',
      username: '  Recortado  ',
    });
    expect(acc.username).toBe('Recortado');
  });

  it('email duplicado ⇒ EmailAlreadyExistsError', async () => {
    await createAccount({ email: 'dup@mail.com', password: 'clavefuerte9', username: 'Uno' });
    await expect(
      createAccount({ email: 'DUP@mail.com', password: 'clavefuerte9', username: 'Dos' }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('username duplicado ⇒ UsernameTakenError', async () => {
    await createAccount({ email: 'u1@mail.com', password: 'clavefuerte9', username: 'Repetido' });
    await expect(
      createAccount({ email: 'u2@mail.com', password: 'clavefuerte9', username: 'repetido' }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it('datos inválidos ⇒ ValidationError (email/username/password)', async () => {
    await expect(
      createAccount({ email: 'no-es-email', password: 'clavefuerte9', username: 'Ok1' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createAccount({ email: 'ok@mail.com', password: 'clavefuerte9', username: 'a b!' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createAccount({ email: 'ok@mail.com', password: 'corta', username: 'Okuser' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('si falla el profile, el user también desaparece (ROLLBACK conjunto)', async () => {
    // Ocupamos un username.
    await createAccount({ email: 'first@mail.com', password: 'clavefuerte9', username: 'Ocupado' });
    // Nuevo email pero username ya tomado ⇒ el profile falla dentro de la tx.
    await expect(
      createAccount({ email: 'second@mail.com', password: 'clavefuerte9', username: 'ocupado' }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
    // El user de 'second@mail.com' NO debe haber quedado creado.
    expect(await findUserByEmail('second@mail.com')).toBeNull();
    // Y sólo debe existir 1 usuario en total.
    const count = await query<{ n: string }>('SELECT count(*)::text AS n FROM users');
    expect(count.rows[0]!.n).toBe('1');
  });

  it('si la transacción funciona, ambos registros quedan persistidos', async () => {
    const acc = await createAccount({ email: 'ok2@mail.com', password: 'clavefuerte9', username: 'Persistido' });
    const users = await query<{ n: string }>('SELECT count(*)::text AS n FROM users');
    const profiles = await query<{ n: string }>('SELECT count(*)::text AS n FROM profiles');
    expect(users.rows[0]!.n).toBe('1');
    expect(profiles.rows[0]!.n).toBe('1');
    expect((await findProfileByUserId(acc.id))?.username).toBe('Persistido');
  });
});
