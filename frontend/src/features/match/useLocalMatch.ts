/* =============================================================
 * Game Controller / Adapter (local, 1 humano vs IA).
 * -------------------------------------------------------------
 *   Usuario pulsa carta → dispatch(PLAY_CARD) → applyAction (motor)
 *   → nuevo estado → React re-renderiza. La IA usa el MISMO motor.
 *
 * La UI no conoce reglas: sólo llama a `dispatch` y lee el estado.
 * Entre manos NO hay pantalla: feedback corto + reparto automático.
 * ============================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { Difficulty } from '@/services/settings';
import { playSound, type SoundName } from '@/services/sound';
import { bannerFromEvents } from './matchView';

const HUMAN_SEAT: Seat = 0;
const AI_STEP_MS = 750;
const HAND_FEEDBACK_MS = 1700;

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/** Efectos de sonido derivados de los eventos del motor. */
function soundFor(event: GameEvent, humanTeam: TeamId): SoundName | null {
  switch (event.type) {
    case 'CARD_PLAYED':
      return 'play';
    case 'TRICK_RESOLVED':
      return 'trick';
    case 'TRUCO_CALLED':
      return 'truco';
    case 'ENVIDO_CALLED':
      return 'envido';
    case 'FLOR_DECLARED':
      return 'flor';
    case 'GAME_OVER':
      return event.winner === humanTeam ? 'win' : 'lose';
    default:
      return null;
  }
}

export function useLocalMatch(difficulty: Difficulty = 'normal') {
  const [state, setState] = useState<MatchState>(() =>
    createMatch({ mode: '1v1', seed: randomSeed() }),
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [handFeedback, setHandFeedback] = useState<string | null>(null);
  const handEvents = useRef<GameEvent[]>([]);

  const humanSeat = HUMAN_SEAT;
  const aiSeat = state.players.find((p) => p.seat !== humanSeat)!.seat;
  const humanTeam = state.players[humanSeat].team;

  const applyAndTrack = useCallback(
    (action: Action) => {
      setState((prev) => {
        const { state: next, events } = applyAction(prev, action);
        handEvents.current = [...handEvents.current, ...events];
        for (const e of events) {
          const s = soundFor(e, prev.players[HUMAN_SEAT].team);
          if (s) playSound(s);
        }
        const b = bannerFromEvents(events, next, HUMAN_SEAT);
        if (b) setBanner(b);
        return next;
      });
    },
    [],
  );

  const dispatch = useCallback((action: Action) => applyAndTrack(action), [applyAndTrack]);

  const restart = useCallback(() => {
    setBanner(null);
    setHandFeedback(null);
    handEvents.current = [];
    playSound('deal');
    setState(createMatch({ mode: '1v1', seed: randomSeed() }));
  }, []);

  // -------- Driver de la IA (con pausa para que se vea) --------
  useEffect(() => {
    if (state.phase !== 'playing' || state.hand.finished) return;
    if (actorNow(state) !== aiSeat) return;
    const t = setTimeout(() => {
      const action = chooseAiAction(state, aiSeat, Math.random, { difficulty });
      if (action) applyAndTrack(action);
    }, AI_STEP_MS);
    return () => clearTimeout(t);
  }, [state, aiSeat, applyAndTrack, difficulty]);

  // -------- Fin de mano: feedback corto + reparto automático --------
  useEffect(() => {
    if (state.phase !== 'playing' || !state.hand.finished) return;

    const winner = state.hand.winner;
    const pointsToWinner = handEvents.current
      .filter((e): e is Extract<GameEvent, { type: 'POINTS_AWARDED' }> =>
        e.type === 'POINTS_AWARDED' && e.team === winner,
      )
      .reduce((sum, e) => sum + e.points, 0);
    setHandFeedback(
      winner === humanTeam
        ? `Ganaste la mano +${pointsToWinner}`
        : `Perdiste la mano +${pointsToWinner}`,
    );

    const t = setTimeout(() => {
      setHandFeedback(null);
      setBanner(null);
      handEvents.current = [];
      playSound('deal');
      setState((prev) => (prev.hand.finished ? startNextHand(prev) : prev));
    }, HAND_FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [state, humanTeam]);

  // -------- Auto-ocultar el banner de baza --------
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1400);
    return () => clearTimeout(t);
  }, [banner]);

  return {
    state,
    humanSeat,
    aiSeat,
    banner,
    handFeedback,
    dispatch,
    restart,
  };
}
