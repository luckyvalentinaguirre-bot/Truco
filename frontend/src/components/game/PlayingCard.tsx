/* =============================================================
 * Carta de la baraja española: imagen PNG real (assets definitivos).
 * -------------------------------------------------------------
 * La imagen es SIEMPRE el PNG de `public/cartas_truco/`, resuelto por
 * getCardAsset({suit, rank}). No se redibuja la carta: sólo se le agregan
 * estados de presentación (seleccionada, halo de pieza, volteo) mediante
 * capas EXTERNAS que nunca alteran el artwork.
 *
 * La UI no decide reglas; la condición de "pieza" (halo) la determina el
 * motor y llega por props. Si faltara un asset, se informa cuál (no se
 * sustituye en silencio).
 * ============================================================= */
import { useState } from 'react';
import type { Card, Suit } from '@/game';
import { getCardAsset, getCardBackAsset } from './cardAssets';
import styles from './PlayingCard.module.css';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  /** La carta es pieza (según el motor) → halo dorado sutil. */
  pieza?: boolean;
  /** Anima el volteo reverso → carta real (p. ej. carta que juega la IA). */
  flip?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_NAME: Record<Suit, string> = {
  oro: 'Oros',
  copa: 'Copas',
  espada: 'Espadas',
  basto: 'Bastos',
};

/** Placeholder visible SÓLO si un PNG real no está disponible (dev/errores). */
function MissingAsset({ src }: { src: string }) {
  return (
    <span className={styles.missing} title={`Falta el asset: ${src}`}>
      <span className={styles.missingLabel}>{src.replace('/cartas_truco/', '')}</span>
    </span>
  );
}

export function PlayingCard({
  card,
  faceDown = false,
  selected = false,
  pieza = false,
  flip = false,
  onClick,
  size = 'md',
}: PlayingCardProps) {
  const [broken, setBroken] = useState(false);
  const interactive = Boolean(onClick);
  const Tag = interactive ? 'button' : 'div';

  const showBack = faceDown || !card;
  const backSrc = getCardBackAsset();
  const frontSrc = card ? safeAsset(card) : null;

  const wrapCls = [
    styles.card,
    styles[size],
    selected ? styles.selected : '',
    pieza ? styles.pieza : '',
    interactive ? styles.interactive : '',
    showBack ? styles.backWrap : '',
  ]
    .filter(Boolean)
    .join(' ');

  const alt = showBack
    ? 'Carta boca abajo'
    : card
      ? `${card.rank} de ${SUIT_NAME[card.suit]}`
      : 'Carta';

  // Volteo reverso → carta real (una sola vez, al montar).
  if (flip && !showBack && frontSrc) {
    return (
      <div className={wrapCls} aria-label={alt}>
        <div className={styles.flip}>
          <img className={[styles.face, styles.faceBack].join(' ')} src={backSrc} alt="" aria-hidden="true" draggable={false} />
          {broken ? (
            <span className={[styles.face, styles.faceFront].join(' ')}><MissingAsset src={frontSrc} /></span>
          ) : (
            <img
              className={[styles.face, styles.faceFront].join(' ')}
              src={frontSrc}
              alt={alt}
              draggable={false}
              onError={() => reportMissing(frontSrc, setBroken)}
            />
          )}
        </div>
      </div>
    );
  }

  const src = showBack ? backSrc : frontSrc!;

  return (
    <Tag
      className={wrapCls}
      onClick={onClick}
      aria-label={alt}
      type={interactive ? 'button' : undefined}
    >
      {broken && !showBack ? (
        <MissingAsset src={src} />
      ) : (
        <img
          className={styles.img}
          src={src}
          alt={alt}
          draggable={false}
          onError={() => !showBack && reportMissing(src, setBroken)}
        />
      )}
    </Tag>
  );
}

/** Resuelve el asset sin lanzar en render (una carta inválida no rompe la UI). */
function safeAsset(card: Card): string | null {
  try {
    return getCardAsset(card);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[cartas] carta inválida:', card, err);
    return null;
  }
}

function reportMissing(src: string, setBroken: (b: boolean) => void) {
  // eslint-disable-next-line no-console
  console.error(`[cartas] Falta el asset (revisá el archivo real): ${src}`);
  setBroken(true);
}
