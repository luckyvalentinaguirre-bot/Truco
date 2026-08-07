/* =============================================================
 * Visualización temporal de las cartas de un compañero (5 s).
 * -------------------------------------------------------------
 * La AUTORIDAD de qué se puede ver es del motor (`canPeekTeammate`).
 * Reglas: exactamente 5 s; re-tap reinicia el temporizador; un único
 * temporizador por jugador (una visualización activa a la vez); se
 * cancela al cambiar de mano/reparto, al terminar la partida o si el
 * objetivo deja de ser válido (se fue al mazo / abandonó).
 * ============================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canPeekTeammate, type MatchState, type Seat } from '@/game';
import type { RevealHand } from './useLocalMatch';

export const PEEK_MS = 5000;

export function useTeammatePeek(state: MatchState, humanSeat: Seat) {
  const [peekedSeat, setPeekedSeat] = useState<Seat | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setPeekedSeat(null);
  }, []);

  /** Solicita ver las cartas de `seat` (si el motor lo autoriza). */
  const peek = useCallback(
    (seat: Seat) => {
      if (!canPeekTeammate(state, humanSeat, seat)) return;
      // Un único temporizador: reiniciar siempre (re-tap o cambio de compañero).
      if (timer.current) clearTimeout(timer.current);
      setPeekedSeat(seat);
      timer.current = setTimeout(() => {
        timer.current = null;
        setPeekedSeat(null);
      }, PEEK_MS);
    },
    [state, humanSeat],
  );

  const canPeekSeat = useCallback(
    (seat: Seat) => canPeekTeammate(state, humanSeat, seat),
    [state, humanSeat],
  );

  // Nueva mano / reparto ⇒ cancelar visualización y timers.
  useEffect(() => {
    clear();
  }, [state.handNumber, clear]);

  // Fin de partida ⇒ ocultar de inmediato.
  useEffect(() => {
    if (state.phase === 'finished') clear();
  }, [state.phase, clear]);

  // El objetivo dejó de ser válido (abandono / al mazo / cartas nuevas).
  useEffect(() => {
    if (peekedSeat !== null && !canPeekTeammate(state, humanSeat, peekedSeat)) clear();
  }, [state, humanSeat, peekedSeat, clear]);

  // Limpieza al desmontar.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const peekReveal: RevealHand[] = useMemo(() => {
    if (peekedSeat === null) return [];
    const p = state.players.find((pl) => pl.seat === peekedSeat);
    if (!p) return [];
    return [{ seat: peekedSeat, cards: p.hand }];
  }, [peekedSeat, state.players]);

  return { peekedSeat, peek, peekReveal, canPeekSeat };
}
