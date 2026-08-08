/* =============================================================
 * Backend · Repository de suscripción competitiva (tabla `subscriptions`)
 * -------------------------------------------------------------
 * Una fila por usuario. NO guarda datos financieros sensibles (sólo el estado
 * y referencias del proveedor). El acceso efectivo lo deriva el dominio
 * (competitive/subscription.ts).
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { getPool, type Executor } from '../db/pool.js';
import type { SubscriptionStatus } from '../competitive/subscription.js';

export interface SubscriptionRow {
  userId: string;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  provider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
}

interface Row extends QueryResultRow {
  user_id: string;
  status: SubscriptionStatus;
  cancel_at_period_end: boolean;
  current_period_end: Date | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
}

const COLUMNS =
  'user_id, status, cancel_at_period_end, current_period_end, provider, provider_customer_id, provider_subscription_id';

function map(r: Row): SubscriptionRow {
  return {
    userId: r.user_id,
    status: r.status,
    cancelAtPeriodEnd: r.cancel_at_period_end,
    currentPeriodEnd: r.current_period_end,
    provider: r.provider,
    providerCustomerId: r.provider_customer_id,
    providerSubscriptionId: r.provider_subscription_id,
  };
}

export async function getSubscription(
  userId: string,
  exec: Executor = getPool(),
): Promise<SubscriptionRow | null> {
  const res = await exec.query<Row>(
    `SELECT ${COLUMNS} FROM subscriptions WHERE user_id = $1`,
    [userId],
  );
  return res.rows[0] ? map(res.rows[0]) : null;
}

export interface UpsertSubscriptionInput {
  userId: string;
  status: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  provider?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
}

/** Crea o actualiza la suscripción del usuario (autoridad: backend/webhook). */
export async function upsertSubscription(
  input: UpsertSubscriptionInput,
  exec: Executor = getPool(),
): Promise<SubscriptionRow> {
  const res = await exec.query<Row>(
    `INSERT INTO subscriptions
        (user_id, status, cancel_at_period_end, current_period_end,
         provider, provider_customer_id, provider_subscription_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (user_id) DO UPDATE SET
        status = EXCLUDED.status,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        current_period_end = EXCLUDED.current_period_end,
        provider = EXCLUDED.provider,
        provider_customer_id = EXCLUDED.provider_customer_id,
        provider_subscription_id = EXCLUDED.provider_subscription_id,
        updated_at = now()
     RETURNING ${COLUMNS}`,
    [
      input.userId,
      input.status,
      input.cancelAtPeriodEnd ?? false,
      input.currentPeriodEnd ?? null,
      input.provider ?? null,
      input.providerCustomerId ?? null,
      input.providerSubscriptionId ?? null,
    ],
  );
  return map(res.rows[0]!);
}
