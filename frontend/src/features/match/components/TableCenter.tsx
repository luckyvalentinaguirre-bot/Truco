import type { MatchState, Seat } from '@/game';
import { isPieza } from '@/game';
import { Avatar } from '@/components/ui/Avatar';
import { PlayingCard } from '@/components/game/PlayingCard';
import type { Card } from '@/game';
import { seatViews, type Spot } from '../seating';
import type { ActiveBubble, RevealHand } from '../useLocalMatch';
import styles from './TableCenter.module.css';

interface TableCenterProps {
  state: MatchState;
  humanSeat: Seat;
  aiSeat: Seat;
  thinking: boolean;
  bubbles?: ActiveBubble[];
  reveal?: RevealHand[];
  /** Tap/click sobre las cartas de un compañero para verlas (5 s). */
  onPeekSeat?: (seat: Seat) => void;
  /** ¿El asiento es un compañero cuyas cartas se pueden ver? */
  canPeekSeat?: (seat: Seat) => boolean;
}

/** Mano de un rival revelada boca arriba (al terminar una mano con envido/flor). */
function RevealedCards({ cards }: { cards: Card[] }) {
  return (
    <div className={styles.oppHand} aria-label="Cartas del rival">
      {cards.map((card, i) => (
        <span key={i} className={styles.dealCard}>
          <PlayingCard card={card} size="sm" flip />
        </span>
      ))}
    </div>
  );
}

/** Capa de burbujas de canto: cada una junto al asiento que la dijo. */
function SeatBubbles({
  state,
  humanSeat,
  bubbles,
}: {
  state: MatchState;
  humanSeat: Seat;
  bubbles: ActiveBubble[];
}) {
  if (bubbles.length === 0) return null;
  const spotOf = new Map(
    seatViews(state.players, humanSeat).map((v) => [v.seat, v.spot]),
  );
  return (
    <div className={styles.bubbleLayer} aria-live="polite">
      {bubbles.map((b) => {
        const spot = spotOf.get(b.seat) ?? 'bottom';
        return (
          <span
            key={b.id}
            className={[styles.bubble, styles[`bubble_${spot}`]].join(' ')}
          >
            {b.text}
          </span>
        );
      })}
    </div>
  );
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

/** Pila mazo + muestra (reverso tapando ~50% de la muestra por debajo). */
function DeckPile({ state }: { state: MatchState }) {
  const { muestra } = state.hand;
  return (
    <div className={styles.pile}>
      <div className={styles.pileStack} aria-label="Mazo y muestra">
        <span className={styles.pileMuestra}>
          {/* La muestra (vira) siempre visible, en su lugar. */}
          <PlayingCard card={muestra} size="sm" />
        </span>
        <span className={styles.pileMazo}>
          <PlayingCard faceDown size="sm" />
        </span>
      </div>
    </div>
  );
}

/** Mazo + muestra a la IZQUIERDA del mano — usado por 2v2/3v3. */
function ManoDeck({ state, manoSpot }: { state: MatchState; manoSpot: Spot }) {
  return (
    <div className={[styles.deckMulti, styles[`deckMano_${manoSpot}`]].join(' ')}>
      <DeckPile state={state} />
    </div>
  );
}

// -------------------------------------------------------------
// 1v1 (diseño original, intacto)
// -------------------------------------------------------------
function Table1v1({ state, humanSeat, aiSeat, thinking, reveal }: TableCenterProps) {
  const trick = displayedTrick(state);
  const humanPlay = trick?.plays.find((p) => p.seat === humanSeat)?.card ?? null;
  const aiPlay = trick?.plays.find((p) => p.seat === aiSeat)?.card ?? null;
  const manoIsHuman = state.hand.manoSeat === humanSeat;
  const aiRemaining = state.players[aiSeat].hand.length;
  const revealCards = reveal?.find((r) => r.seat === aiSeat)?.cards;

  return (
    <>
      {/* ── Zona del RIVAL (arriba): identidad + su mano boca abajo ── */}
      <div className={styles.oppZone}>
        <div className={styles.oppInfo}>
          <Avatar name="Rival IA" size={38} online />
          <div className={styles.oppText}>
            <span className={styles.oppName}>Rival IA</span>
            <span className={styles.oppTeam}>
              Equipo {state.players[aiSeat].team}
              {thinking && <em className={styles.think}> · pensando…</em>}
            </span>
          </div>
        </div>
        {revealCards ? (
          <RevealedCards cards={revealCards} />
        ) : (
          <div className={styles.oppHand} aria-label={`${aiRemaining} cartas del rival`}>
            {Array.from({ length: aiRemaining }).map((_, i) => (
              <span key={`${state.handNumber}-${i}`} className={styles.dealCard} style={{ animationDelay: `${i * 110}ms` }}>
                <PlayingCard faceDown size="sm" />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Cartas jugadas: capa sobre el paño usando el alto del óvalo, para
             que rival (arriba) y jugador (abajo) NUNCA se superpongan ── */}
      <div className={styles.playedLayer} aria-hidden={!aiPlay && !humanPlay}>
        <div className={[styles.slotPlayed, styles.slotTop].join(' ')}>
          {aiPlay ? (
            <PlayingCard card={aiPlay} size="md" flip />
          ) : (
            <span className={styles.playGhost} />
          )}
        </div>
        <div className={[styles.slotPlayed, styles.slotBottom].join(' ')}>
          {humanPlay ? (
            <span className={styles.dropped}><PlayingCard card={humanPlay} size="md" /></span>
          ) : (
            <span className={styles.playGhost} />
          )}
        </div>
      </div>

      {/* ── Superficie de la mesa: logo + mazo/muestra (a la izq. del mano) ── */}
      <div className={styles.playArea}>
        <div className={styles.logo} aria-hidden="true">
          <SunLogo />
          <span className={styles.logoTitle}>TRUCO</span>
          <span className={styles.logoSub}>URUGUAYO</span>
        </div>

        {/* Mazo + muestra, a la izquierda del que es mano (arriba si es el
            rival, abajo si sos vos). Sin recuadro. */}
        <div
          className={[
            styles.deckArea,
            manoIsHuman ? styles.deckRightBottom : styles.deckLeftTop,
          ].join(' ')}
        >
          <DeckPile state={state} />
        </div>
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
  revealCards,
  waiting = false,
  peekable = false,
  onPeek,
}: {
  name: string;
  team: string;
  remaining: number;
  spot: Spot;
  thinking: boolean;
  revealCards?: Card[];
  /** En pico a pico: el jugador no está al pico (espera su turno). */
  waiting?: boolean;
  /** Es un compañero cuyas cartas se pueden ver con tap/click. */
  peekable?: boolean;
  onPeek?: () => void;
}) {
  const vertical = spot === 'left' || spot === 'right';
  const cardsClickable = peekable && !revealCards && remaining > 0;
  return (
    <div
      className={[styles.seat, styles[`seat_${spot}`], waiting ? styles.waiting : ''].join(' ')}
    >
      <div className={styles.seatInfo}>
        <Avatar name={name} size={30} online />
        <div className={styles.seatText}>
          <span className={styles.seatName}>{name}</span>
          <span className={styles.seatTeam}>
            Equipo {team}
            {thinking && <em className={styles.think}> · pensando…</em>}
            {waiting && <em className={styles.think}> · espera</em>}
            {cardsClickable && <em className={styles.think}> · ver</em>}
          </span>
        </div>
      </div>
      <div
        className={[
          styles.seatCards,
          vertical ? styles.seatCardsV : '',
          cardsClickable ? styles.peekable : '',
        ].join(' ')}
        onClick={cardsClickable ? onPeek : undefined}
        role={cardsClickable ? 'button' : undefined}
        aria-label={cardsClickable ? `Ver cartas de ${name}` : undefined}
      >
        {revealCards
          ? revealCards.map((card, i) => (
              <PlayingCard key={i} card={card} size="sm" flip />
            ))
          : Array.from({ length: remaining }).map((_, i) => (
              <PlayingCard key={i} faceDown size="sm" />
            ))}
      </div>
    </div>
  );
}

function TableMulti({
  state,
  humanSeat,
  thinking,
  reveal,
  onPeekSeat,
  canPeekSeat,
}: TableCenterProps) {
  const trick = displayedTrick(state);
  const views = seatViews(state.players, humanSeat);
  const bySeat = new Map(views.map((v) => [v.seat, v]));
  // El mazo lo tiene el REPARTIDOR, que se sienta a la DERECHA del mano
  // (mano = repartidor + 1). Por eso se ancla siempre a dealerSeat: queda a la
  // derecha del mano, y en el Pico a Pico permanece FIJO durante los tres
  // duelos (el repartidor de la ronda no cambia).
  const manoSpot = bySeat.get(state.dealerSeat)?.spot ?? 'bottom';
  // Pico a pico: si el humano NO está en el duelo actual, las cartas JUGADAS
  // sí se ven (todos las ven); lo único que NO puede ver hasta terminar la
  // vuelta es la MUESTRA del duelo ajeno.
  const humanSpectating =
    !!state.picoRound && state.players[humanSeat].folded && !state.hand.finished;

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
                remaining={p.handCount ?? p.hand.length}
                spot={v.spot}
                thinking={thinking && isActor}
                revealCards={reveal?.find((r) => r.seat === v.seat)?.cards}
                waiting={state.picoAPico === true && p.folded && !state.hand.finished}
                peekable={canPeekSeat?.(v.seat) ?? false}
                onPeek={() => onPeekSeat?.(v.seat)}
              />
            );
          })}
        {/* Mazo + muestra (fijo en pico). La vira siempre visible. */}
        <ManoDeck state={state} manoSpot={manoSpot} />
      </div>

      {/* Cartas jugadas: cada una ENFRENTE del jugador que la jugó (anillo
          alrededor del centro; el medio queda limpio). */}
      <div className={styles.playedMulti} aria-label="Cartas jugadas">
        {(trick?.plays ?? []).map((play) => {
          const v = bySeat.get(play.seat);
          const spot = v?.spot ?? 'bottom';
          return (
            <span
              key={play.seat}
              className={[styles.playedCardMulti, styles[`playedAt_${spot}`]].join(' ')}
            >
              {/* Se ven todas las cartas jugadas, MENOS las piezas de la muestra
                  (2/4/5/11/10 del palo, o el 12 que las reemplaza): a quien no
                  está en el duelo se le ocultan hasta terminar la vuelta. */}
              {humanSpectating && isPieza(play.card, state.hand.muestra) ? (
                <PlayingCard faceDown size="md" />
              ) : (
                <PlayingCard card={play.card} size="md" flip={!v?.isHuman} />
              )}
            </span>
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
        </div>
      </div>
    </>
  );
}

export function TableCenter(props: TableCenterProps) {
  const bubbles = props.bubbles ?? [];
  return (
    <>
      {props.state.players.length > 2 ? (
        <TableMulti {...props} />
      ) : (
        <Table1v1 {...props} />
      )}
      <SeatBubbles state={props.state} humanSeat={props.humanSeat} bubbles={bubbles} />
    </>
  );
}
