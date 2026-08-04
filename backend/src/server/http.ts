/* =============================================================
 * Backend · Servidor HTTP base (Node http nativo)
 * -------------------------------------------------------------
 * Servidor mínimo, sin dependencias extra. Expone /healthz y las
 * rutas de autenticación (/auth/*) vía un router pequeño.
 * ============================================================= */
import { createServer, type Server } from 'node:http';
import { Router } from '../http/router.js';
import { registerAuthRoutes } from '../http/auth.routes.js';
import { sendJson } from '../http/respond.js';

/** Construye el router con todas las rutas registradas. */
function buildRouter(): Router {
  const router = new Router();
  router.add('GET', '/healthz', (_req, res) => {
    sendJson(res, 200, { status: 'ok' });
  });
  registerAuthRoutes(router);
  return router;
}

/** Crea el servidor HTTP con las rutas base. */
export function createHttpServer(): Server {
  const router = buildRouter();
  return createServer((req, res) => {
    void router.handle(req, res).then((handled) => {
      if (!handled) {
        sendJson(res, 404, { error: { code: 'not_found', message: 'Ruta no encontrada' } });
      }
    });
  });
}

/** Levanta el servidor en 0.0.0.0:port y resuelve cuando está escuchando. */
export function startHttpServer(port: number): Promise<Server> {
  const server = createHttpServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}
