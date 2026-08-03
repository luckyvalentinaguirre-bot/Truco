import type { MatchState, Seat } from '@/game';
import { cardCategory, suitLabel } from '@/game';
import { Avatar } from '@/components/ui/Avatar';
import { PlayingCard } from '@/components/game/PlayingCard';
import { seatViews, type Spot } from '../seating';
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

/** Muestra + mazo (columna derecha), compartido por todos los modos. */
function RightStack({ state, manoIsHuman }: { state: MatchState; manoIsHuman: boolean }) {
  const { muestra } = state.hand;
  const muestraCat = cardCategory(muestra, muestra);
  const deckRemaining = 40 - state.players.length * 3 - 1;
  return (
    <div className={styles.rightStack}>
      <div className={[styles.manoBox, styles.manoSide].join(' ')}>
        <span className={styles.manoLabel}>Mano</span>
        <span className={styles.manoWho}>{manoIsHuman ? 'Vos' : 'Rival'}</span>
      </div>
      {/* Pila real: mazo (reverso) tapando ~50% de la muestra por debajo. */}
      <div className={styles.pile}>
        <span className={styles.boxLabel}>Mazo · Muestra</span>
        <div className={styles.pileStack} aria-label="Mazo y muestra">
          <span className={styles.pileMuestra}>
            <PlayingCard card={muestra} size="sm" />
          </span>
          <span className={styles.pileMazo}>
            <PlayingCard faceDown size="sm" />
          </span>
        </div>
        <span className={styles.muestraSuit}>
          {suitLabel(muestra.suit)}
          {muestraCat === 'pieza' && <em className={styles.piezaTag}> · pieza</em>}
          <span className={styles.mazoCount}> · {deckRemaining} en el mazo</span>
        </span>
      </div>
    </div>
  );
}

function Pips({ state, humanTeam }: { state: MatchState; humanTeam: string }) {
  const resolved = state.hand.tricks.filter((t) => t.outcome !== null);
  return (
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
  );
}

// -------------------------------------------------------------
// 1v1 (diseño original, intacto)
// -------------------------------------------------------------
function Table1v1({ state, humanSeat, aiSeat, thinking }: TableCenterProps) {
  const trick = displayedTrick(state);
  const humanPlay = trick?.plays.find((p) => p.seat === humanSeat)?.card ?? null;
  const aiPlay = trick?.plays.find((p) => p.seat === aiSeat)?.card ?? null;
  const humanTeam = state.players[humanSeat].team;
  const resolved = state.hand.tricks.filter((t) => t.outcome !== null);
  const lastResolved = resolved[resolved.length - 1];
  const manoIsHuman = state.hand.manoSeat === humanSeat;
  const aiRemaining = state.players[aiSeat].hand.length;

  return (
    <>
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
        <div className={[styles.manoBox, styles.manoTop].join(' ')}>
          <span className={styles.manoLabel}>Mano</span>
          <span className={styles.manoWho}>{manoIsHuman ? 'Vos' : 'Rival'}</span>
        </div>
      </div>

      <div className={styles.playArea}>
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

        <div className={styles.center}>
          <div className={styles.logo} aria-hidden="true">
            <SunLogo />
            <span className={styles.logoTitle}>TRUCO</span>
            <span className={styles.logoSub}>URUGUAYO</span>
          </div>
          <div className={styles.baza}>
            <div className={styles.aiSlot}>
              {aiPlay ? (
                <PlayingCard card={aiPlay} size="md" flip />
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
          <Pips state={state} humanTeam={humanTeam} />
        </div>

        <RightStack state={state} manoIsHuman={manoIsHuman} />
      </div>
    </>
  );
}

// -------------------------------------------------------------
// 2v2 / 3v3 (asientos alrededor del óvalo)
// -------------------------------------------------------------
function OpponentSeat({
  name,
  team,
  remaining,
  spot,
  thinking,
  isMano,
}: {
  name: string;
  team: string;
  remaining: number;
  spot: Spot;
  thinking: boolean;
  isMano: boolean;
}) {
  const vertical = spot === 'left' || spot === 'right';
  return (
    <div className={[styles.seat, styles[`seat_${spot}`]].join(' ')}>
      <div className={styles.seatInfo}>
        <Avatar name={name} size={30} online />
        <div className={styles.seatText}>
          <span className={styles.seatName}>
            {name}
            {isMano && <span className={styles.seatMano}> · mano</span>}
          </span>
          <span className={styles.seatTeam}>
            Equipo {team}
            {thinking && <em className={styles.think}> · pensando…</em>}
          </span>
        </div>
      </div>
      <div className={[styles.seatCards, vertical ? styles.seatCardsV : ''].join(' ')}>
        {Array.from({ length: remaining }).map((_, i) => (
          <PlayingCard key={i} faceDown size="sm" />
        ))}
      </div>
    </div>
  );
}

function TableMulti({ state, humanSeat, thinking }: TableCenterProps) {
  const trick = displayedTrick(state);
  const humanTeam = state.players[humanSeat].team;
  const manoIsHuman = state.hand.manoSeat === humanSeat;
  const views = seatViews(state.players, humanSeat);
  const bySeat = new Map(views.map((v) => [v.seat, v]));

  return (
    <>
      {/* Asientos de rivales/compañeros alrededor del óvalo */}
      <div className={styles.seatsLayer}>
        {views
          .filter((v) => !v.isHuman)
          .map((v) => {
            const p = state.players[v.seat];
            const isActor = state.hand.turnSeat === v.seat;
            return (
              <OpponentSeat
                key={v.seat}
                name={`Jugador ${v.seat + 1}`}
                team={v.team}
                remaining={p.hand.length}
                spot={v.spot}
                thinking={thinking && isActor}
                isMano={state.hand.manoSeat === v.seat}
              />
            );
          })}
      </div>

      <div className={styles.playArea}>
        <div className={styles.center}>
          <div className={styles.logo} aria-hidden="true">
            <SunLogo />
            <span className={styles.logoTitle}>TRUCO</span>
            <span className={styles.logoSub}>URUGUAYO</span>
          </div>

          {/* Cartas jugadas: cada una desplazada hacia el asiento que la jugó */}
          <div className={styles.bazaMulti}>
            {(trick?.plays ?? []).map((play) => {
              const v = bySeat.get(play.seat);
              const spot = v?.spot ?? 'bottom';
              return (
                <span
                  key={play.seat}
                  className={[styles.playCard, styles[`play_${spot}`]].join(' ')}
                >
                  <PlayingCard card={play.card} size="md" flip={!v?.isHuman} />
                </span>
              );
            })}
          </div>

          <Pips state={state} humanTeam={humanTeam} />
        </div>

        <RightStack state={state} manoIsHuman={manoIsHuman} />
      </div>
    </>
  );
}

export function TableCenter(props: TableCenterProps) {
  return props.state.players.length > 2 ? (
    <TableMulti {...props} />
  ) : (
    <Table1v1 {...props} />
  );
}
