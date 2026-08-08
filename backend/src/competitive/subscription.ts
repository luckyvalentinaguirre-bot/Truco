/* =============================================================
 * Competitivo · Suscripción (US$3/mes) — máquina de estados pura
 * -------------------------------------------------------------
 * La suscripción SÓLO habilita el acceso al modo competitivo. NO otorga
 * ninguna ventaja jugable (no pay-to-win): mismas cartas, misma jerarquía,
 * mismas reglas para todos.
 *
 * AUTORIDAD: el estado efectivo lo decide el backend a partir de datos
 * confirmados por el proveedor de pagos (webhooks), NUNCA por un
 * `success=true` del navegador.
 * ============================================================= */

/** Precio fijo del modo competitivo. NO convertir en pago por partida/fichas. */
export const COMPETITIVE_PRICE_USD = 3;
export const COMPETITIVE_INTERVAL = 'month' as const;

/**
 * Estado persistido de la suscripción (lo que dice el proveedor + nuestra
 * intención de renovación). El estado EFECTIVO se deriva con `deriveAccess`.
 */
export type SubscriptionStatus =
  | 'active' // pagada y vigente
  | 'pending' // checkout iniciado, aún sin confirmar
  | 'past_due' // falló el cobro de renovación
  | 'canceled' // no se renovará (puede seguir vigente hasta currentPeriodEnd)
  | 'expired'; // venció y no hay acceso

export interface SubscriptionRecord {
  status: SubscriptionStatus;
  /** Fin del período pagado (epoch ms). null si nunca se pagó. */
  currentPeriodEnd: number | null;
  /** Si true, no se renovará al vencer el período actual. */
  cancelAtPeriodEnd: boolean;
}

export type CompetitiveAccess =
  | 'active' // puede jugar competitivo ahora
  | 'canceled_but_active' // cancelada, pero el período pagado sigue vigente
  | 'expired' // venció → bloqueado
  | 'pending' // esperando confirmación de pago
  | 'blocked'; // sin suscripción o past_due sin período vigente

/**
 * Deriva el ACCESO efectivo al competitivo en un instante dado.
 * Un período pagado sigue siendo válido hasta `currentPeriodEnd` aunque la
 * suscripción esté cancelada (respeta lo ya pagado).
 */
export function deriveAccess(
  sub: SubscriptionRecord | null,
  now: number = Date.now(),
): CompetitiveAccess {
  if (!sub) return 'blocked';

  const periodValid = sub.currentPeriodEnd !== null && now < sub.currentPeriodEnd;

  switch (sub.status) {
    case 'pending':
      return 'pending';
    case 'active':
      // Activa: vigente si el período no venció. Si venció, esperando renovación.
      if (!periodValid) return 'expired';
      return sub.cancelAtPeriodEnd ? 'canceled_but_active' : 'active';
    case 'canceled':
      return periodValid ? 'canceled_but_active' : 'expired';
    case 'past_due':
      // Falló el cobro: sólo hay acceso si aún queda período pagado.
      return periodValid ? 'active' : 'blocked';
    case 'expired':
      return 'expired';
    default:
      return 'blocked';
  }
}

/** ¿El acceso derivado permite jugar competitivo ahora? */
export function hasCompetitiveAccess(access: CompetitiveAccess): boolean {
  return access === 'active' || access === 'canceled_but_active';
}
