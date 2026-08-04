import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { closePool } from '../db/pool.js';
import { hasDatabase, prepareSchema, truncateAll } from '../repositories/testDb.js';
import { InvalidCredentialsError } from '../repositories/errors.js';
import { createAccount } from './account.service.js';
import { verifyCredentials } from './auth.service.js';

const d = hasDatabase ? describe : describe.skip;

const EMAIL = 'login@mail.com';
const PASSWORD = 'clavefuerte9';
const USERNAME = 'LoginUser';

d('auth.service · verifyCredentials', () => {
  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
    await createAccount({ email: EMAIL, password: PASSWORD, username: USERNAME });
  });

  it('credenciales correctas ⇒ identidad mínima', async () => {
    const id = await verifyCredentials(EMAIL, PASSWORD);
    expect(id.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(id.email).toBe(EMAIL);
    expect(id.emailNormalized).toBe('login@mail.com');
  });

  it('password incorrecta ⇒ InvalidCredentialsError', async () => {
    await expect(verifyCredentials(EMAIL, 'otraClave123')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('email inexistente ⇒ MISMO error que password incorrecta', async () => {
    let inexistente: unknown;
    let malPass: unknown;
    await verifyCredentials('nadie@mail.com', PASSWORD).catch((e) => (inexistente = e));
    await verifyCredentials(EMAIL, 'malMalMal1').catch((e) => (malPass = e));
    expect(inexistente).toBeInstanceOf(InvalidCredentialsError);
    expect(malPass).toBeInstanceOf(InvalidCredentialsError);
    // Indistinguibles: misma clase y mismo mensaje.
    expect((inexistente as Error).constructor).toBe((malPass as Error).constructor);
    expect((inexistente as Error).message).toBe((malPass as Error).message);
  });

  it('email con mayúsculas/espacios ⇒ funciona por normalización', async () => {
    const id = await verifyCredentials('  LOGIN@Mail.COM ', PASSWORD);
    expect(id.emailNormalized).toBe('login@mail.com');
  });

  it('el resultado nunca contiene password_hash ni la contraseña', async () => {
    const id = await verifyCredentials(EMAIL, PASSWORD);
    const asJson = JSON.stringify(id);
    expect(Object.keys(id)).toEqual(['userId', 'email', 'emailNormalized']);
    expect('passwordHash' in id).toBe(false);
    expect(asJson).not.toMatch(/hash/i);
    expect(asJson).not.toContain(PASSWORD);
  });
});
