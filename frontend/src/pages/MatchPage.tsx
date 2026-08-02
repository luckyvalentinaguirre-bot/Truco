import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  actorNow,
  getPending,
  type Card,
  type TrucoCall,
} from '@/game';
import { Icon } from '@/components/ui';
import { useLocalMatch } from '@/features/match/useLocalMatch';
import {
  humanOptions,
  statusText,
  humanHasFlor,
  TRUCO_LABEL,
  ENVIDO_LABEL,
} from '@/features/match/matchView';
import { Scoreboard } from '@/features/match/components/Scoreboard';
import { OpponentBar } from '@/features/match/components/OpponentBar';
import { TableCenter } from '@/features/match/components/TableCenter';
import { PlayerHand } from '@/features/match/components/PlayerHand';
import { ActionBar } from '@/features/match/components/ActionBar';
import { CallOverlay } from '@/features/match/components/CallOverlay';
import { StatusBar } from '@/features/match/components/StatusBar';
import {
  HandSummaryModal,
  GameOverModal,
} from '@/features/match/components/EndModals';
import styles from './MatchPage.module.css';

export function MatchPage() {
  const navigate = useNavigate();
  const { state, humanSeat, aiSeat, banner, handSummary, dispatch, nextHand, restart } =
    useLocalMatch();
  const [selected, setSelected] = useState<number | null>(null);

  // Al cambiar la mano/estado, limpiar la selección de carta.
  useEffect(() => {
    setSelected(null);
  }, [state.hand.tricks.length, state.handNumber]);

  const options = humanOptions(state, humanSeat);
  const status = statusText(state, humanSeat);
  const hasFlor = humanHasFlor(state, humanSeat);
  const thinking = actorNow(state) === aiSeat && !state.hand.finished;

  const pending = getPending(state);
  const humanTeam = state.players[humanSeat].team;
  const humanMustRespond =
    pending !== null &&
    pending.callerTeam !== humanTeam &&
    actorNow(state) === humanSeat;

  const callLabel = pending
    ? pending.kind === 'truco'
      ? TRUCO_LABEL[state.hand.truco.level as TrucoCall] ?? 'Truco'
      : ENVIDO_LABEL[state.hand.envido.calls[state.hand.envido.calls.length - 1]] ??
        'Envido'
    : '';

  const playCard = (card: Card) => {
    dispatch({ type: 'PLAY_CARD', seat: humanSeat, card });
    setSelected(null);
  };

  const showSummary = state.hand.finished && state.phase === 'playing';
  const showGameOver = state.phase === 'finished';

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <button className={styles.exit} onClick={() => navigate('/')} aria-label="Salir">
          <Icon name="close" size={22} />
        </button>
        <Scoreboard state={state} humanSeat={humanSeat} />
      </header>

      <OpponentBar state={state} aiSeat={aiSeat} thinking={thinking} />

      <TableCenter state={state} humanSeat={humanSeat} aiSeat={aiSeat} />

      <div className={styles.statusRow}>
        <StatusBar status={status} banner={banner} />
      </div>

      <PlayerHand
        hand={state.players[humanSeat].hand}
        options={options}
        selectedIndex={selected}
        onSelect={setSelected}
        onPlay={playCard}
      />

      <div className={styles.actions}>
        <ActionBar seat={humanSeat} options={options} hasFlor={hasFlor} onAction={dispatch} />
      </div>

      {humanMustRespond && (
        <CallOverlay
          seat={humanSeat}
          callLabel={callLabel}
          options={options}
          onAction={dispatch}
        />
      )}

      {showSummary && handSummary && (
        <HandSummaryModal
          summary={handSummary}
          state={state}
          humanSeat={humanSeat}
          onNext={nextHand}
        />
      )}

      {showGameOver && (
        <GameOverModal state={state} humanSeat={humanSeat} onRestart={restart} />
      )}
    </div>
  );
}
