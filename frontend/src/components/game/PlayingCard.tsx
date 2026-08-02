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

/** Colores de tinta de cada palo (sobre carta marfil). El índice de esquina
 *  usa `main`; el dibujo del palo tiene su propia paleta más rica abajo. */
const INK: Record<Suit, { main: string; dark: string; soft: string }> = {
  oro: { main: '#c8912a', dark: '#8a5e17', soft: '#e8c565' },
  copa: { main: '#b23b3f', dark: '#7d2529', soft: '#d98a8d' },
  espada: { main: '#3f6d99', dark: '#274c70', soft: '#9db9d4' },
  basto: { main: '#7a5a2e', dark: '#4f3a1c', soft: '#c2a066' },
};

const VIEW_W = 240;
const VIEW_H = 384;

/** Palos que en la baraja española se cruzan en diagonal (espadas/bastos). */
const CROSSED: Record<Suit, boolean> = {
  oro: false,
  copa: false,
  espada: true,
  basto: true,
};

/** Símbolo del palo dibujado en un lienzo local 0..40 (centro 20,20).
 *  Estilo baraja española: oro con roseta floral, copa dorada, espada de
 *  acero y basto de madera (referencia clásica). */
function SuitSymbol({ suit }: { suit: Suit }) {
  switch (suit) {
    case 'oro':
      return (
        <g>
          <circle cx={20} cy={20} r={16} fill="#e9c257" stroke="#7d5410" strokeWidth={2} />
          <circle cx={20} cy={20} r={15.5} fill="none" stroke="#f6e39a" strokeWidth={1} />
          <circle cx={20} cy={20} r={11} fill="none" stroke="#8a5e17" strokeWidth={1.2} />
          {/* Roseta floral de 8 pétalos */}
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <ellipse
                key={i}
                cx={20 + Math.cos(a) * 5.5}
                cy={20 + Math.sin(a) * 5.5}
                rx={2.6}
                ry={1.5}
                fill="#b9871f"
                transform={`rotate(${(a * 180) / Math.PI} ${20 + Math.cos(a) * 5.5} ${20 + Math.sin(a) * 5.5})`}
              />
            );
          })}
          <circle cx={20} cy={20} r={3} fill="#8a5e17" />
        </g>
      );
    case 'copa':
      return (
        <g stroke="#7d2529" strokeWidth={1.4} strokeLinejoin="round">
          {/* Copa (cáliz) dorado con interior rojo */}
          <path d="M7 8 Q20 5 33 8 Q31 20 20 25 Q9 20 7 8 Z" fill="#e6bd52" />
          <path d="M10 10 Q20 8 30 10 Q28 18 20 22 Q12 18 10 10 Z" fill="#b23b3f" stroke="none" />
          <rect x={18} y={24} width={4} height={6} fill="#e6bd52" stroke="none" />
          <circle cx={20} cy={30} r={2.2} fill="#e6bd52" />
          <path d="M11 35 Q20 30 29 35 L29 37 L11 37 Z" fill="#e6bd52" />
        </g>
      );
    case 'espada':
      return (
        <g strokeLinejoin="round">
          {/* Hoja de acero alargada apuntando arriba */}
          <path d="M20 3 L21.6 27 L18.4 27 Z" fill="#d5deea" stroke="#5b6b7d" strokeWidth={1.1} />
          <line x1={20} y1={5} x2={20} y2={26} stroke="#9fb0c4" strokeWidth={0.8} />
          {/* Guarda dorada */}
          <rect x={10} y={26} width={20} height={3.2} rx={1.4} fill="#c79a3c" stroke="#7d5410" strokeWidth={0.9} />
          {/* Empuñadura y pomo */}
          <rect x={18.4} y={29} width={3.2} height={6} fill="#6b7684" />
          <circle cx={20} cy={36} r={2.4} fill="#c79a3c" stroke="#7d5410" strokeWidth={0.9} />
        </g>
      );
    case 'basto':
      return (
        <g strokeLinejoin="round">
          {/* Garrote de madera nudoso */}
          <path
            d="M15 37 Q12 21 15.5 7 Q20 2.5 24.5 7 Q28 21 25 37 Q20 40 15 37 Z"
            fill="#8a6329"
            stroke="#4f3a1c"
            strokeWidth={1.5}
          />
          <path d="M17 34 Q20 30 23 34" fill="none" stroke="#c2a066" strokeWidth={1} opacity={0.7} />
          <circle cx={18} cy={13} r={1.6} fill="#4f3a1c" />
          <circle cx={22.5} cy={22} r={1.6} fill="#4f3a1c" />
          <circle cx={18.5} cy={28} r={1.3} fill="#4f3a1c" />
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

function pipSize(count: number, crossed: boolean): number {
  if (count === 1) return crossed ? 92 : 82;
  if (count <= 3) return crossed ? 70 : 60;
  return crossed ? 60 : 50;
}

function NumberFace({ card }: { card: Card }) {
  const layout = PIP_LAYOUT[card.rank] ?? [];
  const crossed = CROSSED[card.suit];
  const s = pipSize(card.rank, crossed);
  return (
    <g>
      {layout.map(([nx, ny], i) => {
        const cx = PIP_REGION.x + nx * PIP_REGION.w;
        const cy = PIP_REGION.y + ny * PIP_REGION.h;
        // Espadas/bastos: la columna izquierda se inclina a la derecha y la
        // derecha a la izquierda, para que se crucen hacia el centro como en
        // la baraja española. Oros/copas quedan derechos.
        const angle = crossed ? (nx < 0.5 ? 24 : nx > 0.5 ? -24 : 0) : 0;
        return (
          <g key={i} transform={angle ? `rotate(${angle} ${cx} ${cy})` : undefined}>
            <svg x={cx - s / 2} y={cy - s / 2} width={s} height={s} viewBox="0 0 40 40">
              <SuitSymbol suit={card.suit} />
            </svg>
          </g>
        );
      })}
    </g>
  );
}

/** Figuras (Sota/Caballo/Rey) como figura de cuerpo con túnica, tocado
 *  distintivo y el emblema del palo en la mano. */
function FigureFace({ card }: { card: Card }) {
  const ink = INK[card.suit];
  const name = card.rank === 10 ? 'SOTA' : card.rank === 11 ? 'CABALLO' : 'REY';
  const skin = '#e9cba6';
  return (
    <g>
      {/* Marco del retrato */}
      <rect x={58} y={92} width={124} height={200} rx={10} fill="#f3ead0" stroke={ink.main} strokeWidth={2} />
      <rect x={64} y={98} width={112} height={188} rx={7} fill="none" stroke={ink.soft} strokeWidth={1} />

      {/* Túnica */}
      <path d="M84 288 Q84 208 120 200 Q156 208 156 288 Z" fill={ink.main} stroke={ink.dark} strokeWidth={2} />
      <path d="M120 200 L120 288" stroke={ink.dark} strokeWidth={1.2} opacity={0.5} />
      {/* Cuello / hombros */}
      <path d="M104 206 Q120 214 136 206 L132 220 Q120 226 108 220 Z" fill={ink.soft} stroke={ink.dark} strokeWidth={1} />

      {/* Caballo: silueta a un lado (11) */}
      {card.rank === 11 && (
        <path
          d="M150 250 Q168 244 168 262 Q168 280 152 284 L150 270 Q158 266 156 260 Q152 256 150 262 Z"
          fill={ink.dark}
          opacity={0.85}
        />
      )}

      {/* Cabeza */}
      <circle cx={120} cy={176} r={20} fill={skin} stroke={ink.dark} strokeWidth={1.4} />
      <circle cx={113} cy={174} r={1.8} fill={ink.dark} />
      <circle cx={127} cy={174} r={1.8} fill={ink.dark} />
      <path d="M114 184 Q120 188 126 184" fill="none" stroke={ink.dark} strokeWidth={1.4} strokeLinecap="round" />

      {/* Tocado distintivo por figura */}
      {card.rank === 12 && (
        // Corona (Rey)
        <g fill="#e6bd52" stroke="#7d5410" strokeWidth={1.6} strokeLinejoin="round">
          <path d="M100 160 L106 136 L114 152 L120 130 L126 152 L134 136 L140 160 Z" />
          <rect x={100} y={158} width={40} height={9} rx={2} />
          <circle cx={120} cy={132} r={2.6} fill="#b23b3f" stroke="#7d5410" strokeWidth={1} />
        </g>
      )}
      {card.rank === 11 && (
        // Yelmo con penacho (Caballero)
        <g strokeLinejoin="round">
          <path d="M100 162 Q120 140 140 162 Q120 156 100 162 Z" fill={ink.soft} stroke={ink.dark} strokeWidth={1.6} />
          <path d="M122 142 Q136 132 132 112 Q124 130 118 140 Z" fill={ink.main} stroke={ink.dark} strokeWidth={1.2} />
        </g>
      )}
      {card.rank === 10 && (
        // Gorro de paje (Sota)
        <g fill={ink.soft} stroke={ink.dark} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M100 164 Q120 142 140 164 Q120 158 100 164 Z" />
          <circle cx={140} cy={150} r={3} fill={ink.main} />
        </g>
      )}

      {/* Emblema del palo en la mano */}
      <svg x={132} y={228} width={34} height={34} viewBox="0 0 40 40">
        <SuitSymbol suit={card.suit} />
      </svg>

      <rect x={68} y={267} width={104} height={17} rx={4} fill="#f3ead0" opacity={0.9} />
      <text
        x={120}
        y={279}
        textAnchor="middle"
        textLength={name.length > 5 ? 88 : undefined}
        lengthAdjust="spacingAndGlyphs"
        fontSize={11}
        fontWeight={700}
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

const GOLD = '#d4af37';
const RED_BACK = '#b03020';
const RED_BACK_DEEP = '#7d2016';

function CardBack() {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg} aria-hidden="true">
      <defs>
        <pattern id="backLattice" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="20" height="20" fill="none" />
          <path d="M0 10 H20 M10 0 V20" stroke="rgba(212,175,55,0.22)" strokeWidth="1.2" />
          <circle cx="10" cy="10" r="1.4" fill="rgba(212,175,55,0.3)" />
        </pattern>
        <radialGradient id="backGlow" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor={RED_BACK} />
          <stop offset="100%" stopColor={RED_BACK_DEEP} />
        </radialGradient>
      </defs>
      <rect x={2} y={2} width={VIEW_W - 4} height={VIEW_H - 4} rx={14} fill="url(#backGlow)" />
      <rect x={2} y={2} width={VIEW_W - 4} height={VIEW_H - 4} rx={14} fill="url(#backLattice)" />
      <rect x={12} y={12} width={VIEW_W - 24} height={VIEW_H - 24} rx={9} fill="none" stroke={GOLD} strokeWidth={2.4} />
      <rect x={18} y={18} width={VIEW_W - 36} height={VIEW_H - 36} rx={7} fill="none" stroke="rgba(212,175,55,0.55)" strokeWidth={1} />
      {/* Medallón central dorado */}
      <g transform={`translate(${VIEW_W / 2} ${VIEW_H / 2})`}>
        <circle r={46} fill={RED_BACK_DEEP} stroke={GOLD} strokeWidth={2.4} />
        <circle r={34} fill="none" stroke="rgba(212,175,55,0.6)" strokeWidth={1.2} />
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 34}
              y1={Math.sin(a) * 34}
              x2={Math.cos(a) * 46}
              y2={Math.sin(a) * 46}
              stroke={GOLD}
              strokeWidth={1.2}
            />
          );
        })}
        {/* Rosetón */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <path
              key={i}
              d="M0 -22 Q6 -8 0 0 Q-6 -8 0 -22 Z"
              fill={GOLD}
              opacity={0.85}
              transform={`rotate(${(a * 180) / Math.PI})`}
            />
          );
        })}
        <circle r={7} fill={GOLD} />
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

        {/* Índices en esquinas (arriba-izq y abajo-der rotado), como la baraja
            española tradicional de la referencia. */}
        <CornerIndex card={card} x={34} y={44} />
        <g transform={`rotate(180 ${VIEW_W / 2} ${VIEW_H / 2})`}>
          <CornerIndex card={card} x={34} y={44} />
        </g>

        {/* Composición central */}
        {isFigure ? <FigureFace card={card} /> : <NumberFace card={card} />}
      </svg>
    </Tag>
  );
}
