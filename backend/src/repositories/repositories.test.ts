import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { closePool } from '../db/pool.js';
import { hasDatabase, prepareSchema, truncateAll } from './testDb.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  emailExists,
} from './users.repository.js';
import {
  createProfile,
  findProfileByUserId,
  findProfileByUsername,
  isUsernameAvailable,
} from './profiles.repository.js';
import {
  EmailAlreadyExistsError,
  UsernameTakenError,
  UserNotFoundError,
} from './errors.js';

// Si no hay base configurada, se salta la suite (no rompe entornos sin DB).
const d = hasDatabase ? describe : describe.skip;

const HASH = '$2b$10$fakehashfakehashfakehashfakehashfakehashfakeha'; // no es real

d('repositories · users & profiles (PostgreSQL real)', () => {
  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  // ---- USERS ----
  it('crea un user y lo devuelve tipado', async () => {
    const u = await createUser({ email: 'Pepe@Mail.com', passwordHash: HASH });
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.email).toBe('Pepe@Mail.com');
    expect(u.emailNormalized).toBe('pepe@mail.com');
    expect(u.passwordHash).toBe(HASH);
    expect(u.createdAt).toBeInstanceOf(Date);
  });

  it('busca user por email (normalizado, case-insensitive)', async () => {
    await createUser({ email: 'Ana@Mail.com', passwordHash: HASH });
    const found = await findUserByEmail('  ANA@mail.com ');
    expect(found?.emailNormalized).toBe('ana@mail.com');
    expect(await findUserByEmail('otro@mail.com')).toBeNull();
  });

  it('busca user por ID', async () => {
    const u = await createUser({ email: 'id@mail.com', passwordHash: HASH });
    const found = await findUserById(u.id);
    expect(found?.id).toBe(u.id);
    expect(
      await findUserById('00000000-0000-0000-0000-000000000000'),
    ).toBeNull();
  });

  it('email duplicado ⇒ EmailAlreadyExistsError', async () => {
    await createUser({ email: 'dup@mail.com', passwordHash: HASH });
    expect(await emailExists('DUP@mail.com')).toBe(true);
    await expect(
      createUser({ email: 'DUP@mail.com', passwordHash: HASH }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  // ---- PROFILES ----
  it('crea un profile asociado a un user', async () => {
    const u = await createUser({ email: 'p@mail.com', passwordHash: HASH });
    const p = await createProfile({
      userId: u.id,
      username: 'ElPepe',
      displayName: 'Pepe',
    });
    expect(p.userId).toBe(u.id);
    expect(p.username).toBe('ElPepe');
    expect(p.displayName).toBe('Pepe');
    expect(p.avatar).toBeNull();
  });

  it('busca profile por user_id y por username (case-insensitive)', async () => {
    const u = await createUser({ email: 'q@mail.com', passwordHash: HASH });
    await createProfile({ userId: u.id, username: 'Crack' });
    expect((await findProfileByUserId(u.id))?.username).toBe('Crack');
    expect((await findProfileByUsername('crack'))?.userId).toBe(u.id);
    expect(await findProfileByUsername('nadie')).toBeNull();
  });

  it('disponibilidad de username', async () => {
    const u = await createUser({ email: 'r@mail.com', passwordHash: HASH });
    expect(await isUsernameAvailable('Libre')).toBe(true);
    await createProfile({ userId: u.id, username: 'Tomado' });
    expect(await isUsernameAvailable('tomado')).toBe(false); // case-insensitive
  });

  it('username duplicado ⇒ UsernameTakenError', async () => {
    const u1 = await createUser({ email: 'a1@mail.com', passwordHash: HASH });
    const u2 = await createUser({ email: 'a2@mail.com', passwordHash: HASH });
    await createProfile({ userId: u1.id, username: 'Unico' });
    await expect(
      createProfile({ userId: u2.id, username: 'unico' }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it('profile con user_id inexistente ⇒ UserNotFoundError', async () => {
    await expect(
      createProfile({
        userId: '00000000-0000-0000-0000-000000000000',
        username: 'Fantasma',
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  // ---- RELACIÓN user → profile ----
  it('la relación user → profile: borrar el user borra su profile (CASCADE)', async () => {
    const u = await createUser({ email: 'casc@mail.com', passwordHash: HASH });
    await createProfile({ userId: u.id, username: 'Cascada' });
    expect(await findProfileByUserId(u.id)).not.toBeNull();
    // Borra el user directamente para comprobar el ON DELETE CASCADE.
    const { query } = await import('../db/pool.js');
    await query('DELETE FROM users WHERE id = $1', [u.id]);
    expect(await findProfileByUserId(u.id)).toBeNull();
  });
});
