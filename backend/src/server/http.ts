/* =============================================================
 * Backend · Servidor HTTP base (Node http nativo)
 * -------------------------------------------------------------
 * Servidor mínimo, sin dependencias extra. Expone /healthz y las
 * rutas de autenticación (/auth/*) vía un router pequeño.
 * ============================================================= */
import { createServer, type Server } from 'node:http';
import { Router } from '../http/router.js';
import { registerAuthRoutes } from '../http/auth.routes.js';
import { registerProfileRoutes } from '../http/profile.routes.js';
import { registerMatchRoutes } from '../http/match.routes.js';
import { registerCompetitiveRoutes } from '../http/competitive.routes.js';
import { registerMatchmakingRoutes } from '../http/matchmaking.routes.js';
import { registerFriendsRoutes } from '../http/friends.routes.js';
import { registerSubscriptionRoutes } from '../http/subscription.routes.js';
import { registerWebhookRoutes } from '../http/webhooks.routes.js';
import { applyCors } from '../http/cors.js';
import { sendJson } from '../http/respond.js';

/** Construye el router con todas las rutas registradas. */
function buildRouter(): Router {
  const router = new Router();
  router.add('GET', '/healthz', (_req, res) => {
    sendJson(res, 200, { status: 'ok' });
  });
  registerAuthRoutes(router);
  registerProfileRoutes(router);
  registerMatchRoutes(router);
  registerCompetitiveRoutes(router);
  registerMatchmakingRoutes(router);
  registerFriendsRoutes(router);
  registerSubscriptionRoutes(router);
  registerWebhookRoutes(router);
  return router;
}

/** Crea el servidor HTTP con las rutas base. */
export function createHttpServer(): Server {
  const router = buildRouter();
  return createServer((req, res) => {
    // CORS primero: si es preflight OPTIONS, se responde acá.
    if (applyCors(req, res)) return;
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
