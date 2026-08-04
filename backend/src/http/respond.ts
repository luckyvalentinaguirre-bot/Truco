/* =============================================================
 * Backend · Helpers de respuesta HTTP (JSON + headers de seguridad)
 * ============================================================= */
import type { ServerResponse } from 'node:http';

/** Headers básicos de seguridad (sin sobreingeniería). */
function securityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
}

/** Responde con JSON y el status indicado. */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  securityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Responde 204 sin cuerpo. */
export function sendNoContent(res: ServerResponse): void {
  securityHeaders(res);
  res.writeHead(204);
  res.end();
}
