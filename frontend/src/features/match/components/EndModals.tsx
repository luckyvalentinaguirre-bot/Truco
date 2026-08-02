import { useNavigate } from 'react-router-dom';
import type { MatchState, Seat, TeamId } from '@/game';
import { Button } from '@/components/ui';
import styles from './EndModals.module.css';

interface GameOverModalProps {
  state: MatchState;
  humanSeat: Seat;
  onRestart: () => void;
}

/** Pantalla final — SÓLO al terminar la partida (no entre manos). */
export function GameOverModal({ state, humanSeat, onRestart }: GameOverModalProps) {
  const navigate = useNavigate();
  const humanTeam = state.players[humanSeat].team;
  const won = state.winner === humanTeam;
  const rivalTeam: TeamId = humanTeam === 'A' ? 'B' : 'A';

  return (
    <div className={styles.scrim}>
      <div className={styles.card} role="dialog" aria-label="Fin de la partida">
        <span className={styles.eyebrow}>Fin de la partida</span>
        <h1 className={[styles.big, won ? styles.win : styles.loss].join(' ')}>
          {won ? '🏆 ¡Ganaste!' : 'Derrota'}
        </h1>
        <div className={styles.finalScore}>
          {state.score[humanTeam]} — {state.score[rivalTeam]}
        </div>
        <div className={styles.overActions}>
          <Button size="lg" block onClick={onRestart}>
            Jugar de nuevo
          </Button>
          <Button size="lg" variant="secondary" block onClick={() => navigate('/')}>
            Volver al menú
          </Button>
        </div>
      </div>
    </div>
  );
}
