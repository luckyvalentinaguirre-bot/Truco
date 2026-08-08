/* =============================================================
 * Backend · Reporte de usuarios (acción de usuario autenticado)
 * ============================================================= */
import { badRequest } from './httpError.js';
import { readJsonBody } from './request.js';
import { sendJson } from './respond.js';
import { requireAuth } from './requireAuth.js';
import type { Router } from './router.js';
import { createReport } from '../repositories/reports.repository.js';

export function registerReportRoutes(router: Router): void {
  // POST /reports { targetUserId, reason } → crea un reporte (moderación).
  router.add(
    'POST',
    '/reports',
    requireAuth(async (req, res, auth) => {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const targetUserId = body.targetUserId;
      const reason = body.reason;
      if (typeof targetUserId !== 'string' || targetUserId.length === 0) throw badRequest('targetUserId obligatorio');
      if (typeof reason !== 'string' || reason.trim().length === 0) throw badRequest('reason obligatorio');
      if (targetUserId === auth.user.id) throw badRequest('No podés reportarte a vos mismo');
      await createReport(auth.user.id, targetUserId, reason.trim());
      sendJson(res, 201, { ok: true });
    }),
  );
}
