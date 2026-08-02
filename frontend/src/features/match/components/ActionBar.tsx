import { useState } from 'react';
import type { Action, Seat } from '@/game';
import { Button } from '@/components/ui';
import {
  TRUCO_LABEL,
  ENVIDO_LABEL,
  trucoAction,
  envidoAction,
  type HumanOptions,
} from '../matchView';
import styles from './ActionBar.module.css';

interface ActionBarProps {
  seat: Seat;
  options: HumanOptions;
  hasFlor: boolean;
  onAction: (action: Action) => void;
}

/**
 * Barra de acciones contextual. SÓLO muestra acciones legales
 * (calculadas por el motor). No hay botones deshabilitados sueltos.
 */
export function ActionBar({ seat, options, hasFlor, onAction }: ActionBarProps) {
  const [confirmFold, setConfirmFold] = useState(false);

  const nothing =
    options.trucoCalls.length === 0 &&
    options.envidoCalls.length === 0 &&
    !options.canFlor &&
    !options.canFold;

  if (nothing) {
    return <div className={styles.bar} />;
  }

  return (
    <div className={styles.bar}>
      {confirmFold ? (
        <div className={styles.confirm}>
          <span className={styles.confirmText}>¿Seguro que te vas al mazo?</span>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              onAction({ type: 'FOLD', seat });
              setConfirmFold(false);
            }}
          >
            Sí, me voy
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmFold(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className={styles.groups}>
          {options.envidoCalls.length > 0 && (
            <div className={styles.group}>
              {options.envidoCalls.map((call) => (
                <Button
                  key={call}
                  size="sm"
                  variant="secondary"
                  onClick={() => onAction(envidoAction(seat, call))}
                >
                  {ENVIDO_LABEL[call]}
                </Button>
              ))}
            </div>
          )}

          {options.canFlor && hasFlor && (
            <div className={styles.group}>
              <Button size="sm" onClick={() => onAction({ type: 'CALL_FLOR', seat })}>
                🌸 Flor
              </Button>
            </div>
          )}

          {options.trucoCalls.length > 0 && (
            <div className={styles.group}>
              {options.trucoCalls.map((call) => (
                <Button
                  key={call}
                  size="sm"
                  onClick={() => onAction(trucoAction(seat, call))}
                >
                  {TRUCO_LABEL[call]}
                </Button>
              ))}
            </div>
          )}

          {options.canFold && (
            <div className={styles.group}>
              <Button size="sm" variant="ghost" onClick={() => setConfirmFold(true)}>
                Me voy al mazo
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
