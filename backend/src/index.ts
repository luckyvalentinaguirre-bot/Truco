/* =============================================================
 * Backend · Punto de entrada
 * -------------------------------------------------------------
 * Arranca de forma independiente del frontend: verifica la
 * conexión a PostgreSQL y levanta un servidor HTTP persistente
 * (Render lo necesita vivo). El proceso NO termina tras el chequeo.
 * ============================================================= */
import { loadEnv, safeDbSummary } from './config/env.js';
import { query, closePool } from './db/pool.js';
import { startHttpServer } from './server/http.js';
import { attachGameWebSocket } from './game/ws-server.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  console.log(`[backend] entorno: ${env.nodeEnv}`);
  console.log(`[backend] PostgreSQL: ${safeDbSummary(env.databaseUrl)}`);

  // Servidor HTTP persistente PRIMERO: mantiene el proceso vivo esperando
  // peticiones (Render lo requiere) y no depende de que la base esté lista.
  const server = await startHttpServer(env.port);
  console.log(`[backend] ✅ HTTP escuchando en 0.0.0.0:${env.port} (GET /healthz)`);

  // Servidor WebSocket autoritativo de partidas (autenticado por la sesión).
  attachGameWebSocket(server);
  console.log('[backend] ✅ WebSocket de partidas montado en /ws');

  // Verificación de salud de la base (no fatal: un problema puntual con la
  // base no debe tumbar el servidor HTTP). No expone credenciales.
  try {
    await query('SELECT 1');
    console.log('[backend] ✅ base de datos accesible');
  } catch (err) {
    console.error(
      '[backend] ⚠️ base de datos no accesible por ahora:',
      err instanceof Error ? err.message : err,
    );
  }

  // Cierre ordenado ante señales de la plataforma (Render envía SIGTERM).
  const shutdown = (signal: string) => {
    console.log(`[backend] ${signal} recibido, cerrando…`);
    server.close(() => {
      closePool()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(async (err) => {
  console.error('[backend] ❌ error al iniciar:', err instanceof Error ? err.message : err);
  await closePool().catch(() => {});
  process.exit(1);
});
