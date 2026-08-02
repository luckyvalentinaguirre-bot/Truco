/* =============================================================
 * Game Controller / Adapter (local, 1 humano vs IA).
 * -------------------------------------------------------------
 *   Usuario pulsa carta → dispatch(PLAY_CARD) → applyAction (motor)
 *   → nuevo estado → React re-renderiza. La IA usa el MISMO motor.
 *
 * La UI no conoce reglas: sólo llama a `dispatch` y lee el estado.
 * ============================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  actorNow,
  applyAction,
  chooseAiAction,
  createMatch,
  startNextHand,
  type Action,
  type GameEvent,
  type MatchState,
  type Seat,
  type TeamId,
} from '@/game';
import { bannerFromEvents } from './matchView';

export interface HandAward {
  team: TeamId;
  points: number;
  reason: string;
}

export interface HandSummary {
  winner: TeamId | null;
  awards: HandAward[];
}

const HUMAN_SEAT: Seat = 0;
const AI_STEP_MS = 750;

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

export function useLocalMatch() {
  const [state, setState] = useState<MatchState>(() =>
    createMatch({ mode: '1v1', seed: randomSeed() }),
  );
  const [banner, setBanner] = useState<string | null>(null);
  const handEvents = useRef<GameEvent[]>([]);

  const humanSeat = HUMAN_SEAT;
  const aiSeat = state.players.find((p) => p.seat !== humanSeat)!.seat;

  const applyAndTrack = useCallback(
    (action: Action) => {
      setState((prev) => {
        const { state: next, events } = applyAction(prev, action);
        handEvents.current = [...handEvents.current, ...events];
        const b = bannerFromEvents(events, next, HUMAN_SEAT);
        if (b) setBanner(b);
        return next;
      });
    },
    [],
  );

  /** Acción del humano (la UI sólo ofrece acciones legales). */
  const dispatch = useCallback(
    (action: Action) => {
      applyAndTrack(action);
    },
    [applyAndTrack],
  );

  /** Avanzar a la siguiente mano (tras el resumen). */
  const nextHand = useCallback(() => {
    setBanner(null);
    handEvents.current = [];
    setState((prev) => startNextHand(prev));
  }, []);

  /** Reiniciar la partida. */
  const restart = useCallback(() => {
    setBanner(null);
    handEvents.current = [];
    setState(createMatch({ mode: '1v1', seed: randomSeed() }));
  }, []);

  // -------- Driver de la IA (con pausa para que se vea) --------
  useEffect(() => {
    if (state.phase !== 'playing' || state.hand.finished) return;
    const actor = actorNow(state);
    if (actor !== aiSeat) return;

    const t = setTimeout(() => {
      const action = chooseAiAction(state, aiSeat);
      if (action) applyAndTrack(action);
    }, AI_STEP_MS);
    return () => clearTimeout(t);
  }, [state, aiSeat, applyAndTrack]);

  // -------- Auto-ocultar el banner --------
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(t);
  }, [banner]);

  // -------- Resumen de la mano terminada --------
  const handSummary = useMemo<HandSummary | null>(() => {
    if (!state.hand.finished) return null;
    const awards: HandAward[] = handEvents.current
      .filter((e): e is Extract<GameEvent, { type: 'POINTS_AWARDED' }> =>
        e.type === 'POINTS_AWARDED',
      )
      .map((e) => ({ team: e.team, points: e.points, reason: e.reason }));
    return { winner: state.hand.winner, awards };
  }, [state]);

  return {
    state,
    humanSeat,
    aiSeat,
    banner,
    handSummary,
    dispatch,
    nextHand,
    restart,
  };
}
