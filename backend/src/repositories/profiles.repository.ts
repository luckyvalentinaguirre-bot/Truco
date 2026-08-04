/* =============================================================
 * Backend · Repository de perfiles (tabla `profiles`)
 * -------------------------------------------------------------
 * Relación 1:1 con `users` (PK = user_id). Queries parametrizadas.
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { query } from '../db/pool.js';
import {
  isForeignKeyViolation,
  isUniqueViolation,
  ProfileAlreadyExistsError,
  UsernameTakenError,
  UserNotFoundError,
} from './errors.js';

/** Perfil tal como lo expone el repository (camelCase). */
export interface Profile {
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos para crear un perfil asociado a un usuario. */
export interface CreateProfileInput {
  userId: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
}

/** Fila cruda de la tabla `profiles`. */
interface ProfileRow extends QueryResultRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS =
  'user_id, username, display_name, avatar, created_at, updated_at';

/**
 * Crea un perfil para un usuario. Lanza:
 *  - UsernameTakenError si el username ya existe,
 *  - ProfileAlreadyExistsError si el usuario ya tiene perfil,
 *  - UserNotFoundError si el user_id no existe.
 */
export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  try {
    const res = await query<ProfileRow>(
      `INSERT INTO profiles (user_id, username, display_name, avatar)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [input.userId, input.username, input.displayName ?? null, input.avatar ?? null],
    );
    return mapProfile(res.rows[0]!);
  } catch (err) {
    if (isUniqueViolation(err, 'profiles_pkey')) {
      throw new ProfileAlreadyExistsError();
    }
    if (
      isUniqueViolation(err, 'profiles_username_key') ||
      isUniqueViolation(err, 'profiles_username_lower_idx')
    ) {
      throw new UsernameTakenError();
    }
    if (isForeignKeyViolation(err)) {
      throw new UserNotFoundError();
    }
    throw err;
  }
}

/** Busca el perfil de un usuario por user_id. Null si no existe. */
export async function findProfileByUserId(userId: string): Promise<Profile | null> {
  const res = await query<ProfileRow>(
    `SELECT ${COLUMNS} FROM profiles WHERE user_id = $1`,
    [userId],
  );
  return res.rows[0] ? mapProfile(res.rows[0]) : null;
}

/** Busca un perfil por username (case-insensitive). Null si no existe. */
export async function findProfileByUsername(username: string): Promise<Profile | null> {
  const res = await query<ProfileRow>(
    `SELECT ${COLUMNS} FROM profiles WHERE lower(username) = lower($1)`,
    [username],
  );
  return res.rows[0] ? mapProfile(res.rows[0]) : null;
}

/** ¿Está disponible ese username (case-insensitive)? */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const res = await query<{ taken: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM profiles WHERE lower(username) = lower($1)) AS taken',
    [username],
  );
  return !(res.rows[0]?.taken ?? false);
}
