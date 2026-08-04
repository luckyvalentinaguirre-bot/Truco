/* =============================================================
 * Backend · Servidor HTTP base (Node http nativo)
 * -------------------------------------------------------------
 * Servidor mínimo, sin dependencias extra. Sólo expone /healthz
 * por ahora; el resto de la API llega en etapas posteriores.
 * ============================================================= */
import { createServer, type Server } from 'node:http';

/** Crea el servidor HTTP con las rutas base. */
export function createHttpServer(): Server {
  return createServer((req, res) => {
    const url = (req.url ?? '').split('?')[0];

    if (req.method === 'GET' && (url === '/healthz' || url === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'not_found' }));
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
