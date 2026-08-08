/* =============================================================
 * Cliente de partida ONLINE (WebSocket). El SERVIDOR es la autoridad: este
 * hook sólo renderiza el `snapshot` que llega y envía la intención de acción.
 * Nunca calcula resultados. Reconecta si se cae la conexión.
 * ============================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cardId, type Action, type MatchState, type Seat, type TeamId } from '@/game';
import { wsUrl } from '@/api/match';
import type { ConnState } from './components/ConnectionIndicator';

/** Acción que entiende el servidor (protocolo WS). */
type ClientAction =
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'CALL_ENVIDO' | 'CALL_REAL_ENVIDO' | 'CALL_FALTA_ENVIDO' }
  | { type: 'CALL_FLOR' | 'CALL_CONTRAFLOR' | 'CALL_CONTRAFLOR_RESTO' }
  | { type: 'CALL_TRUCO' | 'CALL_RETRUCO' | 'CALL_VALE_CUATRO' }
  | { type: 'ACCEPT' | 'DECLINE' | 'FOLD' | 'TOCA' }
  | { type: 'VIEW_TEAMMATE_CARDS'; seat: Seat };

/** Traduce una Acción del motor (la que emite la mesa) a ClientAction. */
function toClientAction(a: Action): ClientAction | null {
  switch (a.type) {
    case 'PLAY_CARD':
      return { type: 'PLAY_CARD', cardId: cardId(a.card) };
    case 'CALL_ENVIDO':
      return { type: a.call === 'real_envido' ? 'CALL_REAL_ENVIDO' : a.call === 'falta_envido' ? 'CALL_FALTA_ENVIDO' : 'CALL_ENVIDO' };
    case 'CALL_TRUCO':
      return { type: a.call === 'retruco' ? 'CALL_RETRUCO' : a.call === 'vale4' ? 'CALL_VALE_CUATRO' : 'CALL_TRUCO' };
    case 'CALL_FLOR':
      return { type: a.call === 'contraflor_resto' ? 'CALL_CONTRAFLOR_RESTO' : a.call === 'contraflor_envido' ? 'CALL_CONTRAFLOR' : 'CALL_FLOR' };
    case 'ACCEPT':
      return { type: 'ACCEPT' };
    case 'DECLINE':
      return { type: 'DECLINE' };
    case 'FOLD':
      return { type: 'FOLD' };
    default:
      return null; // DECLARE_PERROS u otras no viajan por ahora
  }
}

export interface Snapshot {
  matchId: string;
  viewerSeat: Seat | null;
  runtimePhase: string;
  picoPhase: string | null;
  score: { A: number; B: number };
  phase: 'playing' | 'finished';
  winner: TeamId | null;
  actorSeat: Seat | null;
  turnDeadline: number | null;
  game: MatchState;
}

export interface OnlineMatch {
  snapshot: Snapshot | null;
  netStatus: ConnState;
  dispatch: (action: Action) => void;
}

const RECONNECT_MS = 1500;

export function useOnlineMatch(): OnlineMatch {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [netStatus, setNetStatus] = useState<ConnState>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const closedByUs = useRef(false);

  useEffect(() => {
    closedByUs.current = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      setNetStatus((s) => (s === 'connected' ? 'reconnecting' : 'connecting'));
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => setNetStatus('connected');
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === 'SNAPSHOT') setSnapshot(msg.snapshot as Snapshot);
        } catch {
          /* ignora mensajes no-JSON */
        }
      };
      ws.onclose = () => {
        if (closedByUs.current) return;
        setNetStatus('reconnecting');
        retry = setTimeout(connect, RECONNECT_MS); // el servidor reenvía el snapshot al reconectar
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      closedByUs.current = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  const dispatch = useCallback((action: Action) => {
    const ca = toClientAction(action);
    const ws = wsRef.current;
    if (ca && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(ca));
    }
  }, []);

  return { snapshot, netStatus, dispatch };
}
