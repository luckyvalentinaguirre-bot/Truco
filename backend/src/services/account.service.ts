/* =============================================================
 * Backend · Servicio de dominio: creación de cuenta
 * -------------------------------------------------------------
 * Coordina validación → hashing → creación de `users` + `profiles`
 * dentro de UNA sola transacción (rollback conjunto). Nunca queda un
 * user sin profile, y nunca se persiste ni se devuelve la contraseña.
 * ============================================================= */
import { withTransaction } from '../db/pool.js';
import { ValidationError } from '../repositories/errors.js';
import {
  createUser,
  normalizeEmail,
  type User,
} from '../repositories/users.repository.js';
import { createProfile, type Profile } from '../repositories/profiles.repository.js';
import { hashPassword } from './password.js';

export interface CreateAccountInput {
  email: string;
  password: string;
  username: string;
}

/** Cuenta pública devuelta por el servicio: SIN hash ni contraseña. */
export interface PublicAccount {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  createdAt: Date;
}

// ---- Validación de dominio ----------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]+$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const EMAIL_MAX = 254;

function validateEmail(raw: string): string {
  const email = raw.trim();
  if (email.length === 0) throw new ValidationError('email', 'El email es obligatorio');
  if (email.length > EMAIL_MAX) throw new ValidationError('email', 'Email demasiado largo');
  if (!EMAIL_RE.test(email)) throw new ValidationError('email', 'Formato de email inválido');
  return email;
}

function validateUsername(raw: string): string {
  const username = raw.trim();
  if (username.length === 0) {
    throw new ValidationError('username', 'El nombre de usuario es obligatorio');
  }
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    throw new ValidationError(
      'username',
      `El nombre de usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres`,
    );
  }
  if (!USERNAME_RE.test(username)) {
    throw new ValidationError(
      'username',
      'El nombre de usuario sólo admite letras, números y guion bajo',
    );
  }
  return username;
}

function validatePassword(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new ValidationError('password', 'La contraseña es obligatoria');
  }
  if (raw.length < PASSWORD_MIN) {
    throw new ValidationError('password', `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`);
  }
  if (raw.length > PASSWORD_MAX) {
    throw new ValidationError('password', 'La contraseña es demasiado larga');
  }
  return raw;
}

function toPublic(user: User, profile: Profile): PublicAccount {
  return {
    id: user.id,
    email: user.email,
    username: profile.username,
    displayName: profile.displayName,
    avatar: profile.avatar,
    createdAt: user.createdAt,
  };
}

/**
 * Crea una cuenta (user + profile) de forma transaccional.
 * Lanza ValidationError, EmailAlreadyExistsError o UsernameTakenError.
 * Nunca devuelve el hash ni la contraseña.
 */
export async function createAccount(input: CreateAccountInput): Promise<PublicAccount> {
  // 1) Validar/normalizar (falla temprano, antes de tocar la base).
  const email = validateEmail(input.email);
  const username = validateUsername(input.username);
  const password = validatePassword(input.password);
  // Coherente con el repository (búsqueda/unicidad por email_normalized).
  void normalizeEmail(email);

  // 2) Hashear la contraseña (sólo el hash se persiste).
  const passwordHash = await hashPassword(password);

  // 3) Transacción única: user + profile juntos (rollback si algo falla).
  const { user, profile } = await withTransaction(async (client) => {
    const user = await createUser({ email, passwordHash }, client);
    const profile = await createProfile({ userId: user.id, username }, client);
    return { user, profile };
  });

  return toPublic(user, profile);
}
