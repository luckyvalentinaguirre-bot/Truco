import { Badge } from '@/components/ui';
import type { MatchRecord } from '@/types/domain';
import { MODE_LABEL, formatDuration, formatRelative } from '@/lib/format';
import styles from './MatchRow.module.css';

export function MatchRow({ match }: { match: MatchRecord }) {
  const win = match.result === 'win';
  return (
    <div className={styles.row}>
      <span
        className={[styles.result, win ? styles.win : styles.loss].join(' ')}
        aria-hidden="true"
      >
        {win ? 'V' : 'D'}
      </span>
      <div className={styles.info}>
        <div className={styles.top}>
          <span className={styles.opponent}>vs {match.opponent}</span>
          <Badge size="sm">{MODE_LABEL[match.mode]}</Badge>
        </div>
        <span className={styles.meta}>
          {formatRelative(match.playedAt)} · {formatDuration(match.durationSec)}
        </span>
      </div>
      <div className={styles.score}>
        <span className={win ? styles.scoreWin : styles.scoreLoss}>
          {match.scoreSelf}
        </span>
        <span className={styles.sep}>–</span>
        <span className={styles.scoreRival}>{match.scoreRival}</span>
      </div>
    </div>
  );
}
