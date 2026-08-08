/* =============================================================
 * Backend · Rutas HTTP de partidas online (autenticadas)
 * -------------------------------------------------------------
 * Infraestructura mínima (§28): crear una partida y obtener su id para luego
 * conectarse por WebSocket (/ws). El matchmaking avanzado con ELO es posterior.
 * El servidor asigna el asiento del usuario desde la sesión; nunca lo decide
 * el cliente. Para práctica, los asientos restantes se llenan con bots
 * (userId "bot:N") que el runtime auto-juega server-side.
 * ============================================================= */
import { badRequest } from './httpError.js';
import { readJsonBody } from './request.js';
import { sendJson } from './respond.js';
import { requireAuth } from './requireAuth.js';
import type { Router } from './router.js';
import { matchManager } from '../game/match-manager.js';
import type { GameMode } from '@truco/game-rules';

const SEATS_BY_MODE: Record<string, number> = { '1v1': 2, '2v2': 4, '3v3': 6 };

/** Lee y valida el modo pedido (default 1v1). */
function parseMode(body: unknown): GameMode {
  const obj = (body ?? {}) as Record<string, unknown>;
  const mode = obj.mode ?? '1v1';
  if (mode !== '1v1' && mode !== '2v2' && mode !== '3v3') {
    throw badRequest('mode inválido (1v1 | 2v2 | 3v3)');
  }
  return mode;
}

export function registerMatchRoutes(router: Router): void {
  // POST /match/practice → crea una partida vs bots y devuelve su id + asiento.
  router.add(
    'POST',
    '/match/practice',
    requireAuth(async (req, res, auth) => {
      const body = await readJsonBody(req).catch(() => ({}));
      const mode = parseMode(body);
      const picoAPico = mode === '3v3' && (body as Record<string, unknown>).picoAPico === true;

      // Si el usuario ya está en una partida activa, no se crea otra.
      const existing = matchManager.matchOfUser(auth.user.id);
      if (existing) {
        sendJson(res, 200, {
          matchId: existing.matchId,
          seat: existing.seatOfUser(auth.user.id),
          mode: existing.mode,
          reused: true,
        });
        return;
      }

      const n = SEATS_BY_MODE[mode]!;
      // Asiento 0 = humano autenticado; el resto, bots.
      const seatUsers = [auth.user.id, ...Array.from({ length: n - 1 }, (_, i) => `bot:${i + 1}`)];
      const rt = matchManager.createMatch({ mode, picoAPico, seatUsers });
      rt.setConnection(auth.user.id, 'CONNECTED');
      // Si el primer turno es de un bot, que juegue hasta que le toque al humano.
      rt.autoRunBots();

      sendJson(res, 201, { matchId: rt.matchId, seat: 0, mode });
    }),
  );

  // GET /match/current → la partida activa del usuario (o null).
  router.add(
    'GET',
    '/match/current',
    requireAuth((_req, res, auth) => {
      const rt = matchManager.matchOfUser(auth.user.id);
      if (!rt) {
        sendJson(res, 200, { match: null });
        return;
      }
      sendJson(res, 200, {
        match: { matchId: rt.matchId, seat: rt.seatOfUser(auth.user.id), mode: rt.mode },
      });
    }),
  );
}
