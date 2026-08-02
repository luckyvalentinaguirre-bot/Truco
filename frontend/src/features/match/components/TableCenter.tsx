import type { Card, MatchState, Seat } from '@/game';
import { cardCategory, suitLabel } from '@/game';
import { PlayingCard } from '@/components/game/PlayingCard';
import styles from './TableCenter.module.css';

interface TableCenterProps {
  state: MatchState;
  humanSeat: Seat;
  aiSeat: Seat;
}

/** Baza que se muestra: la actual si tiene cartas, si no la última jugada. */
function displayedTrick(state: MatchState) {
  const tricks = state.hand.tricks;
  const current = tricks[tricks.length - 1];
  if (current && current.plays.length > 0) return current;
  // baza recién resuelta: mostrar la anterior un instante
  for (let i = tricks.length - 1; i >= 0; i--) {
    if (tricks[i].plays.length > 0) return tricks[i];
  }
  return current;
}

export function TableCenter({ state, humanSeat, aiSeat }: TableCenterProps) {
  const { muestra } = state.hand;
  const trick = displayedTrick(state);
  const humanPlay = trick?.plays.find((p) => p.seat === humanSeat)?.card ?? null;
  const aiPlay = trick?.plays.find((p) => p.seat === aiSeat)?.card ?? null;

  // Pips de bazas resueltas.
  const humanTeam = state.players[humanSeat].team;
  const resolved = state.hand.tricks.filter((t) => t.outcome !== null);

  const muestraCat = cardCategory(muestra, muestra);

  return (
    <div className={styles.center}>
      {/* Muestra */}
      <div className={styles.muestraBox}>
        <span className={styles.muestraLabel}>Muestra</span>
        <PlayingCard card={muestra} size="sm" />
        <span className={styles.muestraSuit}>
          {suitLabel(muestra.suit)}
          {muestraCat === 'pieza' && <em className={styles.piezaTag}> · pieza</em>}
        </span>
      </div>

      {/* Bazas ganadas */}
      <div className={styles.pips} aria-label="Bazas">
        {[0, 1, 2].map((i) => {
          const t = resolved[i];
          let cls = styles.pipEmpty;
          if (t) {
            if (t.outcome === 'parda') cls = styles.pipParda;
            else cls = t.outcome === humanTeam ? styles.pipWin : styles.pipLoss;
          }
          return <span key={i} className={[styles.pip, cls].join(' ')} />;
        })}
      </div>

      {/* Zona de juego */}
      <div className={styles.playZone}>
        <div className={styles.aiSlot}>
          <PlayCardOrGhost card={aiPlay} />
        </div>
        <div className={styles.vs}>TRUCO</div>
        <div className={styles.humanSlot}>
          <PlayCardOrGhost card={humanPlay} />
        </div>
      </div>
    </div>
  );
}

function PlayCardOrGhost({ card }: { card: Card | null }) {
  if (!card) return <span className={styles.ghost} aria-hidden="true" />;
  return (
    <span className={styles.played}>
      <PlayingCard card={card} size="md" />
    </span>
  );
}
