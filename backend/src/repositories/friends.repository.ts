/* =============================================================
 * Backend · Repository de amistades (tabla `friendships`)
 * -------------------------------------------------------------
 * Solicitud dirigida (requester → addressee). La amistad efectiva es una fila
 * con status 'accepted' en cualquiera de los dos sentidos. Queries parametrizadas.
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { query, getPool, type Executor } from '../db/pool.js';

export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export interface FriendUser {
  userId: string;
  username: string;
}

interface UserRow extends QueryResultRow {
  user_id: string;
  username: string;
}

/** Crea una solicitud pendiente (idempotente: si ya existe, no falla). */
export async function createRequest(
  requesterId: string,
  addresseeId: string,
  exec: Executor = getPool(),
): Promise<void> {
  await exec.query(
    `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending')
     ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
    [requesterId, addresseeId],
  );
}

/** ¿Existe una solicitud pendiente de `from` hacia `to`? */
export async function hasPendingRequest(from: string, to: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM friendships WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [from, to],
  );
  return res.rows.length > 0;
}

/** Acepta la solicitud que `otherId` le envió a `userId`. Devuelve si aplicó. */
export async function acceptRequest(userId: string, otherId: string): Promise<boolean> {
  const res = await query(
    `UPDATE friendships SET status = 'accepted', updated_at = now()
      WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [otherId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Borra cualquier relación (solicitud o amistad) entre dos usuarios. */
export async function removeFriendship(userId: string, otherId: string): Promise<void> {
  await query(
    `DELETE FROM friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, otherId],
  );
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1))`,
    [a, b],
  );
  return res.rows.length > 0;
}

/** Amigos aceptados de `userId` (el "otro" lado de la relación). */
export async function listFriends(userId: string): Promise<FriendUser[]> {
  const res = await query<UserRow>(
    `SELECT u.user_id, p.username
       FROM (
         SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS user_id
           FROM friendships
          WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
       ) u
       JOIN profiles p ON p.user_id = u.user_id
      ORDER BY p.username`,
    [userId],
  );
  return res.rows.map((r) => ({ userId: r.user_id, username: r.username }));
}

/** Solicitudes pendientes RECIBIDAS por `userId` (quién le pidió amistad). */
export async function listIncomingRequests(userId: string): Promise<FriendUser[]> {
  const res = await query<UserRow>(
    `SELECT f.requester_id AS user_id, p.username
       FROM friendships f JOIN profiles p ON p.user_id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY p.username`,
    [userId],
  );
  return res.rows.map((r) => ({ userId: r.user_id, username: r.username }));
}
