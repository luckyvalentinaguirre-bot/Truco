/* =============================================================
 * Carta española visual. Consume el motor solo para etiquetas.
 * Touch-first: objetivo mínimo cómodo, sin depender de hover.
 * ============================================================= */
import type { Card, Suit } from '@/game';
import styles from './PlayingCard.module.css';

interface PlayingCardProps {
  card?: Card;
  /** Carta boca abajo. */
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_GLYPH: Record<Suit, string> = {
  oro: '●',
  copa: '❤',
  espada: '⚔',
  basto: '♣',
};

const SUIT_VAR: Record<Suit, string> = {
  oro: 'var(--c-suit-oro)',
  copa: 'var(--c-suit-copa)',
  espada: 'var(--c-suit-espada)',
  basto: 'var(--c-suit-basto)',
};

const SUIT_NAME: Record<Suit, string> = {
  oro: 'Oros',
  copa: 'Copas',
  espada: 'Espadas',
  basto: 'Bastos',
};

export function PlayingCard({
  card,
  faceDown = false,
  selected = false,
  onClick,
  size = 'md',
}: PlayingCardProps) {
  const interactive = Boolean(onClick);

  if (faceDown || !card) {
    return (
      <div
        className={[styles.card, styles[size], styles.back].join(' ')}
        aria-hidden="true"
      >
        <span className={styles.backMark} />
      </div>
    );
  }

  const color = SUIT_VAR[card.suit];
  const glyph = SUIT_GLYPH[card.suit];
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      className={[
        styles.card,
        styles[size],
        styles.face,
        selected ? styles.selected : '',
        interactive ? styles.interactive : '',
      ].join(' ')}
      style={{ ['--suit' as string]: color }}
      onClick={onClick}
      aria-label={`${card.rank} de ${SUIT_NAME[card.suit]}`}
      type={interactive ? 'button' : undefined}
    >
      <span className={styles.corner + ' ' + styles.tl}>
        <span className={styles.rank}>{card.rank}</span>
        <span className={styles.glyph}>{glyph}</span>
      </span>
      <span className={styles.center}>{glyph}</span>
      <span className={styles.corner + ' ' + styles.br}>
        <span className={styles.rank}>{card.rank}</span>
        <span className={styles.glyph}>{glyph}</span>
      </span>
    </Tag>
  );
}
