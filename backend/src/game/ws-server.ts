/* =============================================================
 * Servidor online · Transporte WebSocket (autenticado por la sesión real)
 * -------------------------------------------------------------
 * Adapta el MatchRuntime (autoridad) a conexiones WebSocket. La conexión se
 * autentica con la MISMA cookie de sesión HttpOnly del backend (no hay un
 * segundo login). El servidor resuelve userId→seat; nunca confía en el
 * cliente. Cada mensaje al cliente lleva el snapshot REDACTADO por asiento.
 * ============================================================= */
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { parseCookies } from '../http/cookies.js';
import { validateSession } from '../services/session.service.js';
import { matchManager } from './match-manager.js';
import type { MatchRuntime } from './match-runtime.js';
import type { ClientAction, ServerMessage } from './protocol.js';

const SESSION_COOKIE = 'session';
const TEAMMATE_PEEK_TTL_MS = 5000;

interface WsClient extends WebSocket {
  userId?: string;
  matchId?: string;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

/** Difunde a cada conexión de la partida su snapshot redactado por asiento. */
function broadcast(rt: MatchRuntime, clients: Set<WsClient>): void {
  for (const c of clients) {
    if (c.matchId !== rt.matchId || !c.userId) continue;
    send(c, { type: 'SNAPSHOT', snapshot: rt.snapshotForUser(c.userId) });
  }
}

/**
 * Monta el servidor WebSocket sobre el mismo servidor HTTP (ruta /ws).
 * Autentica por cookie de sesión durante el upgrade.
 */
export function attachGameWebSocket(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WsClient>();

  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = req.url ?? '';
    if (!url.startsWith('/ws')) return; // otras rutas no son WS de juego

    void authenticate(req).then((userId) => {
      if (!userId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        const client = ws as WsClient;
        client.userId = userId;
        clients.add(client);
        wss.emit('connection', client, req);
      });
    });
  });

  wss.on('connection', (ws: WsClient) => {
    // Al conectar, si el usuario ya está en una partida, reconecta y envía snapshot.
    const rt = ws.userId ? matchManager.matchOfUser(ws.userId) : null;
    if (rt && ws.userId) {
      ws.matchId = rt.matchId;
      const snap = rt.reconnect(ws.userId);
      if (snap) send(ws, { type: 'SNAPSHOT', snapshot: snap });
    }

    ws.on('message', (data) => {
      let action: ClientAction;
      try {
        action = JSON.parse(String(data)) as ClientAction;
      } catch {
        send(ws, { type: 'ERROR', message: 'JSON inválido' });
        return;
      }
      handleMessage(ws, action, clients);
    });

    ws.on('close', () => {
      if (ws.userId && ws.matchId) {
        const m = matchManager.getMatch(ws.matchId);
        m?.setConnection(ws.userId, 'DISCONNECTED');
      }
      clients.delete(ws);
    });
  });

  return wss;
}

function handleMessage(ws: WsClient, action: ClientAction, clients: Set<WsClient>): void {
  if ((action as { type?: string }).type === 'PING') {
    send(ws, { type: 'PONG' });
    return;
  }
  const rt = ws.matchId ? matchManager.getMatch(ws.matchId) : null;
  if (!rt || !ws.userId) {
    send(ws, { type: 'ERROR', message: 'no_match' });
    return;
  }

  // Peek de cartas de compañero: respuesta privada, con TTL (el cliente oculta a los 5s).
  if (action.type === 'VIEW_TEAMMATE_CARDS') {
    const cards = rt.teammatePeek(ws.userId, action.seat);
    if (!cards) {
      send(ws, { type: 'ACTION_REJECTED', reason: 'peek_not_allowed' });
      return;
    }
    send(ws, { type: 'TEAMMATE_CARDS', seat: action.seat, cards, ttlMs: TEAMMATE_PEEK_TTL_MS });
    return;
  }

  const result = rt.applyClientAction(ws.userId, action);
  if (!result.ok) {
    send(ws, { type: 'ACTION_REJECTED', reason: result.reason ?? 'rejected' });
    return;
  }
  // Acción aceptada → nuevo estado redactado a cada jugador.
  broadcast(rt, clients);
}

/** Resuelve el userId desde la cookie de sesión (o null si no autenticado). */
async function authenticate(req: IncomingMessage): Promise<string | null> {
  try {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    const identity = await validateSession(token);
    return identity.userId;
  } catch {
    return null;
  }
}
