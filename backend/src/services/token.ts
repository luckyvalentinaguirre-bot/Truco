/* =============================================================
 * Backend · Tokens de sesión
 * -------------------------------------------------------------
 * Genera tokens criptográficamente seguros con `node:crypto` (nunca
 * Math.random) y los hashea de forma irreversible para persistir sólo
 * el hash. El token tiene 256 bits de entropía: un SHA-256 alcanza para
 * el lookup/verificación (no es una contraseña de baja entropía).
 * ============================================================= */
import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32; // 256 bits de entropía

/** Genera un token de sesión opaco (base64url, seguro para URLs/headers). */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Hash irreversible del token (SHA-256 hex) para guardar/buscar en la base. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
