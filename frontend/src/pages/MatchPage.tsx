import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  actorNow,
  getPending,
  type Card,
  type GameMode,
  type TrucoCall,
} from '@/game';
import { Icon } from '@/components/ui';
import { loadSettings, type Difficulty, type Settings } from '@/services/settings';
import { getMesaAsset } from '@/features/match/mesaAssets';
import { useLocalMatch } from '@/features/match/useLocalMatch';
import {
  humanOptions,
  humanHasFlor,
  piezaCardKeys,
  TRUCO_LABEL,
  ENVIDO_LABEL,
  FLOR_LABEL,
} from '@/features/match/matchView';
import { TopBar } from '@/features/match/components/TopBar';
import { TableCenter } from '@/features/match/components/TableCenter';
import { PlayerHand } from '@/features/match/components/PlayerHand';
import { ActionBar } from '@/features/match/components/ActionBar';
import { GameOverModal } from '@/features/match/components/EndModals';
import styles from './MatchPage.module.css';

export function MatchPage() {
  const location = useLocation();
  const navState = location.state as { difficulty?: Difficulty; mode?: GameMode } | null;
  const difficulty: Difficulty = navState?.difficulty ?? loadSettings().difficulty;
  const mode: GameMode = navState?.mode ?? '1v1';

  const { state, humanSeat, aiSeat, bubbles, reveal, dispatch, restart } =
    useLocalMatch(difficulty, mode);
  const [selected, setSelected] = useState<number | null>(null);

  // Tema de mesa (imagen de fondo real). Se actualiza en vivo al cambiarlo.
  const [mesaTheme, setMesaTheme] = useState(() => loadSettings().mesaTheme);
  useEffect(() => {
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent<Settings>).detail;
      if (s?.mesaTheme) setMesaTheme(s.mesaTheme);
    };
    window.addEventListener('truco:settings', onSettings as EventListener);
    return () => window.removeEventListener('truco:settings', onSettings as EventListener);
  }, []);

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
    pending !== null &&
    pending.callerTeam !== humanTeam &&
    actorNow(state) === humanSeat;

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

  return (
    <div className={styles.screen}>
      <TopBar state={state} humanSeat={humanSeat} />

      <div
        className={styles.feltFrame}
        style={{ backgroundImage: `url("${getMesaAsset(mesaTheme)}")` }}
      >
        <div className={styles.felt}>
          <TableCenter
            state={state}
            humanSeat={humanSeat}
            aiSeat={aiSeat}
            thinking={thinking}
            bubbles={bubbles}
            reveal={reveal}
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

          <button className={styles.chat} disabled aria-label="Chat (próximamente)">
            <Icon name="chat" size={18} /> Chat
          </button>
        </div>
      </div>

      {state.phase === 'finished' && (
        <GameOverModal state={state} humanSeat={humanSeat} onRestart={restart} />
      )}
    </div>
  );
}
