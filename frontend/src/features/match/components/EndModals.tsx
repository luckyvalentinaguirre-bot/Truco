import { useNavigate } from 'react-router-dom';
import type { MatchState, Seat, TeamId } from '@/game';
import { Button } from '@/components/ui';
import type { HandSummary } from '../useLocalMatch';
import styles from './EndModals.module.css';

const REASON_LABEL: Record<string, string> = {
  truco: 'Truco',
  truco_no_querido: 'Truco (no querido)',
  envido: 'Envido',
  envido_no_querido: 'Envido (no querido)',
  flor: 'Flor',
  mazo: 'Se fue al mazo',
};

function teamLabel(team: TeamId, humanTeam: TeamId): string {
  return team === humanTeam ? 'Vos' : 'Rival';
}

interface HandSummaryModalProps {
  summary: HandSummary;
  state: MatchState;
  humanSeat: Seat;
  onNext: () => void;
}

export function HandSummaryModal({
  summary,
  state,
  humanSeat,
  onNext,
}: HandSummaryModalProps) {
  const humanTeam = state.players[humanSeat].team;
  const won = summary.winner === humanTeam;

  return (
    <div className={styles.scrim}>
      <div className={styles.card} role="dialog" aria-label="Resumen de la mano">
        <span className={styles.eyebrow}>Fin de la mano</span>
        <h2 className={[styles.title, won ? styles.win : styles.loss].join(' ')}>
          {won ? 'Ganaste la mano' : summary.winner ? 'Ganó el rival' : 'Mano terminada'}
        </h2>

        <ul className={styles.awards}>
          {summary.awards.length === 0 && (
            <li className={styles.awardRow}>
              <span>Sin puntos en juego</span>
            </li>
          )}
          {summary.awards.map((a, i) => (
            <li key={i} className={styles.awardRow}>
              <span>{REASON_LABEL[a.reason] ?? a.reason}</span>
              <span className={styles.awardPts}>
                +{a.points} · {teamLabel(a.team, humanTeam)}
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.score}>
          <span>Vos {state.score[humanTeam]}</span>
          <span className={styles.scoreSep}>—</span>
          <span>Rival {state.score[humanTeam === 'A' ? 'B' : 'A']}</span>
        </div>

        <Button size="lg" block onClick={onNext}>
          Siguiente mano
        </Button>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  state: MatchState;
  humanSeat: Seat;
  onRestart: () => void;
}

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
          {won ? '¡Ganaste!' : 'Perdiste'}
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
