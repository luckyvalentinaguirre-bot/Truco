/* =============================================================
 * Backend · Errores de la capa de datos
 * -------------------------------------------------------------
 * Traduce códigos de error de PostgreSQL a errores de dominio
 * tipados, para que las capas superiores no dependan de `pg`.
 * ============================================================= */

/** Códigos SQLSTATE relevantes de PostgreSQL. */
export const PG_ERRORS = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
} as const;

/** Forma mínima de un error de node-postgres con código SQLSTATE. */
interface PgErrorLike {
  code?: string;
  constraint?: string;
}

function asPgError(err: unknown): PgErrorLike | null {
  if (err && typeof err === 'object' && 'code' in err) {
    return err as PgErrorLike;
  }
  return null;
}

/** ¿El error es una violación de restricción única (opcionalmente por nombre)? */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const pg = asPgError(err);
  if (!pg || pg.code !== PG_ERRORS.UNIQUE_VIOLATION) return false;
  return constraint ? pg.constraint === constraint : true;
}

/** ¿El error es una violación de clave foránea? */
export function isForeignKeyViolation(err: unknown): boolean {
  return asPgError(err)?.code === PG_ERRORS.FOREIGN_KEY_VIOLATION;
}

/** Error base de la capa de datos. */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class EmailAlreadyExistsError extends RepositoryError {
  constructor() {
    super('Ya existe un usuario con ese email');
  }
}

export class UsernameTakenError extends RepositoryError {
  constructor() {
    super('El nombre de usuario ya está en uso');
  }
}

export class ProfileAlreadyExistsError extends RepositoryError {
  constructor() {
    super('El usuario ya tiene un perfil');
  }
}

export class UserNotFoundError extends RepositoryError {
  constructor() {
    super('No existe el usuario referenciado');
  }
}

/**
 * Credenciales inválidas. Deliberadamente NO distingue entre "email
 * inexistente" y "contraseña incorrecta": el mismo error para ambos.
 */
export class InvalidCredentialsError extends RepositoryError {
  constructor() {
    super('Credenciales inválidas');
  }
}

/** Sesión inválida: inexistente, revocada o expirada (indistinguibles). */
export class InvalidSessionError extends RepositoryError {
  constructor() {
    super('Sesión inválida');
  }
}

/** Error de validación de datos de entrada (campo + motivo). */
export class ValidationError extends RepositoryError {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
  }
}
