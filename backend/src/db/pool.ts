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

/**
 * Ejecutor de queries: tanto el Pool como un PoolClient (dentro de una
 * transacción) exponen `query`. Los repositories aceptan cualquiera de los dos,
 * así una misma transacción puede compartir el mismo client.
 */
export type Executor = Pick<pg.Pool | pg.PoolClient, 'query'>;

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

/**
 * Ejecuta `fn` dentro de una TRANSACCIÓN sobre un único client:
 * BEGIN → fn → COMMIT; ante cualquier error, ROLLBACK y se relanza.
 * El client se libera siempre.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
