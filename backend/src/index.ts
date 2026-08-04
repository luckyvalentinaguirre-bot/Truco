/* =============================================================
 * Backend · Punto de entrada
 * -------------------------------------------------------------
 * Etapa inicial: arranca de forma independiente del frontend,
 * carga la configuración y verifica la conexión a PostgreSQL.
 * El servidor HTTP / WebSockets se agregará en etapas posteriores.
 * ============================================================= */
import { loadEnv, safeDbSummary } from './config/env.js';
import { query, closePool } from './db/pool.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  console.log(`[backend] entorno: ${env.nodeEnv}`);
  console.log(`[backend] PostgreSQL: ${safeDbSummary(env.databaseUrl)}`);

  // Verificación de salud de la base (no expone credenciales).
  await query('SELECT 1');
  console.log('[backend] ✅ base de datos accesible');

  console.log(
    `[backend] listo. (Puerto ${env.port} reservado para el servidor HTTP de la próxima etapa.)`,
  );
}

bootstrap()
  .then(() => closePool())
  .catch(async (err) => {
    console.error('[backend] ❌ error al iniciar:', err instanceof Error ? err.message : err);
    await closePool().catch(() => {});
    process.exit(1);
  });
