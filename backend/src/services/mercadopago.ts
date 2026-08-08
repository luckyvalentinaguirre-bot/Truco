/* =============================================================
 * Backend · Cliente de Mercado Pago (suscripciones "preapproval")
 * -------------------------------------------------------------
 * Usa la API REST de MP con `fetch` (sin dependencias extra). Todo config-gated
 * por variables de entorno: si no están, `isConfigured()` es false y los
 * endpoints responden "no configurado" — el código queda LISTO para cuando
 * tengas las credenciales.
 *
 * Variables (NUNCA en el repo, sólo en el panel del hosting):
 *   MP_ACCESS_TOKEN         Access Token de tu cuenta MP (secreto).
 *   MP_WEBHOOK_SECRET       Clave para verificar la firma del webhook.
 *   MP_PREAPPROVAL_PLAN_ID  (opcional) id del plan de suscripción US$3/mes.
 *   MP_PRICE_AMOUNT         (opcional) monto si no usás plan (default 3).
 *   MP_CURRENCY             (opcional) moneda (default 'UYU' o 'USD').
 *   MP_BACK_URL             URL de retorno tras el checkout.
 * ============================================================= */
import crypto from 'node:crypto';

const MP_API = 'https://api.mercadopago.com';

export function isConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function token(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error('MP_ACCESS_TOKEN no configurado');
  return t;
}

/** Estado de una suscripción (preapproval) según MP. */
export type MpPreapprovalStatus = 'authorized' | 'pending' | 'paused' | 'cancelled';

/** Mapea el estado de MP a nuestro estado de suscripción (dominio). PURO. */
export function mapPreapprovalStatus(
  mp: string,
): 'active' | 'pending' | 'past_due' | 'canceled' {
  switch (mp) {
    case 'authorized':
      return 'active';
    case 'pending':
      return 'pending';
    case 'paused':
      return 'past_due';
    case 'cancelled':
      return 'canceled';
    default:
      return 'pending';
  }
}

export interface Preapproval {
  id: string;
  status: string;
  initPoint: string | null;
  nextPaymentDate: string | null;
  payerId: string | null;
  externalReference: string | null; // = nuestro userId
}

function mapPreapproval(raw: Record<string, unknown>): Preapproval {
  return {
    id: String(raw.id),
    status: String(raw.status ?? 'pending'),
    initPoint: (raw.init_point as string) ?? null,
    nextPaymentDate: (raw.next_payment_date as string) ?? null,
    payerId: raw.payer_id != null ? String(raw.payer_id) : null,
    externalReference: (raw.external_reference as string) ?? null,
  };
}

/** Estado de un pago de MP → nuestro estado de pago. PURO. */
export function mapPaymentStatus(mp: string): 'succeeded' | 'failed' | 'refunded' | 'pending' {
  switch (mp) {
    case 'approved':
      return 'succeeded';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    case 'rejected':
    case 'cancelled':
      return 'failed';
    default:
      return 'pending';
  }
}

export interface MpPayment {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  externalReference: string | null;
}

export async function getPayment(id: string): Promise<MpPayment> {
  const raw = await mpFetch(`/v1/payments/${id}`, { method: 'GET' });
  const amount = Number(raw.transaction_amount ?? 0);
  return {
    id: String(raw.id),
    status: String(raw.status ?? 'pending'),
    amountCents: Math.round(amount * 100),
    currency: String(raw.currency_id ?? 'UYU'),
    externalReference: (raw.external_reference as string) ?? null,
  };
}

async function mpFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`MP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

/**
 * Crea una suscripción (preapproval) para el usuario. Devuelve el init_point
 * (URL de checkout) al que se redirige al cliente. El backend luego confirma
 * la activación por webhook (nunca por la vuelta del navegador).
 */
export async function createPreapproval(params: {
  payerEmail: string;
  externalReference: string; // nuestro userId, para reconciliar el webhook
}): Promise<Preapproval> {
  const amount = Number(process.env.MP_PRICE_AMOUNT ?? 3);
  const currency = process.env.MP_CURRENCY ?? 'UYU';
  const backUrl = process.env.MP_BACK_URL ?? '';
  const planId = process.env.MP_PREAPPROVAL_PLAN_ID;

  const body: Record<string, unknown> = planId
    ? { preapproval_plan_id: planId, payer_email: params.payerEmail, external_reference: params.externalReference, back_url: backUrl }
    : {
        reason: 'TRUCO Competitivo (US$3/mes)',
        external_reference: params.externalReference,
        payer_email: params.payerEmail,
        back_url: backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: currency,
        },
      };

  return mapPreapproval(await mpFetch('/preapproval', { method: 'POST', body: JSON.stringify(body) }));
}

export async function getPreapproval(id: string): Promise<Preapproval> {
  return mapPreapproval(await mpFetch(`/preapproval/${id}`, { method: 'GET' }));
}

/** Cancela la suscripción (deja de renovarse). */
export async function cancelPreapproval(id: string): Promise<Preapproval> {
  return mapPreapproval(
    await mpFetch(`/preapproval/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }),
  );
}

/**
 * Verifica la firma del webhook de MP (header `x-signature` + `x-request-id`).
 * MP arma el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y firma
 * con HMAC-SHA256 usando MP_WEBHOOK_SECRET. Si no hay secreto, no se puede
 * verificar (se rechaza en producción; en dev se permite).
 */
export function verifyWebhookSignature(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production'; // dev: permitir; prod: rechazar
  if (!params.xSignature || !params.dataId) return false;

  // x-signature: "ts=<ts>,v1=<hash>"
  const parts = Object.fromEntries(
    params.xSignature.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string]),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${params.dataId};request-id:${params.xRequestId ?? ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}
