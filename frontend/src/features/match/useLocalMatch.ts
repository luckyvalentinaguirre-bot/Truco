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
  calcFlor,
  chooseAiAction,
  createMatch,
  startNextHand,
  type Action,
  type GameEvent,
  type GameMode,
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

export function useLocalMatch(
  difficulty: Difficulty = 'normal',
  mode: GameMode = '1v1',
) {
  const [state, setState] = useState<MatchState>(() =>
    createMatch({ mode, seed: randomSeed() }),
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [handFeedback, setHandFeedback] = useState<string | null>(null);
  const handEvents = useRef<GameEvent[]>([]);

  const humanSeat = HUMAN_SEAT;
  // Primer asiento rival (compatibilidad con lecturas 1v1). En 2v2/3v3 todos
  // los asientos != humano los maneja la IA (ver drivers de abajo).
  const aiSeat = state.players.find((p) => p.seat !== humanSeat)!.seat;
  const humanTeam = state.players[humanSeat].team;

  const applyAndTrack = useCallback(
    (action: Action) => {
      setState((prev) => {
        // Blindaje: una acción fuera de turno (p. ej. la IA reclamando su
        // Flor) puede quedar obsoleta si el estado cambió antes de aplicarse.
        // En ese caso se ignora en vez de romper el render.
        let applied;
        try {
          applied = applyAction(prev, action);
        } catch {
          return prev;
        }
        const { state: next, events } = applied;
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
    setState(createMatch({ mode, seed: randomSeed() }));
  }, [mode]);

  // -------- Driver de la IA (maneja TODOS los asientos no-humanos) --------
  useEffect(() => {
    if (state.phase !== 'playing' || state.hand.finished) return;
    const actor = actorNow(state);
    if (actor === null || actor === humanSeat) return;
    const t = setTimeout(() => {
      const action = chooseAiAction(state, actor, Math.random, { difficulty });
      if (action) applyAndTrack(action);
    }, AI_STEP_MS);
    return () => clearTimeout(t);
  }, [state, humanSeat, applyAndTrack, difficulty]);

  // -------- La IA canta su Flor aunque no sea su turno --------
  // La Flor es obligatoria y se anuncia al repartir; si el humano es mano,
  // la IA no sería el "actor", así que la reclama proactivamente para que
  // sus puntos no se pierdan.
  useEffect(() => {
    if (state.phase !== 'playing' || state.hand.finished) return;
    if (!state.ruleset.withFlor || state.hand.flor.resolved) return;
    if (!state.hand.envidoWindowOpen) return;
    // Cualquier asiento de IA con flor sin declarar la reclama.
    const ai = state.players.find(
      (p) =>
        p.seat !== humanSeat &&
        !p.folded &&
        p.played.length === 0 &&
        !state.hand.flor.declaredBy.includes(p.team) &&
        calcFlor(p.hand, state.hand.muestra).hasFlor,
    );
    if (!ai) return;
    const t = setTimeout(() => applyAndTrack({ type: 'CALL_FLOR', seat: ai.seat }), AI_STEP_MS);
    return () => clearTimeout(t);
  }, [state, humanSeat, applyAndTrack]);

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
