/* =============================================================
 * Competitivo · Elegibilidad central (una sola fuente de verdad)
 * -------------------------------------------------------------
 * `canPlayCompetitive` centraliza TODAS las condiciones de acceso para
 * que ningún endpoint las duplique. El servidor es la autoridad.
 * ============================================================= */
import {
  deriveAccess,
  hasCompetitiveAccess,
  type SubscriptionRecord,
} from './subscription.js';

export interface CompetitiveUser {
  /** ¿Autenticado? (el endpoint ya debería garantizarlo, pero se re-chequea). */
  authenticated: boolean;
  /** ¿Sancionado / bloqueado por abuso? */
  banned: boolean;
  subscription: SubscriptionRecord | null;
}

export type EligibilityReason =
  | 'ok'
  | 'not_authenticated'
  | 'banned'
  | 'no_subscription'
  | 'subscription_expired'
  | 'subscription_pending';

export interface Eligibility {
  allowed: boolean;
  reason: EligibilityReason;
}

/** Decisión central de acceso al competitivo. */
export function canPlayCompetitive(
  user: CompetitiveUser,
  now: number = Date.now(),
): Eligibility {
  if (!user.authenticated) return { allowed: false, reason: 'not_authenticated' };
  if (user.banned) return { allowed: false, reason: 'banned' };

  const access = deriveAccess(user.subscription, now);
  if (hasCompetitiveAccess(access)) return { allowed: true, reason: 'ok' };

  switch (access) {
    case 'pending':
      return { allowed: false, reason: 'subscription_pending' };
    case 'expired':
      return { allowed: false, reason: 'subscription_expired' };
    default:
      return { allowed: false, reason: 'no_subscription' };
  }
}
