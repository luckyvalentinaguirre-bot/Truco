/* =============================================================
 * Backend · Error HTTP con status + mensaje seguro
 * -------------------------------------------------------------
 * Nunca expone stack traces ni detalles internos: sólo un status y
 * un mensaje genérico apto para el cliente.
 * ============================================================= */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg = 'Solicitud inválida') =>
  new HttpError(400, 'bad_request', msg);
export const unauthorized = (msg = 'No autorizado') =>
  new HttpError(401, 'unauthorized', msg);
export const unsupportedMediaType = (msg = 'Content-Type debe ser application/json') =>
  new HttpError(415, 'unsupported_media_type', msg);
export const payloadTooLarge = (msg = 'Cuerpo demasiado grande') =>
  new HttpError(413, 'payload_too_large', msg);
