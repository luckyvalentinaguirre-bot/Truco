/* =============================================================
 * Backend · Configuración de entorno
 * -------------------------------------------------------------
 * Carga variables desde `.env` (raíz del repo y/o backend/) y las
 * valida. NUNCA imprime ni expone el valor de DATABASE_URL: sólo
 * indica si está presente y expone helpers seguros.
 * ============================================================= */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url)); // .../backend/src/config
const backendRoot = resolve(here, '..', '..'); // .../backend
const repoRoot = resolve(backendRoot, '..'); // .../ (raíz del repo)

// Se cargan, si existen, el .env de la raíz del repo y el de backend/.
// dotenv NO pisa variables ya definidas en el entorno real (p. ej. en
// producción), así que el orden es seguro.
for (const candidate of [resolve(repoRoot, '.env'), resolve(backendRoot, '.env')]) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}

export interface Env {
  /** Cadena de conexión a PostgreSQL. NO loguear su valor. */
  databaseUrl: string;
  /** Entorno de ejecución. */
  nodeEnv: 'development' | 'test' | 'production';
  /** Puerto reservado para el futuro servidor HTTP. */
  port: number;
  /**
   * Modo TLS para PostgreSQL:
   *  - 'require'   → TLS activado, se valida el certificado del servidor.
   *  - 'no-verify' → TLS activado, sin validar el certificado (útil para
   *    algunos túneles/dev; menos seguro).
   *  - 'disable'   → sin TLS (sólo desarrollo local sin SSL).
   * Neon requiere TLS: por defecto 'require'.
   */
  dbSslMode: 'require' | 'no-verify' | 'disable';
}

/** Lee y valida el entorno. Lanza un error CLARO si falta DATABASE_URL. */
export function loadEnv(): Env {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    throw new Error(
      'Falta DATABASE_URL. Definila en el .env de la raíz del repo (o en el ' +
        'entorno) antes de iniciar el backend. No se incluye ningún valor por ' +
        'defecto por seguridad.',
    );
  }

  const nodeEnv = (process.env.NODE_ENV as Env['nodeEnv']) || 'development';
  // Render inyecta PORT; en local, fallback a 10000.
  const port = Number.parseInt(process.env.PORT ?? '10000', 10);
  const dbSslMode = (process.env.DATABASE_SSL as Env['dbSslMode']) || 'require';

  return { databaseUrl, nodeEnv, port, dbSslMode };
}

/**
 * Describe la conexión de forma SEGURA para logs: nunca revela usuario,
 * contraseña ni la cadena completa; a lo sumo el host y la base.
 */
export function safeDbSummary(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl);
    const db = u.pathname.replace(/^\//, '') || '(default)';
    return `${u.hostname}/${db}`;
  } catch {
    return '(cadena de conexión no estándar)';
  }
}
