import { useEffect, useState } from 'react';
import {
  actorNow,
  getPending,
  type Action,
  type Card,
  type MatchState,
  type Seat,
  type TrucoCall,
} from '@/game';
import {
  humanOptions,
  humanHasFlor,
  piezaCardKeys,
  TRUCO_LABEL,
  ENVIDO_LABEL,
  FLOR_LABEL,
} from '@/features/match/matchView';
import type { ActiveBubble, RevealHand } from '@/features/match/useLocalMatch';
import { useTeammatePeek } from '@/features/match/useTeammatePeek';
import { MatchHud } from './MatchHud';
import { TableCenter } from './TableCenter';
import { PlayerHand } from './PlayerHand';
import { ActionBar } from './ActionBar';
import { TeamActions } from './TeamActions';
import { TeamChat } from './TeamChat';
import { GameOverModal } from './EndModals';
import styles from '@/pages/MatchPage.module.css';

let teamSignalSeq = 0;

interface MatchBoardProps {
  state: MatchState;
  /** Asiento del jugador local (0 en local; el asiento asignado en LAN). */
  humanSeat: Seat;
  aiSeat: Seat;
  bubbles: ActiveBubble[];
  reveal: RevealHand[];
  dispatch: (action: Action) => void;
  onRestart: () => void;
  /** Estado de conexión (sólo online/LAN). */
  netStatus?: import('./ConnectionIndicator').ConnState;
}

/**
 * Tablero de la partida (mesa + mano + acciones). Deriva TODO del estado y del
 * asiento local; lo comparten el modo local (vs IA) y el modo LAN (online).
 */
export function MatchBoard({
  state,
  humanSeat,
  aiSeat,
  bubbles,
  reveal,
  dispatch,
  onRestart,
  netStatus,
}: MatchBoardProps) {
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [state.hand.tricks.length, state.handNumber]);

  const options = humanOptions(state, humanSeat);
  const hasFlor = humanHasFlor(state, humanSeat);
  const piezaKeys = piezaCardKeys(state, humanSeat);
  const actorSeat = actorNow(state);
  const thinking = actorSeat !== null && actorSeat !== humanSeat && !state.hand.finished;

  const pending = getPending(state);
  const humanTeam = state.players[humanSeat].team;
  const humanMustRespond =
    pending !== null && pending.callerTeam !== humanTeam && actorNow(state) === humanSeat;

  const respondingTo = humanMustRespond
    ? pending!.kind === 'truco'
      ? TRUCO_LABEL[state.hand.truco.level as TrucoCall] ?? 'Truco'
      : pending!.kind === 'flor'
        ? FLOR_LABEL[state.hand.flor.call] ?? 'Flor'
        : ENVIDO_LABEL[state.hand.envido.calls[state.hand.envido.calls.length - 1]] ??
          'Envido'
    : null;

  const playCard = (card: Card) => {
    dispatch({ type: 'PLAY_CARD', seat: humanSeat, card });
    setSelected(null);
  };

  // Ver cartas de un compañero (5 s), autorizado por el motor.
  const { peek, peekReveal, canPeekSeat } = useTeammatePeek(state, humanSeat);
  // Reveal de fin de mano (envido/flor) + peek temporal de compañero.
  const reveals = [...reveal, ...peekReveal];

  // Señas de equipo (TOCA / selección de compañero): burbujas efímeras locales.
  const [signals, setSignals] = useState<ActiveBubble[]>([]);
  const pushSignal = (seat: Seat, text: string) => {
    const id = ++teamSignalSeq;
    setSignals((cur) => [...cur, { id, seat, text, born: Date.now() }]);
    setTimeout(() => setSignals((cur) => cur.filter((b) => b.id !== id)), 2600);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.feltFrame}>
        {/* HUD mínimo superpuesto (menú + tantos): la mesa ocupa todo el alto. */}
        <MatchHud state={state} humanSeat={humanSeat} netStatus={netStatus} />
        <div className={styles.felt}>
          <TableCenter
            state={state}
            humanSeat={humanSeat}
            aiSeat={aiSeat}
            thinking={thinking}
            bubbles={[...bubbles, ...signals]}
            reveal={reveals}
            onPeekSeat={peek}
            canPeekSeat={canPeekSeat}
          />

          <TeamActions
            state={state}
            humanSeat={humanSeat}
            onSelectTeammate={(seat) => pushSignal(seat, 'Elegido')}
          />

          <PlayerHand
            hand={state.players[humanSeat].hand}
            options={options}
            piezaKeys={piezaKeys}
            selectedIndex={selected}
            onSelect={setSelected}
            onPlay={playCard}
          />

          <ActionBar
            seat={humanSeat}
            options={options}
            hasFlor={hasFlor}
            respondingTo={respondingTo}
            onAction={dispatch}
          />

          <TeamChat
            state={state}
            humanSeat={humanSeat}
            onSend={(text) => pushSignal(humanSeat, text)}
          />
        </div>
      </div>

      {state.phase === 'finished' && (
        <GameOverModal state={state} humanSeat={humanSeat} onRestart={onRestart} />
      )}
    </div>
  );
}
