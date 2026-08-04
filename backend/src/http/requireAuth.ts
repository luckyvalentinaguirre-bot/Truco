/* =============================================================
 * Backend · requireAuth — protección de rutas autenticadas
 * -------------------------------------------------------------
 * Envuelve un handler para exigir un Bearer token válido. Reutiliza
 * getBearerToken() + getSessionUser(); si algo falla, el error (401)
 * lo mapea el router. Nunca loguea el token ni lo incluye en errores.
 * ============================================================= */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Handler } from './router.js';
import { getBearerToken } from './request.js';
import { getSessionUser, type AuthenticatedUser } from '../services/session.service.js';

/** Request con la identidad autenticada adjunta (tipada). */
export interface AuthenticatedRequest extends IncomingMessage {
  auth?: AuthenticatedUser;
}

/** Handler que recibe además la identidad autenticada resuelta. */
export type AuthedHandler = (
  req: AuthenticatedRequest,
  res: ServerResponse,
  auth: AuthenticatedUser,
) => Promise<void> | void;

/**
 * Envuelve un handler autenticado: resuelve el usuario a partir del Bearer y
 * lo adjunta como `req.auth` y como tercer argumento. Si el token falta o es
 * inválido/expirado/revocado, getBearerToken/getSessionUser lanzan y el router
 * responde 401.
 */
export function requireAuth(handler: AuthedHandler): Handler {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const token = getBearerToken(req);
    const auth = await getSessionUser(token);
    (req as AuthenticatedRequest).auth = auth;
    await handler(req as AuthenticatedRequest, res, auth);
  };
}
