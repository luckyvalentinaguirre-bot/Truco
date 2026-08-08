/* =============================================================
 * Backend · Mapeo de errores de dominio → respuesta HTTP
 * -------------------------------------------------------------
 * Traduce errores conocidos a status seguros. Nunca expone stack
 * traces ni errores internos de PostgreSQL: los inesperados caen a
 * 500 con mensaje genérico.
 * ============================================================= */
import {
  BannedError,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidSessionError,
  UsernameTakenError,
  ValidationError,
} from '../repositories/errors.js';
import { HttpError } from './httpError.js';

export interface ErrorResponse {
  status: number;
  body: { error: { code: string; message: string } };
}

/** Convierte cualquier error en una respuesta HTTP segura. */
export function mapError(err: unknown): ErrorResponse {
  if (err instanceof HttpError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  if (err instanceof ValidationError) {
    return { status: 400, body: { error: { code: 'validation_error', message: err.message } } };
  }
  if (err instanceof EmailAlreadyExistsError) {
    return { status: 409, body: { error: { code: 'email_taken', message: err.message } } };
  }
  if (err instanceof UsernameTakenError) {
    return { status: 409, body: { error: { code: 'username_taken', message: err.message } } };
  }
  if (err instanceof InvalidCredentialsError) {
    return { status: 401, body: { error: { code: 'invalid_credentials', message: err.message } } };
  }
  if (err instanceof InvalidSessionError) {
    return { status: 401, body: { error: { code: 'invalid_session', message: err.message } } };
  }
  if (err instanceof BannedError) {
    return { status: 403, body: { error: { code: 'banned', message: err.message } } };
  }
  // Inesperado: se registra sólo el tipo (sin secretos) y se responde genérico.
  console.error('[http] error inesperado:', err instanceof Error ? err.name : typeof err);
  return { status: 500, body: { error: { code: 'internal_error', message: 'Error interno' } } };
}
