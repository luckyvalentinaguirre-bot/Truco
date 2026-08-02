import type { MatchState, Seat } from '@/game';
import { Avatar } from '@/components/ui/Avatar';
import { PlayingCard } from '@/components/game/PlayingCard';
import styles from './OpponentBar.module.css';

interface OpponentBarProps {
  state: MatchState;
  aiSeat: Seat;
  thinking: boolean;
}

export function OpponentBar({ state, aiSeat, thinking }: OpponentBarProps) {
  const ai = state.players[aiSeat];
  const remaining = ai.hand.length;

  return (
    <div className={styles.bar}>
      <Avatar name="Rival IA" size={44} online />
      <div className={styles.meta}>
        <span className={styles.name}>Rival IA</span>
        <span className={styles.team}>
          Equipo {ai.team}
          {thinking && <em className={styles.think}> · pensando…</em>}
        </span>
      </div>
      <div className={styles.cards} aria-label={`${remaining} cartas`}>
        {Array.from({ length: remaining }).map((_, i) => (
          <span key={i} className={styles.cardBack} style={{ marginLeft: i ? -34 : 0 }}>
            <PlayingCard faceDown size="sm" />
          </span>
        ))}
      </div>
    </div>
  );
}
