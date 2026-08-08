/* Cliente competitivo + suscripción (endpoints reales del backend). */
import { apiFetch } from './client';

export interface CompetitiveMe {
  rating: number;
  rank: { id: string; name: string };
  wins: number;
  losses: number;
  bestRating: number;
  streak: number;
  games: number;
  winrate: number;
  access: string;
  season: { id: string; name: string; endsAt: string } | null;
}
export const getCompetitiveMe = () => apiFetch<CompetitiveMe>('/competitive/me');

export interface SubscriptionState {
  subscription: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | null;
  access: string;
  priceUsd: number;
}
export const getSubscription = () => apiFetch<SubscriptionState>('/subscription');
export const checkoutSubscription = () =>
  apiFetch<{ checkoutUrl: string | null; subscriptionId: string }>('/subscription/checkout', { method: 'POST' });
export const cancelSubscription = () => apiFetch('/subscription/cancel', { method: 'POST' });
