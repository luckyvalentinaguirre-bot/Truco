/* =============================================================
 * TRUCO · Servidor LAN (WebSocket)
 * -------------------------------------------------------------
 * Corré:  npm run server        (escucha en 0.0.0.0:8787)
 * Otros equipos de la red se conectan a  ws://<tu-ip-local>:8787
 *
 * El servidor es la AUTORIDAD: valida cada Action con el Rules
 * Engine (el mismo del cliente) y difunde el estado a todos.
 * ============================================================= */
import { WebSocketServer, WebSocket } from 'ws';
import type { GameEvent, GameMode } from '../src/game';
import * as R from './rooms';
import { DEFAULT_LAN_PORT, type ClientMsg, type ServerMsg } from '../src/net/protocol';

const PORT = Number(process.env.PORT ?? DEFAULT_LAN_PORT);
const NEXT_HAND_MS = 3500;

const rooms = new Map<string, R.Room<WebSocket>>();

function newCode(): string {
  let c: string;
  do {
    c = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (rooms.has(c));
  return c;
}

function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function lobbyInfo(room: R.Room<WebSocket>) {
  return {
    code: room.code,
    mode: room.mode,
    filled: R.filledSeats(room),
    needed: R.neededSeats(room.mode),
    names: room.names.filter(Boolean),
  };
}

function broadcastLobby(room: R.Room<WebSocket>): void {
  const info = lobbyInfo(room);
  room.conns.forEach((ws) => ws && send(ws, { t: 'lobby', info }));
}

function broadcastState(room: R.Room<WebSocket>, events: GameEvent[]): void {
  if (!room.state) return;
  const state = room.state;
  room.conns.forEach((ws, seat) => {
    if (ws) send(ws, { t: 'state', state, events, yourSeat: seat });
  });
}

/** Tras terminar una mano, espera y reparte la próxima (o cierra si terminó). */
function scheduleNextHand(room: R.Room<WebSocket>): void {
  setTimeout(() => {
    if (R.dealNextHand(room)) broadcastState(room, []);
  }, NEXT_HAND_MS);
}

const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT });

wss.on('connection', (ws: WebSocket) => {
  let room: R.Room<WebSocket> | null = null;
  let seat = -1;

  const seatInto = (r: R.Room<WebSocket>, name: string) => {
    seat = R.addPlayer(r, ws, name);
    if (seat === -1) {
      send(ws, { t: 'error', msg: 'La sala está llena' });
      return false;
    }
    room = r;
    send(ws, { t: 'joined', code: r.code, seat, mode: r.mode });
    broadcastLobby(r);
    if (R.startIfReady(r)) broadcastState(r, []);
    return true;
  };

  ws.on('message', (data) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return send(ws, { t: 'error', msg: 'Mensaje inválido' });
    }

    if (msg.t === 'create') {
      const mode = msg.mode as GameMode;
      const r = R.createRoom<WebSocket>(newCode(), mode, Math.floor(Math.random() * 2 ** 31));
      rooms.set(r.code, r);
      seatInto(r, msg.name);
      return;
    }

    if (msg.t === 'join') {
      const r = rooms.get(msg.code.toUpperCase());
      if (!r) return send(ws, { t: 'error', msg: 'No existe esa sala' });
      if (r.state) return send(ws, { t: 'error', msg: 'La partida ya empezó' });
      seatInto(r, msg.name);
      return;
    }

    if (msg.t === 'action') {
      if (!room || seat < 0) return;
      try {
        const events = R.applyForSeat(room, seat, msg.action);
        broadcastState(room, events);
        if (room.state?.hand.finished && room.state.phase === 'playing') {
          scheduleNextHand(room);
        }
      } catch (e) {
        send(ws, { t: 'error', msg: (e as Error).message });
      }
      return;
    }

    if (msg.t === 'restart') {
      // (MVP) sólo si la partida terminó: se reparte una nueva.
      if (room && room.state && room.state.phase === 'finished') {
        room.state = null;
        room.seed = Math.floor(Math.random() * 2 ** 31);
        if (R.startIfReady(room)) broadcastState(room, []);
      }
    }
  });

  ws.on('close', () => {
    if (!room) return;
    R.removePlayer(room, ws);
    // Aviso al resto: un jugador se fue (MVP: se corta la partida).
    room.conns.forEach((c) => c && send(c, { t: 'error', msg: 'Un jugador se desconectó' }));
    if (R.filledSeats(room) === 0) rooms.delete(room.code);
  });
});

// eslint-disable-next-line no-console
console.log(`TRUCO · servidor LAN escuchando en ws://0.0.0.0:${PORT}`);
