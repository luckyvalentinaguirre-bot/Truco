/* =============================================================
 * Acciones de coordinación de equipo: TOCA + selección de compañero.
 * -------------------------------------------------------------
 * Sólo aparecen cuando el MOTOR las autoriza (equipos de >1, y para la
 * selección, únicamente el último jugador del equipo en la ronda). En
 * 1v1 no se muestra nada. La autoridad es del motor; acá sólo UI.
 * ============================================================= */
import { useState } from 'react';
import { canToca, canSelectTeammate, teammatesOf, type MatchState, type Seat } from '@/game';
import styles from './TeamActions.module.css';

interface Props {
  state: MatchState;
  humanSeat: Seat;
  onToca: () => void;
  onSelectTeammate: (seat: Seat) => void;
}

const nameOf = (seat: Seat) => `Jugador ${seat + 1}`;

export function TeamActions({ state, humanSeat, onToca, onSelectTeammate }: Props) {
  const [picking, setPicking] = useState(false);
  const showToca = canToca(state, humanSeat);
  const showSelect = canSelectTeammate(state, humanSeat);
  const mates = teammatesOf(state, humanSeat);

  if (!showToca && !showSelect) return null;

  return (
    <div className={styles.wrap}>
      {showToca && (
        <button className={styles.btn} onClick={onToca}>
          Toca
        </button>
      )}

      {showSelect && mates.length === 1 && (
        <button
          className={styles.btn}
          onClick={() => onSelectTeammate(mates[0]!)}
          aria-label={`Elegir a ${nameOf(mates[0]!)}`}
        >
          Elegir compañero
        </button>
      )}

      {showSelect && mates.length > 1 && (
        <div className={styles.selectWrap}>
          <button className={styles.btn} onClick={() => setPicking((p) => !p)}>
            Elegir compañero
          </button>
          {picking && (
            <div className={styles.menu} role="menu">
              <span className={styles.menuTitle}>¿A qué compañero?</span>
              {mates.map((seat) => (
                <button
                  key={seat}
                  className={styles.menuItem}
                  onClick={() => {
                    onSelectTeammate(seat);
                    setPicking(false);
                  }}
                >
                  {nameOf(seat)}
                </button>
              ))}
              <button className={styles.menuCancel} onClick={() => setPicking(false)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
