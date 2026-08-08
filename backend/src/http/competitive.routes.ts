/* =============================================================
 * Backend · Rutas HTTP del sistema competitivo (lectura)
 * -------------------------------------------------------------
 * Server-authoritative: ranking, rating, rango y acceso salen del backend.
 * ============================================================= */
import { sendJson } from './respond.js';
import { requireAuth } from './requireAuth.js';
import type { Router } from './router.js';
import { getCompetitiveStatus, getRanking } from '../services/competitive.service.js';
import { getActiveSeason } from '../repositories/seasons.repository.js';

export function registerCompetitiveRoutes(router: Router): void {
  // GET /competitive/me → estado competitivo del usuario autenticado.
  router.add(
    'GET',
    '/competitive/me',
    requireAuth(async (_req, res, auth) => {
      const status = await getCompetitiveStatus(auth.user.id);
      sendJson(res, 200, status);
    }),
  );

  // GET /competitive/ranking → ranking de la temporada activa (público).
  router.add('GET', '/competitive/ranking', async (_req, res) => {
    const { season, rows } = await getRanking(50);
    sendJson(res, 200, {
      season: season ? { id: season.id, name: season.name } : null,
      ranking: rows,
    });
  });

  // GET /competitive/season → temporada activa (o null).
  router.add('GET', '/competitive/season', async (_req, res) => {
    const season = await getActiveSeason();
    sendJson(res, 200, {
      season: season
        ? {
            id: season.id,
            name: season.name,
            startsAt: season.startsAt.toISOString(),
            endsAt: season.endsAt.toISOString(),
          }
        : null,
    });
  });
}
