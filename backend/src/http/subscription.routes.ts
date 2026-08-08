/* =============================================================
 * Backend · Rutas HTTP de suscripción competitiva (autenticadas)
 * ============================================================= */
import { sendJson } from './respond.js';
import { requireAuth } from './requireAuth.js';
import type { Router } from './router.js';
import { startCheckout, cancelSubscription } from '../services/subscription.service.js';
import { getSubscription } from '../repositories/subscriptions.repository.js';
import { listUserPayments } from '../repositories/payments.repository.js';
import { deriveAccess } from '../competitive/subscription.js';

export function registerSubscriptionRoutes(router: Router): void {
  // GET /subscription → estado de la suscripción del usuario + acceso derivado.
  router.add(
    'GET',
    '/subscription',
    requireAuth(async (_req, res, auth) => {
      const sub = await getSubscription(auth.user.id);
      const access = deriveAccess(
        sub
          ? {
              status: sub.status,
              currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() : null,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            }
          : null,
      );
      sendJson(res, 200, {
        subscription: sub
          ? {
              status: sub.status,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
              currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
            }
          : null,
        access,
        priceUsd: 3,
      });
    }),
  );

  // POST /subscription/checkout → inicia el checkout (devuelve URL de MP).
  router.add(
    'POST',
    '/subscription/checkout',
    requireAuth(async (_req, res, auth) => {
      const result = await startCheckout(auth.user.id, auth.user.email);
      if (!result.configured) {
        sendJson(res, 503, { error: { code: 'payments_unconfigured', message: 'Pagos no configurados aún.' } });
        return;
      }
      sendJson(res, 200, { checkoutUrl: result.checkoutUrl, subscriptionId: result.subscriptionId });
    }),
  );

  // POST /subscription/cancel → cancela la renovación (sigue vigente hasta vencer).
  router.add(
    'POST',
    '/subscription/cancel',
    requireAuth(async (_req, res, auth) => {
      const sub = await cancelSubscription(auth.user.id);
      sendJson(res, 200, {
        status: sub.status,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
      });
    }),
  );

  // GET /subscription/payments → historial de pagos (§7).
  router.add(
    'GET',
    '/subscription/payments',
    requireAuth(async (_req, res, auth) => {
      const rows = await listUserPayments(auth.user.id, 30);
      sendJson(res, 200, {
        payments: rows.map((p) => ({
          amount: p.amountCents / 100,
          currency: p.currency,
          status: p.status,
          date: p.createdAt.toISOString(),
        })),
      });
    }),
  );
}
