import type { MatchState, TeamId } from '@/game';
import styles from './Scoreboard.module.css';

interface ScoreboardProps {
  state: MatchState;
  humanSeat: number;
}

function Column({ label, points, target, malas, highlight }: {
  label: string;
  points: number;
  target: number;
  malas: number;
  highlight: boolean;
}) {
  const inBuenas = points >= malas;
  return (
    <div className={[styles.col, highlight ? styles.me : ''].join(' ')}>
      <span className={styles.team}>{label}</span>
      <span className={styles.points}>{points}</span>
      <span className={styles.phase}>
        {inBuenas ? `Buenas · ${points - malas}` : `Malas · ${points}`}
      </span>
      <div className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${(points / target) * 100}%` }} />
        <span className={styles.mid} />
      </div>
    </div>
  );
}

export function Scoreboard({ state, humanSeat }: ScoreboardProps) {
  const humanTeam: TeamId = state.players[humanSeat].team;
  const target = state.ruleset.targetPoints;
  const malas = state.ruleset.malas;

  return (
    <div className={styles.board}>
      <Column
        label="Vos"
        points={state.score[humanTeam]}
        target={target}
        malas={malas}
        highlight
      />
      <span className={styles.sep}>—</span>
      <Column
        label="Rival"
        points={state.score[humanTeam === 'A' ? 'B' : 'A']}
        target={target}
        malas={malas}
        highlight={false}
      />
    </div>
  );
}
