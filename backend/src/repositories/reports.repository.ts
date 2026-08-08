/* =============================================================
 * Backend · Repository de reportes (tabla `reports`)
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { query } from '../db/pool.js';

export async function createReport(reporterId: string, targetId: string, reason: string): Promise<void> {
  await query(
    `INSERT INTO reports (reporter_id, target_id, reason) VALUES ($1, $2, $3)`,
    [reporterId, targetId, reason],
  );
}

export interface ReportRow {
  id: string;
  reporterId: string;
  targetId: string;
  targetUsername: string | null;
  reason: string;
  status: string;
  createdAt: Date;
}

export async function listReports(status = 'open', limit = 100): Promise<ReportRow[]> {
  const res = await query<QueryResultRow>(
    `SELECT r.id, r.reporter_id, r.target_id, r.reason, r.status, r.created_at, p.username
       FROM reports r LEFT JOIN profiles p ON p.user_id = r.target_id
      WHERE ($1 = 'all' OR r.status = $1)
      ORDER BY r.created_at DESC LIMIT $2`,
    [status, limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    reporterId: r.reporter_id,
    targetId: r.target_id,
    targetUsername: r.username,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function resolveReport(
  reportId: string,
  adminId: string,
  status: 'resolved' | 'dismissed',
): Promise<boolean> {
  const res = await query(
    `UPDATE reports SET status = $2, resolved_by = $3, resolved_at = now()
      WHERE id = $1 AND status = 'open'`,
    [reportId, status, adminId],
  );
  return (res.rowCount ?? 0) > 0;
}
