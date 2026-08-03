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
import { bubblesFromEvents, envidoNarration, type CantoBubble } from './matchView';

const HUMAN_SEAT: Seat = 0;
const AI_STEP_MS = 750;
const HAND_FEEDBACK_MS = 1700;
const BUBBLE_MS = 5000;
const NARRATION_STEP_MS = 850;
const HAND_REVEAL_MS = 3200;

/** Cartas de un rival mostradas boca arriba al terminar la mano (envido/flor). */
export interface RevealHand {
  seat: Seat;
  cards: import('@/game').Card[];
}

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
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);
  // Narración diferida del Envido: burbujas de tantos/"son buenas" en orden de mano.
  const [pendingEnvido, setPendingEnvido] = useState<CantoBubble[] | null>(null);
  // Cartas de los rivales reveladas al terminar una mano con envido/flor.
  const [reveal, setReveal] = useState<RevealHand[]>([]);
  const handEvents = useRef<GameEvent[]>([]);

  const humanSeat = HUMAN_SEAT;
  // Primer asiento rival (compatibilidad con lecturas 1v1). En 2v2/3v3 todos
  // los asientos != humano los maneja la IA (ver drivers de abajo).
  const aiSeat = state.players.find((p) => p.seat !== humanSeat)!.seat;

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
        // Resultado del Envido: se narra con burbujas en orden de mano
        // (tantos / "son buenas"). Sin cartel central: sólo globos + marcador.
        if (events.some((e) => e.type === 'ENVIDO_RESOLVED')) {
          setPendingEnvido(envidoNarration(next, next.hand.manoSeat));
        }
        return next;
      });
    },
    [],
  );

  const dispatch = useCallback((action: Action) => applyAndTrack(action), [applyAndTrack]);

  const restart = useCallback(() => {
    setBubbles([]);
    setPendingEnvido(null);
    setReveal([]);
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

  // -------- Fin de mano: si hubo envido/flor se revelan las cartas rivales
  //          automáticamente un instante antes de repartir la próxima. --------
  useEffect(() => {
    if (state.phase !== 'playing' || !state.hand.finished) return;

    const hadTantos = handEvents.current.some(
      (e) => e.type === 'ENVIDO_RESOLVED' || e.type === 'FLOR_RESOLVED',
    );
    if (hadTantos) {
      setReveal(
        state.players
          .filter((p) => p.seat !== humanSeat)
          .map((p) => ({ seat: p.seat, cards: [...p.played, ...p.hand] })),
      );
    }
    const delay = hadTantos ? HAND_REVEAL_MS : HAND_FEEDBACK_MS;
    const t = setTimeout(() => {
      setReveal([]);
      handEvents.current = [];
      playSound('deal');
      setState((prev) => (prev.hand.finished ? startNextHand(prev) : prev));
    }, delay);
    return () => clearTimeout(t);
  }, [state, humanSeat]);

  // -------- Narración del Envido: burbujas escalonadas (tantos / son buenas) --------
  useEffect(() => {
    if (!pendingEnvido) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    pendingEnvido.forEach((b, i) => {
      timers.push(
        setTimeout(() => {
          setBubbles((prev) => [
            ...prev,
            { ...b, id: ++bubbleSeq, born: Date.now() },
          ]);
        }, i * NARRATION_STEP_MS),
      );
    });
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
    bubbles,
    reveal,
    dispatch,
    restart,
  };
}
