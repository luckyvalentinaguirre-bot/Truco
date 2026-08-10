/* =============================================================
 * Backend · Servicio de administración (login del panel + bloqueo + auditoría)
 * -------------------------------------------------------------
 * 2ª credencial: contraseña administrativa (ADMIN_PASSWORD_HASH en el entorno,
 * NUNCA en el código/Git). Bloqueo de 8h tras más de 3 intentos fallidos,
 * persistido en la base (no se puede saltar borrando cookies). Alerta por
 * email + auditoría al bloquear. La verificación es SIEMPRE server-side.
 * ============================================================= */
import { verifyPassword } from './password.js';
import { generateSessionToken, hashToken } from './token.js';
import { sendAdminLockoutAlert } from './email.service.js';
import {
  getLockout,
  setLockout,
  insertAudit,
  createAdminSession,
  findAdminSession,
  deleteAdminSession,
  getRole,
  promoteToAdminByEmail,
} from '../repositories/admin.repository.js';

export const MAX_ADMIN_ATTEMPTS = 3; // el 4º intento fallido bloquea
export const LOCKOUT_MS = 8 * 60 * 60 * 1000; // 8 horas
export const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

export type AdminLoginResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not_configured' | 'bad_password'; attemptsLeft?: number }
  | { ok: false; reason: 'locked'; retryAfterMs: number };

/** ¿La contraseña administrativa está configurada en el entorno? */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD_HASH);
}

/**
 * Intenta el login administrativo (2ª credencial). El usuario ya debe estar
 * autenticado y ser ADMIN (se valida en la ruta). Aplica el bloqueo por
 * intentos fallidos y devuelve un token de sesión admin si acierta.
 */
export async function adminLogin(
  adminUserId: string,
  password: string,
  origin: string | null,
): Promise<AdminLoginResult> {
  if (!adminConfigured()) return { ok: false, reason: 'not_configured' };

  const lock = await getLockout();
  const now = Date.now();
  if (lock.lockedUntil && lock.lockedUntil.getTime() > now) {
    return { ok: false, reason: 'locked', retryAfterMs: lock.lockedUntil.getTime() - now };
  }

  const ok = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH!);
  if (!ok) {
    const attempts = lock.failedAttempts + 1;
    if (attempts > MAX_ADMIN_ATTEMPTS) {
      // 4º intento fallido: bloqueo de 8 horas + alerta + auditoría.
      const until = new Date(now + LOCKOUT_MS);
      await setLockout(0, until); // reinicia el contador; queda el bloqueo
      await insertAudit({ adminId: adminUserId, action: 'ADMIN_LOCKOUT', reason: origin ?? null, result: 'locked' });
      await sendAdminLockoutAlert(origin).catch(() => undefined);
      return { ok: false, reason: 'locked', retryAfterMs: LOCKOUT_MS };
    }
    await setLockout(attempts, null);
    await insertAudit({ adminId: adminUserId, action: 'ADMIN_LOGIN_FAILED', result: 'fail' });
    return { ok: false, reason: 'bad_password', attemptsLeft: MAX_ADMIN_ATTEMPTS - attempts + 1 };
  }

  // Correcto: reinicia el contador y crea la sesión admin elevada.
  await setLockout(0, null);
  const token = generateSessionToken();
  await createAdminSession(adminUserId, hashToken(token), new Date(now + ADMIN_SESSION_TTL_MS));
  await insertAudit({ adminId: adminUserId, action: 'ADMIN_LOGIN', result: 'ok' });
  return { ok: true, token };
}

/** Valida la sesión admin elevada (2ª cookie). Devuelve el adminId o null. */
export async function validateAdminToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  return findAdminSession(hashToken(token));
}

export async function adminLogout(token: string | undefined): Promise<void> {
  if (token) await deleteAdminSession(hashToken(token));
}

/** ¿El usuario tiene rol admin? (server-side). */
export async function isAdminRole(userId: string): Promise<boolean> {
  return (await getRole(userId)) === 'admin';
}

/**
 * Bootstrap del primer administrador desde el entorno: si ADMIN_BOOTSTRAP_EMAIL
 * está definido, promueve esa cuenta a admin al arrancar (idempotente). Permite
 * crear el primer admin sin tocar la base a mano. NUNCA hay credenciales en el
 * código; sólo se lee el email de una variable de entorno.
 */
export async function bootstrapAdminFromEnv(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  if (!email) return;
  const found = await promoteToAdminByEmail(email);
  if (found) console.log(`[admin] cuenta promovida/confirmada como admin: ${email}`);
  else console.warn(`[admin] ADMIN_BOOTSTRAP_EMAIL no coincide con ninguna cuenta (aún): ${email}`);
}
