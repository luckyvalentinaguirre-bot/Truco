/* =============================================================
 * Backend · Cookie de sesión (HttpOnly)
 * -------------------------------------------------------------
 * Centraliza la creación/borrado y lectura de la cookie de sesión.
 * El token vive SÓLO en una cookie HttpOnly (inaccesible a JS).
 *
 * SameSite:
 *  - producción: None + Secure (frontend y backend en dominios distintos).
 *  - desarrollo: Lax (localhost:5173 ↔ localhost:10000 son "same-site":
 *    SameSite ignora el puerto), sin Secure para funcionar sobre http.
 * ============================================================= */
import type { IncomingMessage } from 'node:http';
import { unauthorized } from './httpError.js';

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 días (coherente con la sesión)

export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_MAX_AGE_SEC = 2 * 60 * 60; // 2 horas (coherente con la sesión admin)

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Atributos comunes de la cookie (deben coincidir al crear y al borrar). */
function cookieAttributes(): string {
  const sameSite = isProd() ? 'None' : 'Lax';
  const secure = isProd() ? '; Secure' : '';
  return `; HttpOnly; Path=/; SameSite=${sameSite}${secure}`;
}

/** Set-Cookie para iniciar sesión. */
export function sessionSetCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE_SEC}${cookieAttributes()}`;
}

/** Set-Cookie para borrar la sesión (mismos atributos, Max-Age=0). */
export function sessionClearCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0${cookieAttributes()}`;
}

/** Set-Cookie de la sesión admin elevada (2ª credencial). */
export function adminSetCookie(token: string): string {
  return `${ADMIN_COOKIE}=${token}; Max-Age=${ADMIN_MAX_AGE_SEC}${cookieAttributes()}`;
}
export function adminClearCookie(): string {
  return `${ADMIN_COOKIE}=; Max-Age=0${cookieAttributes()}`;
}

/** Parsea el header Cookie en un mapa nombre→valor. */
export function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

/** Token de sesión desde la cookie, o null si no está. */
export function getSessionToken(req: IncomingMessage): string | null {
  return parseCookies(req)[SESSION_COOKIE] ?? null;
}

/** Token de sesión desde la cookie; lanza 401 si falta. Nunca loguea el token. */
export function requireSessionToken(req: IncomingMessage): string {
  const token = getSessionToken(req);
  if (!token) throw unauthorized('Falta la cookie de sesión');
  return token;
}
