/* =============================================================
 * Backend · Repository de pagos (tabla `payments`)
 * -------------------------------------------------------------
 * Historial de pagos + IDEMPOTENCIA de webhooks: provider_event_id es UNIQUE
 * por proveedor, así un webhook repetido no registra dos veces. NO guarda
 * datos financieros sensibles (tarjetas/CVV): eso vive en el proveedor.
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { query } from '../db/pool.js';

export type PaymentStatus = 'succeeded' | 'failed' | 'refunded' | 'pending';

export interface RecordPaymentInput {
  userId: string;
  provider: string;
  providerEventId: string;
  amountCents: number;
  currency?: string;
  status: PaymentStatus;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

/**
 * Registra un pago de forma IDEMPOTENTE. Devuelve true si insertó (primer
 * webhook) y false si ya existía (webhook repetido → no se procesa de nuevo).
 */
export async function recordPayment(input: RecordPaymentInput): Promise<boolean> {
  const res = await query(
    `INSERT INTO payments
        (user_id, provider, provider_event_id, amount_cents, currency, status, period_start, period_end)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (provider, provider_event_id) DO NOTHING`,
    [
      input.userId,
      input.provider,
      input.providerEventId,
      input.amountCents,
      input.currency ?? 'USD',
      input.status,
      input.periodStart ?? null,
      input.periodEnd ?? null,
    ],
  );
  return (res.rowCount ?? 0) > 0;
}

export interface PaymentRow {
  provider: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
}

interface Row extends QueryResultRow {
  provider: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  period_start: Date | null;
  period_end: Date | null;
  created_at: Date;
}

/** Historial de pagos de un usuario (para mostrar fecha/importe/estado, §7). */
export async function listUserPayments(userId: string, limit = 30): Promise<PaymentRow[]> {
  const res = await query<Row>(
    `SELECT provider, amount_cents, currency, status, period_start, period_end, created_at
       FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return res.rows.map((r) => ({
    provider: r.provider,
    amountCents: r.amount_cents,
    currency: r.currency,
    status: r.status,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    createdAt: r.created_at,
  }));
}
