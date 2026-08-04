/* =============================================================
 * Backend · Repository de sesiones (tabla `sessions`)
 * -------------------------------------------------------------
 * Acceso a datos tipado, queries parametrizadas, sobre el pool/Executor
 * compartido. Sólo maneja `token_hash` (nunca el token en claro).
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { getPool, type Executor } from '../db/pool.js';

/** Sesión tal como la expone el repository (camelCase). Sin token en claro. */
export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

interface SessionRow extends QueryResultRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
  last_used_at: Date | null;
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

const COLUMNS =
  'id, user_id, token_hash, expires_at, created_at, revoked_at, last_used_at';

/** Inserta una sesión (guardando sólo el hash del token). */
export async function insertSession(
  input: CreateSessionInput,
  exec: Executor = getPool(),
): Promise<Session> {
  const res = await exec.query<SessionRow>(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNS}`,
    [input.userId, input.tokenHash, input.expiresAt],
  );
  return mapSession(res.rows[0]!);
}

/** Busca una sesión por el hash del token. Null si no existe. */
export async function findSessionByTokenHash(
  tokenHash: string,
  exec: Executor = getPool(),
): Promise<Session | null> {
  const res = await exec.query<SessionRow>(
    `SELECT ${COLUMNS} FROM sessions WHERE token_hash = $1`,
    [tokenHash],
  );
  return res.rows[0] ? mapSession(res.rows[0]) : null;
}

/** Marca `last_used_at = now()` para la sesión indicada. */
export async function touchSession(
  id: string,
  exec: Executor = getPool(),
): Promise<void> {
  await exec.query('UPDATE sessions SET last_used_at = now() WHERE id = $1', [id]);
}

/**
 * Marca `revoked_at = now()` para la sesión con ese hash, sólo si aún no
 * estaba revocada. Idempotente: devuelve true si revocó algo en esta llamada.
 */
export async function revokeSessionByTokenHash(
  tokenHash: string,
  exec: Executor = getPool(),
): Promise<boolean> {
  const res = await exec.query(
    `UPDATE sessions SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
  return (res.rowCount ?? 0) > 0;
}
