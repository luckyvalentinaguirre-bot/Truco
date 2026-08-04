/* =============================================================
 * Backend · CORS mínimo (sobre node:http, sin Express)
 * -------------------------------------------------------------
 * Allowlist de orígenes desde CORS_ORIGINS (separados por coma).
 * Nunca usa `*` (queda listo para credenciales/cookies a futuro).
 * Responde el preflight OPTIONS sin llegar al router.
 * ============================================================= */
import type { IncomingMessage, ServerResponse } from 'node:http';

const DEFAULT_DEV_ORIGIN = 'http://localhost:5173'; // Vite por defecto

const ALLOWED_METHODS = 'GET, POST, PATCH, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';

/** Orígenes permitidos: de CORS_ORIGINS, o el default de desarrollo. */
export function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || raw.trim() === '') return [DEFAULT_DEV_ORIGIN];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * Aplica CORS. Si el request es un preflight OPTIONS, responde y devuelve true
 * (el router no debe procesarlo). Para el resto, agrega los headers CORS cuando
 * el origin está permitido y devuelve false para continuar.
 */
export function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  const allowed = typeof origin === 'string' && getAllowedOrigins().includes(origin);

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    // Necesario para que el navegador envíe/acepte la cookie de sesión.
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if ((req.method ?? '').toUpperCase() === 'OPTIONS') {
    // Preflight: se responde acá sin tocar el router. Si el origin no está
    // permitido, no se conceden headers CORS (el navegador lo bloqueará).
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}
