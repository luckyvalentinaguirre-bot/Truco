/* =============================================================
 * Estado de la partida en la barra superior (funcional, sin estética
 * final): modalidad, ronda, quién es MANO (≠ turno) y, en 3v3, la fase
 * Pico a Pico con el enfrentamiento activo. Todo sale del ESTADO del
 * motor (fuente de verdad); la UI sólo representa.
 * ============================================================= */
import {
  PICO_PAIRS,
  picoPhaseActive,
  type MatchState,
  type Seat,
} from '@/game';
import styles from './GameStatus.module.css';

interface Props {
  state: MatchState;
  humanSeat: Seat;
}

const MODE_LABEL: Record<string, string> = {
  '1v1': '1 vs 1',
  '2v2': '2 vs 2',
  '3v3': '3 vs 3',
  '3players': '2 vs 1',
};

/** Índice del enfrentamiento pico actual (0..2) según los duelistas al pico. */
function picoDuelIndex(state: MatchState): number {
  const a = state.picoActive?.A;
  if (a === undefined) return 0;
  const idx = PICO_PAIRS.findIndex((pair) => pair.includes(a));
  return idx < 0 ? 0 : idx;
}

const seatLabel = (seat: Seat, humanSeat: Seat) =>
  seat === humanSeat ? 'vos' : `Jugador ${seat + 1}`;

export function GameStatus({ state, humanSeat }: Props) {
  const inPico = picoPhaseActive(state);
  const manoSeat = state.hand.manoSeat;

  return (
    <div className={styles.wrap} aria-label="Estado de la partida">
      <span className={styles.mode}>{MODE_LABEL[state.mode] ?? state.mode}</span>

      {inPico ? (
        <span className={[styles.chip, styles.pico].join(' ')}>
          Pico a Pico · {picoDuelIndex(state) + 1}/3
          {state.picoActive && (
            <em className={styles.duel}>
              {' '}
              · Jugador {state.picoActive.A + 1} vs Jugador {state.picoActive.B + 1}
            </em>
          )}
        </span>
      ) : (
        <span className={styles.chip}>Ronda {state.handNumber}</span>
      )}

      <span className={styles.chip} title="El mano no es lo mismo que el turno">
        Mano: {seatLabel(manoSeat, humanSeat)}
      </span>
    </div>
  );
}
