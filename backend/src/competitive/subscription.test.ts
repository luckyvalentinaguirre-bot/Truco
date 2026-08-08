/* =============================================================
 * §49 · Suscripción: activa, expirada, cancelada, pendiente, past_due.
 * §11 · Elegibilidad competitiva centralizada.
 * ============================================================= */
import { describe, it, expect } from 'vitest';
import {
  deriveAccess,
  hasCompetitiveAccess,
  type SubscriptionRecord,
} from './subscription.js';
import { canPlayCompetitive } from './eligibility.js';

const NOW = 1_000_000_000_000;
const future = NOW + 5 * 24 * 3600_000;
const past = NOW - 5 * 24 * 3600_000;

const rec = (o: Partial<SubscriptionRecord>): SubscriptionRecord => ({
  status: 'active',
  currentPeriodEnd: future,
  cancelAtPeriodEnd: false,
  ...o,
});

describe('subscription · deriveAccess', () => {
  it('sin suscripción ⇒ blocked', () => {
    expect(deriveAccess(null, NOW)).toBe('blocked');
  });
  it('activa y vigente ⇒ active', () => {
    expect(deriveAccess(rec({}), NOW)).toBe('active');
  });
  it('activa pero período vencido ⇒ expired', () => {
    expect(deriveAccess(rec({ currentPeriodEnd: past }), NOW)).toBe('expired');
  });
  it('cancelada pero período vigente ⇒ sigue con acceso', () => {
    expect(deriveAccess(rec({ status: 'canceled' }), NOW)).toBe('canceled_but_active');
  });
  it('cancelada y período vencido ⇒ expired', () => {
    expect(deriveAccess(rec({ status: 'canceled', currentPeriodEnd: past }), NOW)).toBe(
      'expired',
    );
  });
  it('pending ⇒ pending', () => {
    expect(deriveAccess(rec({ status: 'pending', currentPeriodEnd: null }), NOW)).toBe(
      'pending',
    );
  });
  it('past_due con período aún vigente ⇒ acceso; sin período ⇒ blocked', () => {
    expect(deriveAccess(rec({ status: 'past_due' }), NOW)).toBe('active');
    expect(deriveAccess(rec({ status: 'past_due', currentPeriodEnd: past }), NOW)).toBe(
      'blocked',
    );
  });
  it('cancelar no revoca de inmediato el período pagado (respeta lo pagado)', () => {
    const access = deriveAccess(rec({ status: 'canceled' }), NOW);
    expect(hasCompetitiveAccess(access)).toBe(true);
  });
});

describe('eligibility · canPlayCompetitive (§11)', () => {
  it('no autenticado ⇒ bloqueado', () => {
    expect(
      canPlayCompetitive({ authenticated: false, banned: false, subscription: rec({}) }, NOW),
    ).toEqual({ allowed: false, reason: 'not_authenticated' });
  });
  it('baneado ⇒ bloqueado aunque tenga suscripción', () => {
    expect(
      canPlayCompetitive({ authenticated: true, banned: true, subscription: rec({}) }, NOW)
        .reason,
    ).toBe('banned');
  });
  it('sin suscripción ⇒ no_subscription', () => {
    expect(
      canPlayCompetitive({ authenticated: true, banned: false, subscription: null }, NOW),
    ).toEqual({ allowed: false, reason: 'no_subscription' });
  });
  it('activa vigente ⇒ permitido', () => {
    expect(
      canPlayCompetitive({ authenticated: true, banned: false, subscription: rec({}) }, NOW),
    ).toEqual({ allowed: true, reason: 'ok' });
  });
  it('expirada ⇒ subscription_expired', () => {
    expect(
      canPlayCompetitive(
        { authenticated: true, banned: false, subscription: rec({ currentPeriodEnd: past }) },
        NOW,
      ).reason,
    ).toBe('subscription_expired');
  });
});
