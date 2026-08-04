/* =============================================================
 * Backend · Hashing de contraseñas
 * -------------------------------------------------------------
 * Usa scrypt del módulo `node:crypto` (KDF moderno recomendado por
 * OWASP para contraseñas). CERO dependencias externas. La contraseña
 * en claro sólo vive en memoria; se persiste únicamente el hash.
 *
 * Formato almacenado:  scrypt$N$r$p$<salt_b64>$<hash_b64>
 * ============================================================= */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** scrypt asíncrono con opciones (evita el typing incompleto de promisify). */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Parámetros de coste (equilibrio seguridad/latencia para un backend web).
const N = 16_384; // factor de coste CPU/memoria
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/** Genera el hash de una contraseña (con salt aleatorio embebido). */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(plain, salt, KEYLEN, { N, r: R, p: P })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/** Verifica una contraseña contra un hash previamente generado. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64!, 'base64');
  const expected = Buffer.from(hashB64!, 'base64');
  const derived = (await scryptAsync(plain, salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
  })) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
