/* =============================================================
 * Backend · Rate limiting mínimo en memoria (sin dependencias)
 * -------------------------------------------------------------
 * Protege rutas sensibles (login/registro) contra fuerza bruta y
 * abuso. Ventana fija por clave (IP + acción). NO usa servicios
 * externos: suficiente para una beta en una sola instancia. Si en el
 * futuro hay varias instancias, migrar a un store compartido (Redis).
 * ============================================================= */
import type { IncomingMessage } from 'node:http';
import { tooManyRequests } from './httpError.js';

interface Bucket {
  count: number;
  resetAt: number; // epoch ms en que la ventana se reinicia
}

const buckets = new Map<string, Bucket>();

/** Obtiene la IP del cliente respetando el proxy de Render (x-forwarded-for). */
export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    // Primer hop = IP original del cliente.
    return fwd.split(',')[0]!.trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Consume un intento para (`action`, IP). Lanza 429 si se superó el límite
 * dentro de la ventana. Determinista y barato: O(1) por request.
 */
export function rateLimit(
  req: IncomingMessage,
  action: string,
  opts: { max: number; windowMs: number },
): void {
  const key = `${action}:${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }
  if (b.count >= opts.max) {
    throw tooManyRequests();
  }
  b.count += 1;
}

/** Limpia buckets vencidos (evita crecimiento ilimitado del Map). */
function sweep(): void {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

// Barrido periódico liviano; `unref` para no impedir que el proceso termine.
const timer = setInterval(sweep, 60_000);
if (typeof timer.unref === 'function') timer.unref();

/** Sólo para tests: reinicia el estado interno. */
export function __resetRateLimit(): void {
  buckets.clear();
}
