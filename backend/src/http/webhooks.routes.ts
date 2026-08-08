/* =============================================================
 * Backend · Webhooks de pagos (Mercado Pago) — PÚBLICO (sin cookie)
 * -------------------------------------------------------------
 * MP notifica acá los cambios de suscripción/pago. Se verifica la FIRMA antes
 * de procesar. El backend consulta el recurso real en MP (no confía en el
 * cuerpo) y actualiza el estado. Idempotente. Responde 200 rápido.
 * ============================================================= */
import { readJsonBody } from './request.js';
import { sendJson } from './respond.js';
import type { Router } from './router.js';
import { verifyWebhookSignature } from '../services/mercadopago.js';
import { handleWebhook } from '../services/subscription.service.js';

function header(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function registerWebhookRoutes(router: Router): void {
  router.add('POST', '/webhooks/mercadopago', async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const q = url.searchParams;
    const body = (await readJsonBody(req).catch(() => ({}))) as Record<string, any>;

    const type = String(q.get('type') ?? q.get('topic') ?? body?.type ?? body?.topic ?? '');
    const dataId = String(
      q.get('data.id') ?? q.get('id') ?? body?.data?.id ?? body?.id ?? '',
    );

    const ok = verifyWebhookSignature({
      xSignature: header(req.headers['x-signature']),
      xRequestId: header(req.headers['x-request-id']),
      dataId,
    });
    if (!ok) {
      sendJson(res, 401, { error: { code: 'invalid_signature', message: 'Firma inválida' } });
      return;
    }

    // Procesa en segundo plano; MP sólo necesita el 200.
    void handleWebhook(type, dataId).catch((err) =>
      console.error('[mp webhook] error:', err instanceof Error ? err.name : err),
    );
    sendJson(res, 200, { received: true });
  });
}
