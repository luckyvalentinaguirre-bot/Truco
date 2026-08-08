/* =============================================================
 * Backend · Rutas HTTP de matchmaking clasificatorio (autenticadas)
 * -------------------------------------------------------------
 * El usuario entra a la cola de su modo; cuando se completa el cupo, el
 * servidor crea la partida ranked y le devuelve matchId + asiento. El rating
 * lo lee el servidor (temporada activa); el cliente no lo envía.
 * ============================================================= */
import { badRequest } from './httpError.js';
import { readJsonBody } from './request.js';
import { sendJson } from './respond.js';
import { requireAuth } from './requireAuth.js';
import type { Router } from './router.js';
import { matchmaking } from '../game/matchmaking.js';
import { getActiveSeason } from '../repositories/seasons.repository.js';
import { getRating } from '../repositories/ratings.repository.js';
import { DEFAULT_RATING } from '../competitive/elo.js';
import type { GameMode } from '@truco/game-rules';

function parseMode(body: unknown): GameMode {
  const mode = (body as Record<string, unknown>)?.mode ?? '1v1';
  if (mode !== '1v1' && mode !== '2v2' && mode !== '3v3') {
    throw badRequest('mode inválido (1v1 | 2v2 | 3v3)');
  }
  return mode;
}

/** Rating actual del usuario en la temporada activa (o el inicial). */
async function currentRating(userId: string): Promise<number> {
  const season = await getActiveSeason();
  if (!season) return DEFAULT_RATING;
  const r = await getRating(userId, season.id);
  return r?.rating ?? DEFAULT_RATING;
}

export function registerMatchmakingRoutes(router: Router): void {
  // POST /matchmaking/join { mode } → entra a la cola (o devuelve match si completa cupo).
  router.add(
    'POST',
    '/matchmaking/join',
    requireAuth(async (req, res, auth) => {
      const mode = parseMode(await readJsonBody(req).catch(() => ({})));
      const rating = await currentRating(auth.user.id);
      const result = matchmaking.join(auth.user.id, rating, mode);
      sendJson(res, 200, result);
    }),
  );

  // GET /matchmaking/status → estado del usuario (idle / queued / matched).
  router.add(
    'GET',
    '/matchmaking/status',
    requireAuth((_req, res, auth) => {
      sendJson(res, 200, matchmaking.status(auth.user.id));
    }),
  );

  // POST /matchmaking/leave → sale de la cola.
  router.add(
    'POST',
    '/matchmaking/leave',
    requireAuth((_req, res, auth) => {
      matchmaking.leave(auth.user.id);
      sendJson(res, 200, { status: 'idle' });
    }),
  );
}
