/* =============================================================
 * Backend · Rutas HTTP de autenticación
 * -------------------------------------------------------------
 * Delgadas: parsean el request, llaman a los servicios de dominio y
 * responden. La lógica de negocio vive en los servicios, no acá.
 * ============================================================= */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { badRequest } from './httpError.js';
import { readJsonBody } from './request.js';
import { rateLimit } from './rateLimit.js';
import { sendJson, sendNoContent } from './respond.js';
import {
  getSessionToken,
  requireSessionToken,
  sessionSetCookie,
  sessionClearCookie,
} from './cookies.js';
import type { Router } from './router.js';
import { createAccount } from '../services/account.service.js';
import { verifyCredentials } from '../services/auth.service.js';
import {
  createSession,
  revokeSession,
  getSessionUser,
} from '../services/session.service.js';

/** Extrae un string obligatorio del body (400 si falta o no es string). */
function requireString(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  if (typeof v !== 'string') throw badRequest(`Campo "${key}" obligatorio`);
  return v;
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Se esperaba un objeto JSON');
  }
  return body as Record<string, unknown>;
}

/** POST /auth/register → 201 con datos públicos (sin crear sesión). */
async function register(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Anti-abuso: como máximo 10 registros por IP cada 10 minutos.
  rateLimit(req, 'register', { max: 10, windowMs: 10 * 60_000 });
  const body = asObject(await readJsonBody(req));
  const account = await createAccount({
    email: requireString(body, 'email'),
    password: requireString(body, 'password'),
    username: requireString(body, 'username'),
  });
  sendJson(res, 201, {
    user: {
      id: account.id,
      email: account.email,
      username: account.username,
      displayName: account.displayName,
      avatar: account.avatar,
    },
  });
}

/** POST /auth/login → 200 con token de sesión + identidad mínima. */
async function login(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Anti-fuerza-bruta: como máximo 15 intentos de login por IP cada 5 minutos.
  rateLimit(req, 'login', { max: 15, windowMs: 5 * 60_000 });
  const body = asObject(await readJsonBody(req));
  const identity = await verifyCredentials(
    requireString(body, 'email'),
    requireString(body, 'password'),
  );
  const session = await createSession(identity.userId);
  // El token viaja SÓLO en una cookie HttpOnly; nunca en el JSON.
  res.setHeader('Set-Cookie', sessionSetCookie(session.token));
  sendJson(res, 200, {
    user: { id: identity.userId, email: identity.email },
  });
}

/** POST /auth/logout → 204 (idempotente). Revoca y borra la cookie. */
async function logout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getSessionToken(req); // sin cookie ⇒ igual respondemos 204
  if (token) await revokeSession(token); // idempotente
  res.setHeader('Set-Cookie', sessionClearCookie());
  sendNoContent(res);
}

/** GET /auth/me → 200 con user + profile (requiere cookie de sesión válida). */
async function me(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = requireSessionToken(req);
  const authed = await getSessionUser(token);
  sendJson(res, 200, authed);
}

/** Registra las rutas de auth en el router. */
export function registerAuthRoutes(router: Router): void {
  router
    .add('POST', '/auth/register', register)
    .add('POST', '/auth/login', login)
    .add('POST', '/auth/logout', logout)
    .add('GET', '/auth/me', me);
}
