/* =============================================================
 * Backend · Rutas HTTP de autenticación
 * -------------------------------------------------------------
 * Delgadas: parsean el request, llaman a los servicios de dominio y
 * responden. La lógica de negocio vive en los servicios, no acá.
 * ============================================================= */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { badRequest } from './httpError.js';
import { readJsonBody, getBearerToken } from './request.js';
import { sendJson, sendNoContent } from './respond.js';
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
  const body = asObject(await readJsonBody(req));
  const identity = await verifyCredentials(
    requireString(body, 'email'),
    requireString(body, 'password'),
  );
  const session = await createSession(identity.userId);
  sendJson(res, 200, {
    token: session.token, // única aparición del token; no se loguea
    expiresAt: session.expiresAt,
    user: { id: identity.userId, email: identity.email },
  });
}

/** POST /auth/logout → 204 (idempotente). */
async function logout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getBearerToken(req);
  await revokeSession(token); // idempotente: no importa si ya estaba revocada
  sendNoContent(res);
}

/** GET /auth/me → 200 con user + profile (requiere Bearer válido). */
async function me(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getBearerToken(req);
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
