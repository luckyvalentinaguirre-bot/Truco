/* =============================================================
 * Controlador de partida ONLINE (LAN). Habla con el servidor por
 * WebSocket; el servidor es la autoridad (aplica las Actions con el
 * Rules Engine). El cliente sólo envía acciones y renderiza estado.
 * Reusa la misma vista (MatchBoard) que el modo local.
 * ============================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calcEnvido,
  calcFlor,
  type Action,
  type GameEvent,
  type GameMode,
  type MatchState,
  type Seat,
} from '@/game';
import type { ClientMsg, ServerMsg, LobbyInfo } from '@/net/protocol';
import { bubblesFromEvents, envidoNarration } from './matchView';
import type { ActiveBubble, RevealHand } from './useLocalMatch';

export type NetStatus = 'connecting' | 'lobby' | 'playing' | 'finished' | 'error';

export interface NetworkMatchOptions {
  url: string;
  name: string;
  /** Crear una sala nueva… */
  mode?: GameMode;
  /** …o unirse a una existente por código. */
  code?: string;
}

const BUBBLE_MS = 5000;
let seq = 0;

/** Revela la mano del GANADOR del envido/flor (si es un rival), como en local. */
function computeReveal(
  state: MatchState,
  events: GameEvent[],
  humanSeat: Seat,
): RevealHand[] {
  const muestra = state.hand.muestra;
  const full = (p: MatchState['players'][number]) => [...p.played, ...p.hand];
  const flor = [...events]
    .reverse()
    .find((e): e is Extract<GameEvent, { type: 'FLOR_RESOLVED' }> => e.type === 'FLOR_RESOLVED');
  const env = [...events]
    .reverse()
    .find((e): e is Extract<GameEvent, { type: 'ENVIDO_RESOLVED' }> => e.type === 'ENVIDO_RESOLVED');
  let winner: MatchState['players'][number] | null = null;
  if (flor) {
    const cand = state.players.filter((p) => p.team === flor.winner);
    winner = cand.reduce((b, p) =>
      calcFlor(full(p), muestra).value > calcFlor(full(b), muestra).value ? p : b,
    );
  } else if (env) {
    const cand = state.players.filter((p) => p.team === env.winner);
    winner = cand.reduce((b, p) =>
      calcEnvido(full(p), muestra).value > calcEnvido(full(b), muestra).value ? p : b,
    );
  }
  if (winner && winner.seat !== humanSeat) {
    return [{ seat: winner.seat, cards: full(winner) }];
  }
  return [];
}

export function useNetworkMatch(opts: NetworkMatchOptions) {
  const [status, setStatus] = useState<NetStatus>('connecting');
  const [state, setState] = useState<MatchState | null>(null);
  const [mySeat, setMySeat] = useState<Seat>(0);
  const [lobby, setLobby] = useState<LobbyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);
  const [reveal, setReveal] = useState<RevealHand[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const ws = new WebSocket(opts.url);
    wsRef.current = ws;

    ws.onopen = () => {
      const o = optsRef.current;
      const msg: ClientMsg = o.code
        ? { t: 'join', code: o.code, name: o.name }
        : { t: 'create', mode: o.mode ?? '1v1', name: o.name };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.t === 'error') {
        setError(msg.msg);
        setStatus((s) => (s === 'playing' || s === 'finished' ? s : 'error'));
        return;
      }
      if (msg.t === 'joined') {
        setMySeat(msg.seat);
        setStatus('lobby');
        return;
      }
      if (msg.t === 'lobby') {
        setLobby(msg.info);
        return;
      }
      if (msg.t === 'state') {
        setMySeat(msg.yourSeat);
        setState(msg.state);
        setStatus(msg.state.phase === 'finished' ? 'finished' : 'playing');

        const nb = bubblesFromEvents(msg.events);
        if (nb.length) {
          const now = Date.now();
          setBubbles((p) => [...p, ...nb.map((b) => ({ ...b, id: ++seq, born: now }))]);
        }
        if (msg.events.some((e) => e.type === 'ENVIDO_RESOLVED')) {
          envidoNarration(msg.state, msg.state.hand.manoSeat).forEach((b, i) =>
            setTimeout(
              () => setBubbles((p) => [...p, { ...b, id: ++seq, born: Date.now() }]),
              i * 850,
            ),
          );
        }
        setReveal(
          msg.state.hand.finished
            ? computeReveal(msg.state, msg.events, msg.yourSeat)
            : [],
        );
      }
    };

    ws.onerror = () => {
      setError('No se pudo conectar al servidor LAN');
      setStatus((s) => (s === 'connecting' ? 'error' : s));
    };

    return () => ws.close();
    // Sólo re-conecta si cambia la URL (name/mode/code se leen del ref al abrir).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.url]);

  useEffect(() => {
    if (bubbles.length === 0) return;
    const soonest = Math.min(...bubbles.map((b) => b.born));
    const t = setTimeout(() => {
      const cutoff = Date.now() - BUBBLE_MS;
      setBubbles((p) => p.filter((b) => b.born > cutoff));
    }, Math.max(0, soonest + BUBBLE_MS - Date.now()));
    return () => clearTimeout(t);
  }, [bubbles]);

  const dispatch = useCallback((action: Action) => {
    wsRef.current?.send(JSON.stringify({ t: 'action', action } as ClientMsg));
  }, []);
  const restart = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ t: 'restart' } as ClientMsg));
  }, []);

  return { status, state, mySeat, lobby, error, bubbles, reveal, dispatch, restart };
}
