/* =============================================================
 * Cliente del panel administrativo. Todo va contra endpoints reales
 * del backend (autorización server-side). La cookie de sesión admin la
 * maneja el navegador (httpOnly).
 * ============================================================= */
import { apiFetch } from './client';

export interface AdminLoginResult {
  ok?: boolean;
  error?: { code: string; message: string };
  attemptsLeft?: number;
  retryAfterMs?: number;
}

/** Login admin (2ª credencial). Devuelve status + cuerpo (para manejar bloqueo). */
export async function adminLogin(password: string): Promise<{ status: number; body: AdminLoginResult }> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:10000'}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include',
  });
  const body = (await res.json().catch(() => ({}))) as AdminLoginResult;
  return { status: res.status, body };
}

export const adminLogout = () => apiFetch('/admin/logout', { method: 'POST' });
export const adminSession = () => apiFetch<{ admin: boolean }>('/admin/session');

export interface AdminUserRow {
  id: string;
  username: string | null;
  email: string;
  role: string;
  banned: boolean;
}
export const searchUsers = (q: string) =>
  apiFetch<{ results: AdminUserRow[] }>(`/admin/users/search?q=${encodeURIComponent(q)}`);

export interface AdminUserDetail {
  id: string;
  username: string | null;
  email: string;
  displayName: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  banUntil: string | null;
  createdAt: string;
  rating: number | null;
  wins: number | null;
  losses: number | null;
  subscriptionStatus: string | null;
  subscriptionUntil: string | null;
}
export const userDetail = (userId: string) =>
  apiFetch<{ user: AdminUserDetail }>(`/admin/users/detail?userId=${encodeURIComponent(userId)}`);

export const banUser = (userId: string, reason: string, days?: number) =>
  apiFetch('/admin/users/ban', { method: 'POST', body: { userId, reason, days } });
export const unbanUser = (userId: string) =>
  apiFetch('/admin/users/unban', { method: 'POST', body: { userId } });
export const grantPremium = (userId: string, days: number) =>
  apiFetch<{ ok: boolean; until: string }>('/admin/users/premium', { method: 'POST', body: { userId, days } });

export const adminStats = () => apiFetch<{ stats: Record<string, number> }>('/admin/stats');
export const adminAudit = () =>
  apiFetch<{ audit: { action: string; targetUserId: string | null; reason: string | null; result: string; date: string }[] }>(
    '/admin/audit',
  );
export const adminMatchesActive = () => apiFetch<{ matches: unknown[] }>('/admin/matches/active');
export const adminMatchesFinished = () => apiFetch<{ matches: unknown[] }>('/admin/matches/finished');
export const adminMatchmaking = () => apiFetch<{ queues: unknown[] }>('/admin/matchmaking');
export const adminPayments = () =>
  apiFetch<{ payments: { userId: string; amount: number; currency: string; status: string; date: string }[] }>(
    '/admin/payments',
  );
export const adminSeasons = () =>
  apiFetch<{ seasons: { id: string; name: string; startsAt: string; endsAt: string }[] }>('/admin/seasons');
export const adminReports = (status = 'open') =>
  apiFetch<{ reports: { id: string; targetUsername: string | null; reason: string; status: string; date: string }[] }>(
    `/admin/reports?status=${status}`,
  );
export const resolveReport = (reportId: string, status: 'resolved' | 'dismissed' = 'resolved') =>
  apiFetch('/admin/reports/resolve', { method: 'POST', body: { reportId, status } });
