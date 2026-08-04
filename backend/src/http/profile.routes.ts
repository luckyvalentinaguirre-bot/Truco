/* =============================================================
 * Backend · Rutas HTTP de perfil (autenticadas)
 * ============================================================= */
import { badRequest } from './httpError.js';
import { readJsonBody } from './request.js';
import { sendJson } from './respond.js';
import { requireAuth } from './requireAuth.js';
import type { Router } from './router.js';
import {
  updateProfile,
  type Profile,
  type UpdateProfileInput,
} from '../repositories/profiles.repository.js';

const DISPLAY_NAME_MAX = 50;
const AVATAR_MAX = 200;
// Únicos campos editables en esta primera versión.
const ALLOWED_FIELDS = new Set(['displayName', 'avatar']);

/** Vista pública del perfil (sin datos sensibles). */
function publicProfile(userId: string, p: Pick<Profile, 'username' | 'displayName' | 'avatar'>) {
  return {
    userId,
    username: p.username,
    displayName: p.displayName,
    avatar: p.avatar,
  };
}

/** Valida y extrae los campos editables del body (string, null o ausente). */
function parseUpdate(body: unknown): UpdateProfileInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Se esperaba un objeto JSON');
  }
  const obj = body as Record<string, unknown>;

  // Rechaza cualquier campo no editable (user_id, email, username, etc.).
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw badRequest(`Campo no editable: "${key}"`);
    }
  }

  const out: UpdateProfileInput = {};
  const readField = (key: 'displayName' | 'avatar', max: number) => {
    if (!(key in obj)) return;
    const v = obj[key];
    if (v !== null && typeof v !== 'string') {
      throw badRequest(`"${key}" debe ser texto o null`);
    }
    if (typeof v === 'string' && v.length > max) {
      throw badRequest(`"${key}" demasiado largo`);
    }
    out[key] = v;
  };
  readField('displayName', DISPLAY_NAME_MAX);
  readField('avatar', AVATAR_MAX);

  if (out.displayName === undefined && out.avatar === undefined) {
    throw badRequest('No hay campos para actualizar');
  }
  return out;
}

/** Registra las rutas de perfil en el router. */
export function registerProfileRoutes(router: Router): void {
  // GET /profile → perfil público del usuario autenticado.
  router.add(
    'GET',
    '/profile',
    requireAuth((_req, res, auth) => {
      sendJson(res, 200, publicProfile(auth.user.id, auth.profile));
    }),
  );

  // PATCH /profile → actualiza displayName/avatar del usuario autenticado.
  router.add(
    'PATCH',
    '/profile',
    requireAuth(async (req, res, auth) => {
      const changes = parseUpdate(await readJsonBody(req));
      // El user_id SIEMPRE viene de la sesión, nunca del cliente.
      const updated = await updateProfile(auth.user.id, changes);
      if (!updated) throw badRequest('Perfil no encontrado');
      sendJson(res, 200, publicProfile(auth.user.id, updated));
    }),
  );
}
