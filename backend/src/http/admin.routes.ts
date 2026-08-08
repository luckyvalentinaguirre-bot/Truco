/* =============================================================
 * Backend · Rutas HTTP del panel administrativo
 * -------------------------------------------------------------
 * Autorización SIEMPRE server-side: sesión + rol ADMIN + 2ª credencial
 * (contraseña admin → sesión admin elevada). Toda acción queda auditada.
 * ============================================================= */
import { badRequest, HttpError } from './httpError.js';
import { readJsonBody } from './request.js';
import { sendJson } from './respond.js';
import { requireAuth } from './requireAuth.js';
import { requireAdmin } from './requireAdmin.js';
import { parseCookies, ADMIN_COOKIE, adminSetCookie, adminClearCookie } from './cookies.js';
import type { Router } from './router.js';
import { adminLogin, adminLogout, isAdminRole } from '../services/admin.service.js';
import {
  searchUsers,
  getUserDetail,
  banUser,
  unbanUser,
  insertAudit,
  listAudit,
  platformStats,
} from '../repositories/admin.repository.js';
import { upsertSubscription } from '../repositories/subscriptions.repository.js';

function reqString(body: unknown, key: string): string {
  const v = (body as Record<string, unknown>)?.[key];
  if (typeof v !== 'string' || v.length === 0) throw badRequest(`Campo "${key}" obligatorio`);
  return v;
}
function clientOrigin(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0]!.trim();
  return req.socket?.remoteAddress ?? null;
}

export function registerAdminRoutes(router: Router): void {
  // POST /admin/login → 2ª credencial. Requiere sesión + rol admin.
  router.add(
    'POST',
    '/admin/login',
    requireAuth(async (req, res, auth) => {
      if (!(await isAdminRole(auth.user.id))) throw new HttpError(403, 'forbidden', 'No autorizado');
      const password = reqString(await readJsonBody(req), 'password');
      const origin = clientOrigin(req as never);
      const result = await adminLogin(auth.user.id, password, origin);
      if (result.ok) {
        res.setHeader('Set-Cookie', adminSetCookie(result.token));
        sendJson(res, 200, { ok: true });
        return;
      }
      if (result.reason === 'locked') {
        sendJson(res, 423, {
          error: { code: 'admin_locked', message: 'Acceso bloqueado temporalmente' },
          retryAfterMs: result.retryAfterMs,
        });
        return;
      }
      if (result.reason === 'not_configured') {
        sendJson(res, 503, { error: { code: 'admin_unconfigured', message: 'Panel no configurado' } });
        return;
      }
      sendJson(res, 401, {
        error: { code: 'bad_admin_password', message: 'Contraseña incorrecta' },
        attemptsLeft: result.attemptsLeft,
      });
    }),
  );

  // POST /admin/logout → cierra la sesión admin elevada.
  router.add(
    'POST',
    '/admin/logout',
    requireAuth(async (req, res) => {
      await adminLogout(parseCookies(req)[ADMIN_COOKIE]);
      res.setHeader('Set-Cookie', adminClearCookie());
      sendJson(res, 200, { ok: true });
    }),
  );

  // GET /admin/session → ¿hay sesión admin activa? (para el frontend)
  router.add(
    'GET',
    '/admin/session',
    requireAdmin((_req, res) => sendJson(res, 200, { admin: true })),
  );

  // GET /admin/users/search?q= → busca usuarios (username/email/id).
  router.add(
    'GET',
    '/admin/users/search',
    requireAdmin(async (req, res) => {
      const q = new URL(req.url ?? '/', 'http://local').searchParams.get('q') ?? '';
      if (q.trim().length === 0) {
        sendJson(res, 200, { results: [] });
        return;
      }
      sendJson(res, 200, { results: await searchUsers(q.trim()) });
    }),
  );

  // GET /admin/users/detail?userId= → ficha completa.
  router.add(
    'GET',
    '/admin/users/detail',
    requireAdmin(async (req, res) => {
      const userId = new URL(req.url ?? '/', 'http://local').searchParams.get('userId') ?? '';
      const detail = await getUserDetail(userId);
      if (!detail) throw badRequest('Usuario no encontrado');
      sendJson(res, 200, { user: detail });
    }),
  );

  // POST /admin/users/ban { userId, reason, days? }
  router.add(
    'POST',
    '/admin/users/ban',
    requireAdmin(async (req, res, auth) => {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const userId = reqString(body, 'userId');
      const reason = reqString(body, 'reason');
      const days = typeof body.days === 'number' ? body.days : null;
      const until = days ? new Date(Date.now() + days * 86_400_000) : null;
      await banUser(userId, { reason, until, byAdminId: auth.user.id });
      await insertAudit({ adminId: auth.user.id, action: 'BAN', targetUserId: userId, reason });
      sendJson(res, 200, { ok: true });
    }),
  );

  // POST /admin/users/unban { userId }
  router.add(
    'POST',
    '/admin/users/unban',
    requireAdmin(async (req, res, auth) => {
      const userId = reqString(await readJsonBody(req), 'userId');
      await unbanUser(userId);
      await insertAudit({ adminId: auth.user.id, action: 'UNBAN', targetUserId: userId });
      sendJson(res, 200, { ok: true });
    }),
  );

  // POST /admin/users/premium { userId, days } → otorga/extiende Premium.
  router.add(
    'POST',
    '/admin/users/premium',
    requireAdmin(async (req, res, auth) => {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const userId = reqString(body, 'userId');
      const days = typeof body.days === 'number' && body.days > 0 ? body.days : 30;
      const until = new Date(Date.now() + days * 86_400_000);
      await upsertSubscription({ userId, status: 'active', currentPeriodEnd: until, provider: 'admin_grant' });
      await insertAudit({
        adminId: auth.user.id,
        action: 'PREMIUM_GRANT',
        targetUserId: userId,
        meta: { days },
      });
      sendJson(res, 200, { ok: true, until: until.toISOString() });
    }),
  );

  // GET /admin/stats → contadores del dashboard.
  router.add(
    'GET',
    '/admin/stats',
    requireAdmin(async (_req, res) => sendJson(res, 200, { stats: await platformStats() })),
  );

  // GET /admin/audit → registro de acciones administrativas.
  router.add(
    'GET',
    '/admin/audit',
    requireAdmin(async (_req, res) => {
      const rows = await listAudit(100);
      sendJson(res, 200, {
        audit: rows.map((r) => ({
          action: r.action,
          adminId: r.adminId,
          targetUserId: r.targetUserId,
          reason: r.reason,
          result: r.result,
          date: r.createdAt.toISOString(),
        })),
      });
    }),
  );
}
