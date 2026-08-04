/* =============================================================
 * Backend · Lectura segura del request (body JSON con límites)
 * ============================================================= */
import type { IncomingMessage } from 'node:http';
import { badRequest, payloadTooLarge, unsupportedMediaType } from './httpError.js';

/** Límite de tamaño del body para endpoints de auth (evita agotar memoria). */
export const AUTH_BODY_LIMIT_BYTES = 10 * 1024; // 10 KB

/**
 * Lee y parsea el body como JSON, con límite de tamaño. Lanza HttpError:
 *  - 415 si el Content-Type no es application/json,
 *  - 413 si supera el límite,
 *  - 400 si el body está vacío o el JSON es inválido.
 */
export async function readJsonBody<T = unknown>(
  req: IncomingMessage,
  limit = AUTH_BODY_LIMIT_BYTES,
): Promise<T> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw unsupportedMediaType();
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > limit) {
      throw payloadTooLarge();
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) {
    throw badRequest('El cuerpo es obligatorio');
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw badRequest('JSON inválido');
  }
}
