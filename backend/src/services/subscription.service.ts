/* =============================================================
 * Backend · Servicio de suscripción competitiva (Mercado Pago)
 * -------------------------------------------------------------
 * El backend es la AUTORIDAD: la suscripción se activa por WEBHOOK confirmado
 * por MP, nunca por la vuelta del navegador. Todo config-gated: si MP no está
 * configurado, `startCheckout` avisa y no rompe.
 * ============================================================= */
import { badRequest } from '../http/httpError.js';
import {
  getSubscription,
  upsertSubscription,
  type SubscriptionRow,
} from '../repositories/subscriptions.repository.js';
import { recordPayment } from '../repositories/payments.repository.js';
import {
  isConfigured,
  createPreapproval,
  getPreapproval,
  cancelPreapproval,
  getPayment,
  mapPreapprovalStatus,
  mapPaymentStatus,
} from './mercadopago.js';

const PROVIDER = 'mercadopago';

export type CheckoutResult =
  | { configured: false }
  | { configured: true; checkoutUrl: string | null; subscriptionId: string };

/**
 * Inicia el checkout de la suscripción US$3/mes. Crea la preapproval en MP,
 * deja la suscripción en 'pending' y devuelve la URL de checkout.
 */
export async function startCheckout(userId: string, payerEmail: string): Promise<CheckoutResult> {
  if (!isConfigured()) return { configured: false };

  const pre = await createPreapproval({ payerEmail, externalReference: userId });
  await upsertSubscription({
    userId,
    status: 'pending',
    provider: PROVIDER,
    providerSubscriptionId: pre.id,
  });
  return { configured: true, checkoutUrl: pre.initPoint, subscriptionId: pre.id };
}

/** Cancela la renovación (respeta el período ya pagado según MP). */
export async function cancelSubscription(userId: string): Promise<SubscriptionRow> {
  const sub = await getSubscription(userId);
  if (!sub) throw badRequest('No tenés una suscripción');
  if (isConfigured() && sub.providerSubscriptionId) {
    await cancelPreapproval(sub.providerSubscriptionId).catch(() => undefined);
  }
  // Cancelada: seguirá vigente hasta currentPeriodEnd (el dominio lo respeta).
  return upsertSubscription({
    userId,
    status: sub.status === 'active' ? 'active' : sub.status,
    cancelAtPeriodEnd: true,
    currentPeriodEnd: sub.currentPeriodEnd,
    provider: sub.provider,
    providerCustomerId: sub.providerCustomerId,
    providerSubscriptionId: sub.providerSubscriptionId,
  });
}

/**
 * Sincroniza la suscripción con el estado real de la preapproval en MP.
 * Idempotente: reprocesar el mismo webhook deja el mismo estado final.
 */
export async function syncPreapproval(preapprovalId: string): Promise<void> {
  const pre = await getPreapproval(preapprovalId);
  const userId = pre.externalReference;
  if (!userId) return; // sin referencia no podemos reconciliar

  const status = mapPreapprovalStatus(pre.status);
  const currentPeriodEnd = pre.nextPaymentDate ? new Date(pre.nextPaymentDate) : null;
  const prev = await getSubscription(userId);
  await upsertSubscription({
    userId,
    status,
    cancelAtPeriodEnd: status === 'canceled' ? true : (prev?.cancelAtPeriodEnd ?? false),
    currentPeriodEnd,
    provider: PROVIDER,
    providerSubscriptionId: pre.id,
  });
}

/** Registra un pago notificado por MP (idempotente por id de pago). */
export async function syncPayment(paymentId: string): Promise<void> {
  const pay = await getPayment(paymentId);
  const userId = pay.externalReference;
  if (!userId) return;
  await recordPayment({
    userId,
    provider: PROVIDER,
    providerEventId: pay.id,
    amountCents: pay.amountCents,
    currency: pay.currency,
    status: mapPaymentStatus(pay.status),
  });
}

/**
 * Procesa una notificación de webhook de MP ya verificada. `type` y `dataId`
 * salen del cuerpo/query de la notificación.
 */
export async function handleWebhook(type: string, dataId: string): Promise<void> {
  if (!dataId) return;
  if (type === 'preapproval' || type === 'subscription_preapproval') {
    await syncPreapproval(dataId);
  } else if (type === 'payment') {
    await syncPayment(dataId);
  }
  // otros tipos se ignoran silenciosamente
}
