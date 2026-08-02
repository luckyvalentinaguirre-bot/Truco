/* =============================================================
 * Carta de baraja española (SVG vectorial propio).
 * -------------------------------------------------------------
 * Toda la carta se dibuja dentro de un único <svg> con viewBox
 * fijo (240×384): escala con el contenedor y NUNCA se recorta.
 * Sin imágenes externas. Palos: oros, copas, espadas, bastos.
 * Figuras: 10 Sota, 11 Caballo, 12 Rey.
 *
 * La UI NO decide reglas: sólo dibuja. La condición de "pieza"
 * (halo) la determina el motor y se pasa por props.
 * ============================================================= */
import type { Card, Suit } from '@/game';
import styles from './PlayingCard.module.css';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  /** La carta es pieza (según el motor) → halo dorado sutil. */
  pieza?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_NAME: Record<Suit, string> = {
  oro: 'Oros',
  copa: 'Copas',
  espada: 'Espadas',
  basto: 'Bastos',
};

/** Colores de tinta de cada palo (sobre carta marfil). */
const INK: Record<Suit, { main: string; dark: string; soft: string }> = {
  oro: { main: '#c8912a', dark: '#8a5e17', soft: '#e8c565' },
  copa: { main: '#b23b3f', dark: '#7d2529', soft: '#d98a8d' },
  espada: { main: '#3f6d99', dark: '#274c70', soft: '#9db9d4' },
  basto: { main: '#7a5a2e', dark: '#4f3a1c', soft: '#c2a066' },
};

const VIEW_W = 240;
const VIEW_H = 384;

/** Símbolo del palo dibujado en un lienzo local 0..40 (centro 20,20). */
function SuitSymbol({ suit }: { suit: Suit }) {
  const ink = INK[suit];
  switch (suit) {
    case 'oro':
      return (
        <g>
          <circle cx={20} cy={20} r={16} fill={ink.soft} stroke={ink.dark} strokeWidth={2} />
          <circle cx={20} cy={20} r={10.5} fill="none" stroke={ink.dark} strokeWidth={1.4} />
          <circle cx={20} cy={20} r={2.6} fill={ink.dark} />
          <circle cx={20} cy={8.5} r={1.3} fill={ink.dark} />
          <circle cx={20} cy={31.5} r={1.3} fill={ink.dark} />
          <circle cx={8.5} cy={20} r={1.3} fill={ink.dark} />
          <circle cx={31.5} cy={20} r={1.3} fill={ink.dark} />
        </g>
      );
    case 'copa':
      return (
        <g fill={ink.main} stroke={ink.dark} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M7 9 Q20 5 33 9 Q31 19 20 24 Q9 19 7 9 Z" />
          <rect x={18} y={23} width={4} height={7} stroke="none" />
          <path d="M11 33 Q20 28 29 33 L29 35 L11 35 Z" />
        </g>
      );
    case 'espada':
      return (
        <g strokeLinejoin="round">
          <path d="M20 4 L23.5 23 L16.5 23 Z" fill={ink.soft} stroke={ink.dark} strokeWidth={1.4} />
          <rect x={9} y={22.5} width={22} height={3.4} rx={1.4} fill={ink.main} />
          <rect x={17.8} y={25} width={4.4} height={7} fill={ink.main} />
          <circle cx={20} cy={33} r={2.8} fill={ink.main} stroke={ink.dark} strokeWidth={1} />
        </g>
      );
    case 'basto':
      return (
        <g fill={ink.main} stroke={ink.dark} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M15 33 Q12.5 18 16.5 7 Q20 3.5 23.5 7 Q27.5 18 25 33 Q20 36.5 15 33 Z" />
          <circle cx={18.5} cy={13} r={1.5} stroke="none" fill={ink.dark} />
          <circle cx={22} cy={22} r={1.5} stroke="none" fill={ink.dark} />
        </g>
      );
  }
}

/** Posiciones (0..1) de los símbolos para cada valor numérico. */
const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.5, 0.26], [0.5, 0.74]],
  3: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]],
  4: [[0.3, 0.26], [0.7, 0.26], [0.3, 0.74], [0.7, 0.74]],
  5: [[0.3, 0.24], [0.7, 0.24], [0.5, 0.5], [0.3, 0.76], [0.7, 0.76]],
  6: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
  7: [[0.3, 0.18], [0.7, 0.18], [0.3, 0.44], [0.7, 0.44], [0.5, 0.5], [0.3, 0.82], [0.7, 0.82]],
};

const PIP_REGION = { x: 60, y: 92, w: 120, h: 208 };

function pipSize(count: number): number {
  if (count === 1) return 78;
  if (count <= 3) return 58;
  return 48;
}

function NumberFace({ card }: { card: Card }) {
  const layout = PIP_LAYOUT[card.rank] ?? [];
  const s = pipSize(card.rank);
  return (
    <g>
      {layout.map(([nx, ny], i) => {
        const cx = PIP_REGION.x + nx * PIP_REGION.w;
        const cy = PIP_REGION.y + ny * PIP_REGION.h;
        return (
          <svg
            key={i}
            x={cx - s / 2}
            y={cy - s / 2}
            width={s}
            height={s}
            viewBox="0 0 40 40"
          >
            <SuitSymbol suit={card.suit} />
          </svg>
        );
      })}
    </g>
  );
}

/** Figuras (Sota/Caballo/Rey) como retrato-busto con emblema distintivo. */
function FigureFace({ card }: { card: Card }) {
  const ink = INK[card.suit];
  const name = card.rank === 10 ? 'SOTA' : card.rank === 11 ? 'CABALLO' : 'REY';
  return (
    <g>
      {/* Panel del retrato */}
      <rect
        x={64}
        y={96}
        width={112}
        height={168}
        rx={10}
        fill="#efe4c8"
        stroke={ink.main}
        strokeWidth={2}
      />
      {/* Busto (silueta) */}
      <path
        d="M92 250 q0 -44 28 -44 q28 0 28 44 Z"
        fill={ink.main}
      />
      <circle cx={120} cy={168} r={22} fill={ink.main} />

      {/* Emblema distintivo por figura */}
      {card.rank === 12 && (
        // Corona (Rey)
        <g fill={ink.soft} stroke={ink.dark} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M98 150 L104 128 L112 142 L120 122 L128 142 L136 128 L142 150 Z" />
          <rect x={98} y={150} width={44} height={9} rx={2} />
        </g>
      )}
      {card.rank === 11 && (
        // Yelmo con penacho (Caballo/Caballero)
        <g fill={ink.soft} stroke={ink.dark} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M100 150 q20 -20 40 0 q-4 6 -20 6 q-16 0 -20 -6 Z" />
          <path d="M120 130 q10 -14 4 -26 q-2 12 -8 20 Z" stroke="none" fill={ink.main} />
        </g>
      )}
      {card.rank === 10 && (
        // Toca/gorro simple (Sota/paje)
        <g fill={ink.soft} stroke={ink.dark} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M102 152 q18 -16 36 0 q-6 4 -18 4 q-12 0 -18 -4 Z" />
        </g>
      )}

      {/* Símbolo del palo */}
      <svg x={104} y={210} width={32} height={32} viewBox="0 0 40 40">
        <SuitSymbol suit={card.suit} />
      </svg>

      <text
        x={120}
        y={258}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        letterSpacing={1.5}
        fill={ink.dark}
        fontFamily="Georgia, serif"
      >
        {name}
      </text>
    </g>
  );
}

function CornerIndex({ card, x, y }: { card: Card; x: number; y: number }) {
  const ink = INK[card.suit];
  const twoDigit = card.rank >= 10;
  return (
    <g>
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontSize={twoDigit ? 30 : 36}
        fontWeight={700}
        fill={ink.main}
        fontFamily="Georgia, serif"
      >
        {card.rank}
      </text>
      <svg x={x - 11} y={y + 4} width={22} height={22} viewBox="0 0 40 40">
        <SuitSymbol suit={card.suit} />
      </svg>
    </g>
  );
}

function CardBack() {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg} aria-hidden="true">
      <defs>
        <pattern id="lattice" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 H22 M0 11 H22" stroke="rgba(217,177,104,0.28)" strokeWidth="1.4" />
        </pattern>
      </defs>
      <rect x={2} y={2} width={VIEW_W - 4} height={VIEW_H - 4} rx={16} fill="#123a2b" />
      <rect x={2} y={2} width={VIEW_W - 4} height={VIEW_H - 4} rx={16} fill="url(#lattice)" />
      <rect x={14} y={14} width={VIEW_W - 28} height={VIEW_H - 28} rx={10} fill="none" stroke="#d9b168" strokeWidth={2} />
      <rect x={20} y={20} width={VIEW_W - 40} height={VIEW_H - 40} rx={8} fill="none" stroke="rgba(217,177,104,0.5)" strokeWidth={1} />
      {/* Medallón central */}
      <g transform={`translate(${VIEW_W / 2} ${VIEW_H / 2})`}>
        <circle r={44} fill="none" stroke="#d9b168" strokeWidth={2} />
        <circle r={30} fill="#0e2f22" stroke="#d9b168" strokeWidth={1.4} />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 32}
              y1={Math.sin(a) * 32}
              x2={Math.cos(a) * 42}
              y2={Math.sin(a) * 42}
              stroke="#d9b168"
              strokeWidth={1.4}
            />
          );
        })}
        <circle r={9} fill="#d9b168" />
      </g>
    </svg>
  );
}

export function PlayingCard({
  card,
  faceDown = false,
  selected = false,
  pieza = false,
  onClick,
  size = 'md',
}: PlayingCardProps) {
  const interactive = Boolean(onClick);
  const Tag = interactive ? 'button' : 'div';

  const wrapCls = [
    styles.card,
    styles[size],
    selected ? styles.selected : '',
    pieza ? styles.pieza : '',
    interactive ? styles.interactive : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (faceDown || !card) {
    return (
      <div className={[wrapCls, styles.backWrap].join(' ')} aria-hidden="true">
        <CardBack />
      </div>
    );
  }

  const ink = INK[card.suit];
  const isFigure = card.rank >= 10;

  return (
    <Tag
      className={wrapCls}
      onClick={onClick}
      aria-label={`${card.rank} de ${SUIT_NAME[card.suit]}`}
      type={interactive ? 'button' : undefined}
    >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg}>
        {/* Fondo marfil + bordes */}
        <rect x={2} y={2} width={VIEW_W - 4} height={VIEW_H - 4} rx={14} fill="#f6efdd" stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} />
        <rect x={12} y={12} width={VIEW_W - 24} height={VIEW_H - 24} rx={9} fill="none" stroke={ink.main} strokeWidth={1.6} opacity={0.75} />
        <rect x={17} y={17} width={VIEW_W - 34} height={VIEW_H - 34} rx={7} fill="none" stroke={ink.soft} strokeWidth={1} opacity={0.7} />

        {/* Índice — al estilo español, sólo arriba (evita confundir 6 y 9).
            Se duplica arriba-derecha para leerlo con las cartas en abanico. */}
        <CornerIndex card={card} x={34} y={44} />
        <CornerIndex card={card} x={VIEW_W - 34} y={44} />
        {/* Filete inferior decorativo con el palo, sin número. */}
        <svg x={VIEW_W / 2 - 13} y={VIEW_H - 40} width={26} height={26} viewBox="0 0 40 40" opacity={0.9}>
          <SuitSymbol suit={card.suit} />
        </svg>

        {/* Composición central */}
        {isFigure ? <FigureFace card={card} /> : <NumberFace card={card} />}
      </svg>
    </Tag>
  );
}
