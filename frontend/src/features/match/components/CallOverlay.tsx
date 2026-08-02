import type { Action, Seat } from '@/game';
import { Button } from '@/components/ui';
import {
  TRUCO_LABEL,
  ENVIDO_LABEL,
  trucoAction,
  envidoAction,
  type HumanOptions,
} from '../matchView';
import styles from './CallOverlay.module.css';

interface CallOverlayProps {
  seat: Seat;
  callLabel: string;
  options: HumanOptions;
  onAction: (action: Action) => void;
}

/** Overlay para responder un canto del rival: Quiero / No quiero / subir. */
export function CallOverlay({ seat, callLabel, options, onAction }: CallOverlayProps) {
  return (
    <div className={styles.scrim}>
      <div className={styles.card} role="dialog" aria-label="Respuesta a canto">
        <span className={styles.title}>El rival cantó</span>
        <span className={styles.call}>{callLabel}</span>

        <div className={styles.actions}>
          {options.canAccept && (
            <Button size="lg" onClick={() => onAction({ type: 'ACCEPT', seat })}>
              Quiero
            </Button>
          )}
          {options.canDecline && (
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onAction({ type: 'DECLINE', seat })}
            >
              No quiero
            </Button>
          )}
        </div>

        {(options.trucoCalls.length > 0 || options.envidoCalls.length > 0) && (
          <div className={styles.raises}>
            <span className={styles.raiseLabel}>Subir:</span>
            {options.envidoCalls.map((call) => (
              <Button
                key={call}
                size="sm"
                variant="ghost"
                onClick={() => onAction(envidoAction(seat, call))}
              >
                {ENVIDO_LABEL[call]}
              </Button>
            ))}
            {options.trucoCalls.map((call) => (
              <Button
                key={call}
                size="sm"
                variant="ghost"
                onClick={() => onAction(trucoAction(seat, call))}
              >
                {TRUCO_LABEL[call]}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
