/* =============================================================
 * Backend · Servicio de dominio: verificación de credenciales
 * -------------------------------------------------------------
 * Comprueba email + contraseña contra `users`. No revela si el
 * email existe o si la contraseña es incorrecta: ambos casos
 * producen el mismo InvalidCredentialsError. Nunca devuelve el hash
 * ni la contraseña.
 * ============================================================= */
import { InvalidCredentialsError } from '../repositories/errors.js';
import { findUserByEmail } from '../repositories/users.repository.js';
import { hashPassword, verifyPassword } from './password.js';

/** Identidad mínima devuelta al verificar credenciales (sin hash). */
export interface VerifiedIdentity {
  userId: string;
  email: string;
  emailNormalized: string;
}

// Hash "señuelo" para gastar tiempo de verificación aun cuando el email no
// existe, y así no filtrar la existencia del email por diferencia de tiempo.
const DUMMY_HASH_PROMISE = hashPassword('invalid-credentials-placeholder');

/**
 * Verifica email + contraseña. Devuelve la identidad mínima si son válidas;
 * lanza InvalidCredentialsError (idéntico) si el email no existe o la
 * contraseña es incorrecta.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<VerifiedIdentity> {
  // findUserByEmail ya normaliza el email con la misma lógica del repository.
  const user = await findUserByEmail(email);

  if (!user) {
    // Se compara contra un hash señuelo para igualar el tiempo de respuesta
    // (defensa contra ataques de temporización), y se falla igual.
    await verifyPassword(password, await DUMMY_HASH_PROMISE);
    throw new InvalidCredentialsError();
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new InvalidCredentialsError();
  }

  return {
    userId: user.id,
    email: user.email,
    emailNormalized: user.emailNormalized,
  };
}
