/* =============================================================
 * Herramienta de desarrollo: editor VISUAL de la posición del mazo.
 * -------------------------------------------------------------
 * Sólo en dev (import.meta.env.DEV). Arrastrá el mazo (mouse o touch) sobre la
 * mesa de referencia con los asientos marcados; el panel muestra top/left en %
 * y genera el CSS listo para pegar en TableCenter.module.css (.deckMano_*).
 * No toca el juego real: es puramente para calibrar posiciones sin escribir a
 * mano. El mazo real se ancla al repartidor (dealerSeat) — acá sólo calibrás
 * DÓNDE cae cada posición.
 * ============================================================= */
import { useRef, useState, type PointerEvent } from 'react';

/** Los 8 lugares de la mesa (coinciden con .deckMano_* y seat_*). */
type Spot =
  | 'bottom' | 'top' | 'left' | 'right'
  | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/** Valores ACTUALES en TableCenter.module.css (para arrancar desde ahí). */
const START: Record<Spot, { top: number; left: number }> = {
  bottom: { top: 84, left: 76 }, // bottom:16% right:24%  → top≈84, left≈76
  top: { top: 13, left: 50 },
  topLeft: { top: 15, left: 14 },
  topRight: { top: 15, left: 86 }, // right:14% → left≈86
  left: { top: 40, left: 13 },
  right: { top: 40, left: 87 }, // right:13% → left≈87
  bottomLeft: { top: 52, left: 14 },
  bottomRight: { top: 52, left: 86 }, // right:14% → left≈86
};

/** Posición de referencia de cada asiento (coincide con .seat_*). */
const SEATS: { spot: Spot | 'human'; top: number; left: number; label: string }[] = [
  { spot: 'human', top: 92, left: 50, label: 'VOS (abajo)' },
  { spot: 'top', top: 3, left: 50, label: 'arriba' },
  { spot: 'topLeft', top: 6, left: 6, label: 'arriba-izq' },
  { spot: 'topRight', top: 6, left: 94, label: 'arriba-der' },
  { spot: 'left', top: 40, left: 3, label: 'izquierda' },
  { spot: 'right', top: 40, left: 97, label: 'derecha' },
  { spot: 'bottomLeft', top: 58, left: 5, label: 'abajo-izq' },
  { spot: 'bottomRight', top: 58, left: 95, label: 'abajo-der' },
];

const SPOTS: Spot[] = [
  'bottom', 'top', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight',
];

const round1 = (x: number) => Math.round(x * 10) / 10;

export function DeckLabPage() {
  const [pos, setPos] = useState<Record<Spot, { top: number; left: number }>>(START);
  const [active, setActive] = useState<Spot>('bottom');
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (e: PointerEvent) => {
    if (!dragging.current || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const left = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const top = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    setPos((p) => ({ ...p, [active]: { top: round1(top), left: round1(left) } }));
  };

  const cur = pos[active];

  /** Genera la línea CSS para un lugar (usa right cuando está en la mitad derecha). */
  const cssLine = (spot: Spot) => {
    const { top, left } = pos[spot];
    const horiz = left > 50 ? `right: ${round1(100 - left)}%;` : `left: ${round1(left)}%;`;
    const vert = top > 50 ? `bottom: ${round1(100 - top)}%;` : `top: ${round1(top)}%;`;
    return `.deckMano_${spot} { ${vert} ${horiz} }`;
  };

  const allCss = SPOTS.map(cssLine).join('\n');

  return (
    <div style={{ padding: 16, color: '#eee', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Editor del mazo (dev)</h2>
        <p style={{ margin: '0 0 10px', maxWidth: 520, color: '#bbb', fontSize: 14 }}>
          Elegí un lugar, arrastrá el 🃏 con el mouse o el dedo hasta dejarlo al
          lado del jugador. Los puntos grises son los asientos de referencia.
        </p>

        {/* Mesa de referencia (misma proporción que la mesa real ~16:10) */}
        <div
          ref={boxRef}
          onPointerMove={move}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={() => (dragging.current = false)}
          style={{
            position: 'relative',
            width: 'min(90vw, 760px)',
            aspectRatio: '16 / 10',
            background: 'radial-gradient(120% 120% at 50% 40%, #14503c, #0a2a20)',
            border: '10px solid #3a2a1a',
            borderRadius: 24,
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {/* Asientos de referencia */}
          {SEATS.map((s) => (
            <div
              key={s.spot}
              style={{
                position: 'absolute',
                top: `${s.top}%`,
                left: `${s.left}%`,
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                fontSize: 11,
                color: '#cbd5c0',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: 34, height: 22, margin: '0 auto 2px',
                  border: '1px dashed #9db', borderRadius: 4, opacity: 0.7,
                }}
              />
              {s.label}
            </div>
          ))}

          {/* Mazo arrastrable (posición del lugar activo) */}
          <div
            onPointerDown={(e) => {
              dragging.current = true;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            style={{
              position: 'absolute',
              top: `${cur.top}%`,
              left: `${cur.left}%`,
              transform: 'translate(-50%, -50%)',
              width: 40, height: 58,
              background: '#b03020',
              border: '2px solid #e8cf7a',
              borderRadius: 6,
              display: 'grid', placeItems: 'center',
              cursor: 'grab', fontSize: 22,
              boxShadow: '0 4px 14px rgba(0,0,0,.5)',
            }}
            title="Arrastrame"
          >
            🃏
          </div>
        </div>
      </div>

      {/* Panel de control */}
      <div style={{ minWidth: 300, flex: 1 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>
          Lugar a mover:
        </label>
        <select
          value={active}
          onChange={(e) => setActive(e.target.value as Spot)}
          style={{ padding: 6, marginBottom: 12, width: '100%', fontSize: 14 }}
        >
          {SPOTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div style={{ marginBottom: 12, fontFamily: 'monospace', fontSize: 14 }}>
          <div>Lugar activo: <b>{active}</b></div>
          <div>top: {cur.top}% · left: {cur.left}%</div>
          <div style={{ color: '#e8cf7a', marginTop: 4 }}>{cssLine(active)}</div>
        </div>

        <button
          onClick={() => navigator.clipboard?.writeText(allCss)}
          style={{ padding: '8px 14px', marginBottom: 10, cursor: 'pointer' }}
        >
          Copiar TODO el CSS
        </button>

        <p style={{ fontSize: 13, color: '#bbb', margin: '0 0 6px' }}>
          Pegá esto en <code>TableCenter.module.css</code> (reemplazá las
          <code> .deckMano_*</code>):
        </p>
        <textarea
          readOnly
          value={allCss}
          style={{
            width: '100%', height: 200, fontFamily: 'monospace', fontSize: 12,
            background: '#111', color: '#dfe', padding: 8, borderRadius: 6,
          }}
        />
      </div>
    </div>
  );
}
