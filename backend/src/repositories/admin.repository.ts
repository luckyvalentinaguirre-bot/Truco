/* =============================================================
 * Backend · Repository de administración
 * -------------------------------------------------------------
 * Bloqueo del panel, auditoría, sesión admin elevada, rol y baneos, búsqueda y
 * ficha de usuarios. Todo con queries parametrizadas. Reutiliza `users`,
 * `profiles`, `competitive_ratings` y `subscriptions`.
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { query } from '../db/pool.js';

// -------------------- Bloqueo del panel (singleton) --------------------

export interface Lockout {
  failedAttempts: number;
  lockedUntil: Date | null;
}

export async function getLockout(): Promise<Lockout> {
  const res = await query<{ failed_attempts: number; locked_until: Date | null }>(
    `SELECT failed_attempts, locked_until FROM admin_lockout WHERE id = TRUE`,
  );
  if (!res.rows[0]) return { failedAttempts: 0, lockedUntil: null };
  return { failedAttempts: res.rows[0].failed_attempts, lockedUntil: res.rows[0].locked_until };
}

export async function setLockout(failedAttempts: number, lockedUntil: Date | null): Promise<void> {
  await query(
    `INSERT INTO admin_lockout (id, failed_attempts, locked_until, updated_at)
       VALUES (TRUE, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET failed_attempts = $1, locked_until = $2, updated_at = now()`,
    [failedAttempts, lockedUntil],
  );
}

// -------------------- Auditoría --------------------

export interface AuditInput {
  adminId: string | null;
  action: string;
  targetUserId?: string | null;
  reason?: string | null;
  result?: string;
  meta?: Record<string, unknown> | null;
}

export async function insertAudit(a: AuditInput): Promise<void> {
  await query(
    `INSERT INTO admin_audit_log (admin_id, action, target_user_id, reason, result, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
    [a.adminId, a.action, a.targetUserId ?? null, a.reason ?? null, a.result ?? 'ok', a.meta ?? null],
  );
}

export interface AuditRow {
  action: string;
  adminId: string | null;
  targetUserId: string | null;
  reason: string | null;
  result: string;
  createdAt: Date;
}

export async function listAudit(limit = 100): Promise<AuditRow[]> {
  const res = await query<QueryResultRow>(
    `SELECT action, admin_id, target_user_id, reason, result, created_at
       FROM admin_audit_log ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows.map((r) => ({
    action: r.action,
    adminId: r.admin_id,
    targetUserId: r.target_user_id,
    reason: r.reason,
    result: r.result,
    createdAt: r.created_at,
  }));
}

// -------------------- Sesión admin elevada --------------------

export async function createAdminSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await query(`INSERT INTO admin_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [
    userId,
    tokenHash,
    expiresAt,
  ]);
}

export async function findAdminSession(tokenHash: string): Promise<string | null> {
  const res = await query<{ user_id: string }>(
    `SELECT user_id FROM admin_sessions WHERE token_hash = $1 AND expires_at > now()`,
    [tokenHash],
  );
  return res.rows[0]?.user_id ?? null;
}

export async function deleteAdminSession(tokenHash: string): Promise<void> {
  await query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [tokenHash]);
}

// -------------------- Rol y baneos --------------------

export async function getRole(userId: string): Promise<string | null> {
  const res = await query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [userId]);
  return res.rows[0]?.role ?? null;
}

export async function setRole(userId: string, role: 'user' | 'admin'): Promise<void> {
  await query(`UPDATE users SET role = $2, updated_at = now() WHERE id = $1`, [userId, role]);
}

export async function banUser(
  userId: string,
  opts: { reason: string; until: Date | null; byAdminId: string },
): Promise<void> {
  await query(
    `UPDATE users SET banned = TRUE, ban_reason = $2, ban_until = $3,
            banned_at = now(), banned_by = $4, updated_at = now()
      WHERE id = $1`,
    [userId, opts.reason, opts.until, opts.byAdminId],
  );
}

export async function unbanUser(userId: string): Promise<void> {
  await query(
    `UPDATE users SET banned = FALSE, ban_reason = NULL, ban_until = NULL,
            banned_at = NULL, banned_by = NULL, updated_at = now()
      WHERE id = $1`,
    [userId],
  );
}

/** ¿El usuario está baneado y el baneo sigue vigente? (server-side). */
export async function isBanned(userId: string): Promise<boolean> {
  const res = await query<{ banned: boolean; ban_until: Date | null }>(
    `SELECT banned, ban_until FROM users WHERE id = $1`,
    [userId],
  );
  const r = res.rows[0];
  if (!r || !r.banned) return false;
  return r.ban_until === null || r.ban_until.getTime() > Date.now();
}

// -------------------- Búsqueda y ficha --------------------

export interface UserSearchResult {
  id: string;
  username: string | null;
  email: string;
  role: string;
  banned: boolean;
}

/** Busca usuarios por username, email o id exacto. Queries parametrizadas. */
export async function searchUsers(q: string, limit = 25): Promise<UserSearchResult[]> {
  const like = `%${q}%`;
  const isUuid = /^[0-9a-f-]{36}$/i.test(q);
  const res = await query<QueryResultRow>(
    `SELECT u.id, u.email, u.role, u.banned, p.username
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE p.username ILIKE $1
         OR u.email ILIKE $1
         OR ($2 AND u.id = $3::uuid)
      ORDER BY p.username NULLS LAST
      LIMIT $4`,
    [like, isUuid, isUuid ? q : '00000000-0000-0000-0000-000000000000', limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    role: r.role,
    banned: r.banned,
  }));
}

export interface UserDetail {
  id: string;
  username: string | null;
  email: string;
  displayName: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  banUntil: Date | null;
  createdAt: Date;
  rating: number | null;
  wins: number | null;
  losses: number | null;
  subscriptionStatus: string | null;
  subscriptionUntil: Date | null;
}

/** Ficha administrativa completa de un usuario. */
export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const res = await query<QueryResultRow>(
    `SELECT u.id, u.email, u.role, u.banned, u.ban_reason, u.ban_until, u.created_at,
            p.username, p.display_name,
            r.rating, r.wins, r.losses,
            s.status AS sub_status, s.current_period_end AS sub_until
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT rating, wins, losses FROM competitive_ratings
          WHERE user_id = u.id ORDER BY updated_at DESC LIMIT 1
       ) r ON TRUE
       LEFT JOIN subscriptions s ON s.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    banned: r.banned,
    banReason: r.ban_reason,
    banUntil: r.ban_until,
    createdAt: r.created_at,
    rating: r.rating,
    wins: r.wins,
    losses: r.losses,
    subscriptionStatus: r.sub_status,
    subscriptionUntil: r.sub_until,
  };
}

/** Contadores para el dashboard (usuarios, premium, partidas, baneos…). */
export async function platformStats(): Promise<Record<string, number>> {
  const res = await query<QueryResultRow>(`
    SELECT
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM users WHERE banned)::int AS banned,
      (SELECT count(*) FROM subscriptions WHERE status = 'active')::int AS premium_active,
      (SELECT count(*) FROM competitive_matches)::int AS matches,
      (SELECT count(*) FROM competitive_matches WHERE status = 'resolved')::int AS matches_resolved,
      (SELECT count(*) FROM payments)::int AS payments,
      (SELECT count(*) FROM seasons)::int AS seasons
  `);
  const r = res.rows[0] ?? {};
  return {
    users: r.users ?? 0,
    banned: r.banned ?? 0,
    premiumActive: r.premium_active ?? 0,
    matches: r.matches ?? 0,
    matchesResolved: r.matches_resolved ?? 0,
    payments: r.payments ?? 0,
    seasons: r.seasons ?? 0,
  };
}
