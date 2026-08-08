/* =============================================================
 * Backend · Rutas HTTP de amigos (autenticadas)
 * ============================================================= */
import { badRequest } from './httpError.js';
import { readJsonBody } from './request.js';
import { sendJson } from './respond.js';
import { requireAuth } from './requireAuth.js';
import type { Router } from './router.js';
import {
  requestFriendByUsername,
  acceptFriend,
  removeFriend,
  getFriends,
  getIncomingRequests,
} from '../services/friends.service.js';

function requireString(body: unknown, key: string): string {
  const v = (body as Record<string, unknown>)?.[key];
  if (typeof v !== 'string' || v.length === 0) throw badRequest(`Campo "${key}" obligatorio`);
  return v;
}

export function registerFriendsRoutes(router: Router): void {
  // GET /friends → lista de amigos aceptados.
  router.add(
    'GET',
    '/friends',
    requireAuth(async (_req, res, auth) => {
      sendJson(res, 200, { friends: await getFriends(auth.user.id) });
    }),
  );

  // GET /friends/requests → solicitudes recibidas pendientes.
  router.add(
    'GET',
    '/friends/requests',
    requireAuth(async (_req, res, auth) => {
      sendJson(res, 200, { requests: await getIncomingRequests(auth.user.id) });
    }),
  );

  // POST /friends/request { username } → enviar (o auto-aceptar) solicitud.
  router.add(
    'POST',
    '/friends/request',
    requireAuth(async (req, res, auth) => {
      const username = requireString(await readJsonBody(req), 'username');
      const out = await requestFriendByUsername(auth.user.id, username);
      sendJson(res, 200, out);
    }),
  );

  // POST /friends/accept { userId } → aceptar una solicitud recibida.
  router.add(
    'POST',
    '/friends/accept',
    requireAuth(async (req, res, auth) => {
      const otherId = requireString(await readJsonBody(req), 'userId');
      const ok = await acceptFriend(auth.user.id, otherId);
      sendJson(res, 200, { accepted: ok });
    }),
  );

  // POST /friends/remove { userId } → eliminar amistad o rechazar solicitud.
  router.add(
    'POST',
    '/friends/remove',
    requireAuth(async (req, res, auth) => {
      const otherId = requireString(await readJsonBody(req), 'userId');
      await removeFriend(auth.user.id, otherId);
      sendJson(res, 200, { removed: true });
    }),
  );
}
