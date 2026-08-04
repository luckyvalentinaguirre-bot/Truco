/* =============================================================
 * Backend · Prueba mínima de conexión a PostgreSQL
 * -------------------------------------------------------------
 * Ejecuta `SELECT NOW()` para verificar que DATABASE_URL conecta.
 * Uso:  npm run db:test
 * Nunca imprime la cadena de conexión ni credenciales.
 * ============================================================= */
import { loadEnv, safeDbSummary } from '../config/env.js';
import { query, closePool } from './pool.js';

async function main(): Promise<void> {
  const env = loadEnv();
  // Sólo host/base, jamás usuario/contraseña ni la cadena completa.
  console.log(`[db] probando conexión a ${safeDbSummary(env.databaseUrl)} …`);

  const started = Date.now();
  const res = await query<{ now: Date; version: string }>(
    'SELECT NOW() AS now, version() AS version',
  );
  const ms = Date.now() - started;

  const row = res.rows[0];
  console.log('[db] ✅ conexión OK');
  console.log(`[db]   hora del servidor : ${row?.now.toISOString?.() ?? row?.now}`);
  console.log(`[db]   PostgreSQL        : ${String(row?.version).split(' on ')[0]}`);
  console.log(`[db]   latencia          : ${ms} ms`);
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    // Mensaje de error sin filtrar secretos.
    console.error('[db] ❌ falló la conexión:', err instanceof Error ? err.message : err);
    await closePool().catch(() => {});
    process.exit(1);
  });
