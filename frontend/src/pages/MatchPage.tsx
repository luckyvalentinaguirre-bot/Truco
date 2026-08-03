import { useLocation } from 'react-router-dom';
import type { GameMode } from '@/game';
import { loadSettings, type Difficulty } from '@/services/settings';
import { useLocalMatch } from '@/features/match/useLocalMatch';
import { MatchBoard } from '@/features/match/components/MatchBoard';

export function MatchPage() {
  const location = useLocation();
  const navState = location.state as { difficulty?: Difficulty; mode?: GameMode } | null;
  const difficulty: Difficulty = navState?.difficulty ?? loadSettings().difficulty;
  const mode: GameMode = navState?.mode ?? '1v1';

  const { state, humanSeat, aiSeat, bubbles, reveal, dispatch, restart } =
    useLocalMatch(difficulty, mode);

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
