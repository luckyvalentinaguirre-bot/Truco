/* =============================================================
 * Backend · Middleware requireAdmin (autorización server-side)
 * -------------------------------------------------------------
 * Exige: sesión válida + rol ADMIN + sesión admin elevada (2ª credencial).
 * Todo se verifica en el backend; nunca se confía en el frontend.
 * ============================================================= */
import { HttpError } from './httpError.js';
import { parseCookies, ADMIN_COOKIE } from './cookies.js';
import { requireAuth, type AuthedHandler } from './requireAuth.js';
import type { Handler } from './router.js';
import { isAdminRole, validateAdminToken } from '../services/admin.service.js';

export function requireAdmin(handler: AuthedHandler): Handler {
  return requireAuth(async (req, res, auth) => {
    if (!(await isAdminRole(auth.user.id))) {
      throw new HttpError(403, 'forbidden', 'No autorizado');
    }
    const token = parseCookies(req)[ADMIN_COOKIE];
    const adminId = await validateAdminToken(token);
    if (!adminId || adminId !== auth.user.id) {
      throw new HttpError(401, 'admin_required', 'Se requiere autenticación administrativa');
    }
    await handler(req, res, auth);
  });
}
