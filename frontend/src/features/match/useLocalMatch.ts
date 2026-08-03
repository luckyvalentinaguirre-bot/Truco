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
import {
  bannerFromEvents,
  announcementFromEvents,
  bubblesFromEvents,
  envidoNarration,
  type MatchAnnouncement,
  type CantoBubble,
} from './matchView';

const HUMAN_SEAT: Seat = 0;
const AI_STEP_MS = 750;
const HAND_FEEDBACK_MS = 1700;
const BUBBLE_MS = 5000;
const NARRATION_STEP_MS = 850;

/** Burbuja de canto activa cerca de un asiento (id único para expirar). */
export interface ActiveBubble {
  id: number;
  seat: Seat;
  text: string;
  /** Momento (ms) en que se creó, para expirarla ~5s después. */
  born: number;
}
let bubbleSeq = 0;

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
  const [announcement, setAnnouncement] = useState<MatchAnnouncement | null>(null);
  const [handFeedback, setHandFeedback] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);
  // Narración diferida del Envido: burbujas de tantos/"son buenas" en orden de
  // mano y, al final, el resumen de puntos.
  const [pendingEnvido, setPendingEnvido] = useState<{
    narration: CantoBubble[];
    result: MatchAnnouncement | null;
  } | null>(null);
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
        // Los cantos ("Truco", "Envido", "Quiero", …) van como burbujas
        // pequeñas junto al asiento que los dijo.
        const newBubbles = bubblesFromEvents(events);
        if (newBubbles.length > 0) {
          const now = Date.now();
          setBubbles((prev) => [
            ...prev,
            ...newBubbles.map((b2) => ({ ...b2, id: ++bubbleSeq, born: now })),
          ]);
        }
        // Resultado del Envido: se narra en orden de mano (tantos / "son
        // buenas") y recién al final se muestra el resumen de puntos.
        const envidoResolved = events.some((e) => e.type === 'ENVIDO_RESOLVED');
        const ann = announcementFromEvents(events, next, HUMAN_SEAT);
        if (envidoResolved) {
          setPendingEnvido({
            narration: envidoNarration(next, next.hand.manoSeat),
            result: ann && ann.kind === 'result' ? ann : null,
          });
        } else if (ann && ann.kind === 'result') {
          // Otros resultados (Flor) se muestran directo en el centro.
          setAnnouncement(ann);
        }
        return next;
      });
    },
    [],
  );

  const dispatch = useCallback((action: Action) => applyAndTrack(action), [applyAndTrack]);

  const restart = useCallback(() => {
    setBanner(null);
    setHandFeedback(null);
    setBubbles([]);
    setPendingEnvido(null);
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
    // Si ya hay un duelo de flores abierto, lo maneja el driver normal (la IA
    // responde por turno); no volver a declarar.
    if (state.hand.flor.pendingCall) return;
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

  // -------- Auto-ocultar el anuncio (resultado) --------
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(null), 2600);
    return () => clearTimeout(t);
  }, [announcement]);

  // -------- Narración del Envido: burbujas escalonadas + resumen final --------
  useEffect(() => {
    if (!pendingEnvido) return;
    const { narration, result } = pendingEnvido;
    const timers: ReturnType<typeof setTimeout>[] = [];
    narration.forEach((b, i) => {
      timers.push(
        setTimeout(() => {
          setBubbles((prev) => [
            ...prev,
            { ...b, id: ++bubbleSeq, born: Date.now() },
          ]);
        }, i * NARRATION_STEP_MS),
      );
    });
    if (result) {
      timers.push(
        setTimeout(
          () => setAnnouncement(result),
          narration.length * NARRATION_STEP_MS + 150,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [pendingEnvido]);

  // -------- Expirar las burbujas de canto (~5s cada una) --------
  useEffect(() => {
    if (bubbles.length === 0) return;
    const soonest = Math.min(...bubbles.map((b) => b.born));
    const wait = Math.max(0, soonest + BUBBLE_MS - Date.now());
    const t = setTimeout(() => {
      const cutoff = Date.now() - BUBBLE_MS;
      setBubbles((prev) => prev.filter((b) => b.born > cutoff));
    }, wait);
    return () => clearTimeout(t);
  }, [bubbles]);

  return {
    state,
    humanSeat,
    aiSeat,
    banner,
    announcement,
    bubbles,
    handFeedback,
    dispatch,
    restart,
  };
}
