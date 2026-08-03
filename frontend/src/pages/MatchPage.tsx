import { useLocation } from 'react-router-dom';
import type { GameMode } from '@/game';
import { OFFICIAL_40, SHORT_30 } from '@/game';
import { loadSettings, type Difficulty, type Puntos } from '@/services/settings';
import { useLocalMatch } from '@/features/match/useLocalMatch';
import { MatchBoard } from '@/features/match/components/MatchBoard';

export function MatchPage() {
  const location = useLocation();
  const navState = location.state as {
    difficulty?: Difficulty;
    mode?: GameMode;
    puntos?: Puntos;
  } | null;
  const settings = loadSettings();
  const difficulty: Difficulty = navState?.difficulty ?? settings.difficulty;
  const mode: GameMode = navState?.mode ?? '1v1';
  const puntos: Puntos = navState?.puntos ?? settings.puntos;
  const ruleset = puntos === 40 ? OFFICIAL_40 : SHORT_30;

  const { state, humanSeat, aiSeat, bubbles, reveal, dispatch, restart } =
    useLocalMatch(difficulty, mode, ruleset);

  return (
    <MatchBoard
      state={state}
      humanSeat={humanSeat}
      aiSeat={aiSeat}
      bubbles={bubbles}
      reveal={reveal}
      dispatch={dispatch}
      onRestart={restart}
    />
  );
}
