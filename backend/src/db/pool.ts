/* =============================================================
 * Backend · Pool de conexiones a PostgreSQL (reutilizable)
 * -------------------------------------------------------------
 * Un único Pool compartido por todo el backend. Usa DATABASE_URL
 * desde el entorno (nunca hardcodeado). Neon exige TLS.
 * ============================================================= */
import pg from 'pg';
import { loadEnv, type Env } from '../config/env.js';

const { Pool } = pg;

/** Traduce el modo TLS del entorno a la opción `ssl` de node-postgres. */
function sslOption(mode: Env['dbSslMode']): pg.PoolConfig['ssl'] {
  switch (mode) {
    case 'disable':
      return false;
    case 'no-verify':
      return { rejectUnauthorized: false };
    case 'require':
    default:
      // TLS validando el certificado del servidor (recomendado para Neon).
      return { rejectUnauthorized: true };
  }
}

let pool: pg.Pool | null = null;

/** Devuelve el Pool compartido, creándolo la primera vez. */
export function getPool(): pg.Pool {
  if (pool) return pool;
  const env = loadEnv();
  pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: sslOption(env.dbSslMode),
    // Límites conservadores para la etapa inicial.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // Evita que un error del socket idle tumbe el proceso sin contexto.
  pool.on('error', (err) => {
    console.error('[db] error inesperado en un cliente idle del pool:', err.message);
  });
  return pool;
}

/** Cierra el Pool (para tests/scripts que terminan el proceso). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Ejecuta una consulta usando el Pool compartido. Azúcar tipado sobre
 * `pool.query` para el resto del backend.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}
