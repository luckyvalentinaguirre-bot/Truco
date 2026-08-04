/* =============================================================
 * Backend · Repository de usuarios (tabla `users`)
 * -------------------------------------------------------------
 * Acceso a datos tipado, con queries SIEMPRE parametrizadas.
 * Recibe un `password_hash` ya generado (el hashing se implementa
 * más adelante). Nunca guarda contraseñas en texto plano.
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { getPool, type Executor } from '../db/pool.js';
import { EmailAlreadyExistsError, isUniqueViolation } from './errors.js';

/** Usuario tal como lo expone el repository (camelCase). */
export interface User {
  id: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos para crear un usuario (el hash ya viene generado). */
export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

/** Fila cruda de la tabla `users`. */
interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

/** Normaliza un email para unicidad/búsqueda case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    emailNormalized: row.email_normalized,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS =
  'id, email, email_normalized, password_hash, created_at, updated_at';

/** Crea un usuario. Lanza EmailAlreadyExistsError si el email ya existe. */
export async function createUser(
  input: CreateUserInput,
  exec: Executor = getPool(),
): Promise<User> {
  const emailNormalized = normalizeEmail(input.email);
  try {
    const res = await exec.query<UserRow>(
      `INSERT INTO users (email, email_normalized, password_hash)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
      [input.email.trim(), emailNormalized, input.passwordHash],
    );
    return mapUser(res.rows[0]!);
  } catch (err) {
    if (isUniqueViolation(err, 'users_email_normalized_key')) {
      throw new EmailAlreadyExistsError();
    }
    throw err;
  }
}

/** Busca un usuario por email (normalizado). Devuelve null si no existe. */
export async function findUserByEmail(
  email: string,
  exec: Executor = getPool(),
): Promise<User | null> {
  const res = await exec.query<UserRow>(
    `SELECT ${COLUMNS} FROM users WHERE email_normalized = $1`,
    [normalizeEmail(email)],
  );
  return res.rows[0] ? mapUser(res.rows[0]) : null;
}

/** Busca un usuario por id. Devuelve null si no existe. */
export async function findUserById(
  id: string,
  exec: Executor = getPool(),
): Promise<User | null> {
  const res = await exec.query<UserRow>(
    `SELECT ${COLUMNS} FROM users WHERE id = $1`,
    [id],
  );
  return res.rows[0] ? mapUser(res.rows[0]) : null;
}

/** ¿Ya existe un usuario con ese email? */
export async function emailExists(
  email: string,
  exec: Executor = getPool(),
): Promise<boolean> {
  const res = await exec.query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM users WHERE email_normalized = $1) AS exists',
    [normalizeEmail(email)],
  );
  return res.rows[0]?.exists ?? false;
}
