/* =============================================================
 * Marcador tradicional de fósforos.
 * -------------------------------------------------------------
 * Cada 5 puntos forman un "cuadro": 4 lados + 1 diagonal.
 * Se anotan hasta 20 (una tabla) — malas o buenas.
 * ============================================================= */
import styles from './Fosforos.module.css';

interface FosforosProps {
  /** Puntos de la mitad actual (0..max). */
  points: number;
  color?: string;
  /** Cantidad de cuadros a dibujar (cada uno = 5 puntos). Por defecto 4 (=20). */
  boxes?: number;
}

// Trazos de un cuadro (caja 24×24), en el orden en que se anotan.
const STROKES: [number, number, number, number][] = [
  [3, 3, 3, 21], // 1 · lado izquierdo
  [3, 3, 21, 3], // 2 · lado superior
  [21, 3, 21, 21], // 3 · lado derecho
  [3, 21, 21, 21], // 4 · lado inferior
  [3, 21, 21, 3], // 5 · diagonal
];

function Cuadro({ strokes, color }: { strokes: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className={styles.cuadro} aria-hidden="true">
      {/* Guía tenue del cuadro (la "pizarra" vacía). */}
      {STROKES.map(([x1, y1, x2, y2], i) => (
        <line
          key={`g${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={1.4}
          opacity={0.16}
        />
      ))}
      {/* Fósforos anotados. */}
      {STROKES.slice(0, strokes).map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function Fosforos({
  points,
  color = 'var(--c-gold-soft)',
  boxes = 4,
}: FosforosProps) {
  const n = Math.max(1, boxes);
  const p = Math.max(0, Math.min(n * 5, points));
  return (
    <span className={styles.row} role="img" aria-label={`${p} puntos`}>
      {Array.from({ length: n }, (_, i) => {
        const strokes = Math.max(0, Math.min(5, p - i * 5));
        return <Cuadro key={i} strokes={strokes} color={color} />;
      })}
    </span>
  );
}
