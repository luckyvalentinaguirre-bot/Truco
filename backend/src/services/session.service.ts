/* =============================================================
 * Backend · Servicio de dominio: sesiones
 * -------------------------------------------------------------
 * createSession / validateSession / revokeSession sobre la tabla
 * `sessions`. El token en claro sólo existe en memoria y se devuelve
 * al caller; en la base se guarda únicamente su hash. Nunca se loguea
 * ni se incluye el token en errores.
 * ============================================================= */
import { InvalidSessionError } from '../repositories/errors.js';
import {
  insertSession,
  findSessionByTokenHash,
  touchSession,
  revokeSessionByTokenHash,
} from '../repositories/sessions.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { findProfileByUserId } from '../repositories/profiles.repository.js';
import { generateSessionToken, hashToken } from './token.js';

/** Duración de una sesión inicial (centralizada/configurable). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

/** Resultado de crear una sesión: el token SÓLO se devuelve aquí. */
export interface CreatedSession {
  token: string;
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

/** Identidad mínima de una sesión válida (sin token ni hashes). */
export interface SessionIdentity {
  userId: string;
  sessionId: string;
}

/** Usuario autenticado resuelto desde un token de sesión (sin datos sensibles). */
export interface AuthenticatedUser {
  user: {
    id: string;
    email: string;
  };
  profile: {
    username: string;
    displayName: string | null;
    avatar: string | null;
  };
  session: {
    id: string;
  };
}

/**
 * Crea una sesión para un usuario. Genera un token seguro, persiste sólo su
 * hash y devuelve el token en claro (única vez que se expone).
 */
export async function createSession(
  userId: string,
  ttlMs: number = SESSION_TTL_MS,
): Promise<CreatedSession> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);
  const session = await insertSession({ userId, tokenHash, expiresAt });
  return {
    token,
    sessionId: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
  };
}

/**
 * Valida un token de sesión. Lanza InvalidSessionError si no existe, está
 * revocada o expiró. Si es válida, refresca `last_used_at` y devuelve la
 * identidad mínima. Nunca devuelve token ni hashes.
 */
export async function validateSession(token: string): Promise<SessionIdentity> {
  const session = await findSessionByTokenHash(hashToken(token));

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    throw new InvalidSessionError();
  }

  await touchSession(session.id);
  return { userId: session.userId, sessionId: session.id };
}

/**
 * Revoca una sesión por su token. Idempotente y seguro: si el token no existe
 * o ya estaba revocado, no lanza error. Devuelve true sólo si esta llamada
 * fue la que revocó la sesión.
 */
export async function revokeSession(token: string): Promise<boolean> {
  return revokeSessionByTokenHash(hashToken(token));
}

/**
 * Resuelve el usuario autenticado a partir de un token de sesión: valida la
 * sesión y carga user + profile. Lanza InvalidSessionError si la sesión no es
 * válida o si el usuario/perfil asociado ya no existe. No crea tokens ni
 * expone password_hash/token/token_hash.
 */
export async function getSessionUser(token: string): Promise<AuthenticatedUser> {
  const { userId, sessionId } = await validateSession(token);

  const user = await findUserById(userId);
  const profile = user ? await findProfileByUserId(userId) : null;
  if (!user || !profile) {
    // El usuario/perfil ya no existe: se trata igual que sesión inválida.
    throw new InvalidSessionError();
  }

  // Baneo server-side: un usuario baneado no puede operar aunque tenga sesión
  // (ni creando una nueva). Se chequea en CADA request autenticado.
  const { isBanned } = await import('../repositories/admin.repository.js');
  if (await isBanned(userId)) {
    const { BannedError } = await import('../repositories/errors.js');
    throw new BannedError(null);
  }

  return {
    user: { id: user.id, email: user.email },
    profile: {
      username: profile.username,
      displayName: profile.displayName,
      avatar: profile.avatar,
    },
    session: { id: sessionId },
  };
}
