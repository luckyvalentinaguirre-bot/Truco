import type { MatchState, Seat } from '@/game';
import { cardCategory, suitLabel } from '@/game';
import { Avatar } from '@/components/ui/Avatar';
import { PlayingCard } from '@/components/game/PlayingCard';
import styles from './TableCenter.module.css';

interface TableCenterProps {
  state: MatchState;
  humanSeat: Seat;
  aiSeat: Seat;
  thinking: boolean;
}

/** Baza en curso, o la última con cartas si la actual está vacía. */
function displayedTrick(state: MatchState) {
  const tricks = state.hand.tricks;
  const current = tricks[tricks.length - 1];
  if (current && current.plays.length > 0) return current;
  for (let i = tricks.length - 1; i >= 0; i--) {
    if (tricks[i].plays.length > 0) return tricks[i];
  }
  return current;
}

/** Sol uruguayo estilizado (detrás del logo central). */
function SunLogo() {
  return (
    <svg viewBox="0 0 120 120" className={styles.sun} aria-hidden="true">
      <circle cx="60" cy="60" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const long = i % 2 === 0;
        const r1 = 24;
        const r2 = long ? 44 : 36;
        return (
          <line
            key={i}
            x1={60 + Math.cos(a) * r1}
            y1={60 + Math.sin(a) * r1}
            x2={60 + Math.cos(a) * r2}
            y2={60 + Math.sin(a) * r2}
            stroke="currentColor"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}

export function TableCenter({ state, humanSeat, aiSeat, thinking }: TableCenterProps) {
  const { muestra } = state.hand;
  const trick = displayedTrick(state);
  const humanPlay = trick?.plays.find((p) => p.seat === humanSeat)?.card ?? null;
  const aiPlay = trick?.plays.find((p) => p.seat === aiSeat)?.card ?? null;

  const humanTeam = state.players[humanSeat].team;
  const resolved = state.hand.tricks.filter((t) => t.outcome !== null);
  const lastResolved = resolved[resolved.length - 1];

  const muestraCat = cardCategory(muestra, muestra);
  const manoIsHuman = state.hand.manoSeat === humanSeat;
  const aiRemaining = state.players[aiSeat].hand.length;
  const deckRemaining = 40 - state.players.length * 3 - 1;

  return (
    <>
      {/* Fila superior: rival · cartas rival · mano */}
      <div className={styles.rivalRow}>
        <div className={styles.rivalInfo}>
          <Avatar name="Rival IA" size={40} online />
          <div>
            <div className={styles.rivalName}>Rival IA</div>
            <div className={styles.rivalTeam}>
              Equipo {state.players[aiSeat].team}
              {thinking && <em className={styles.think}> · pensando…</em>}
            </div>
          </div>
        </div>

        <div className={styles.rivalCards} aria-label={`${aiRemaining} cartas del rival`}>
          {Array.from({ length: aiRemaining }).map((_, i) => (
            <PlayingCard key={i} faceDown size="sm" />
          ))}
        </div>
      </div>

      {/* Zona de juego */}
      <div className={styles.playArea}>
        {/* Última baza */}
        <div className={styles.ultimaBaza}>
          <span className={styles.boxLabel}>Última baza</span>
          <div className={styles.ultimaSlots}>
            {[0, 1].map((i) => {
              const card = lastResolved?.plays[i]?.card ?? null;
              return card ? (
                <PlayingCard key={i} card={card} size="sm" />
              ) : (
                <span key={i} className={styles.ultimaSlot} />
              );
            })}
          </div>
          {!lastResolved && <span className={styles.ultimaEmpty}>Aún no hay bazas</span>}
        </div>

        {/* Centro: logo + baza en curso */}
        <div className={styles.center}>
          <div className={styles.logo} aria-hidden="true">
            <SunLogo />
            <span className={styles.logoTitle}>TRUCO</span>
            <span className={styles.logoSub}>URUGUAYO</span>
          </div>
          <div className={styles.baza}>
            <div className={styles.aiSlot}>
              {aiPlay ? (
                <span className={styles.dropped}><PlayingCard card={aiPlay} size="md" /></span>
              ) : (
                <span className={styles.bazaGhost} />
              )}
            </div>
            <div className={styles.humanSlot}>
              {humanPlay ? (
                <span className={styles.dropped}><PlayingCard card={humanPlay} size="md" /></span>
              ) : (
                <span className={styles.bazaGhost} />
              )}
            </div>
          </div>

          {/* Pips de bazas ganadas */}
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
        </div>

        {/* Mano · muestra · mazo (columna derecha) */}
        <div className={styles.rightStack}>
          <div className={styles.manoBox}>
            <span className={styles.manoLabel}>Mano</span>
            <span className={styles.manoWho}>{manoIsHuman ? 'Vos' : 'Rival'}</span>
          </div>
          <div className={styles.muestraBox}>
            <span className={styles.boxLabel}>Muestra</span>
            <PlayingCard card={muestra} size="sm" />
            <span className={styles.muestraSuit}>
              {suitLabel(muestra.suit)}
              {muestraCat === 'pieza' && <em className={styles.piezaTag}> · pieza</em>}
            </span>
          </div>
          <div className={styles.mazoBox}>
            <PlayingCard faceDown size="sm" />
            <span className={styles.mazoCount}>{deckRemaining} cartas</span>
          </div>
        </div>
      </div>
    </>
  );
}
