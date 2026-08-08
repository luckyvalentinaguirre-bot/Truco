/* =============================================================
 * Herramienta de desarrollo: editor VISUAL de la posición del mazo, POR MODO.
 * -------------------------------------------------------------
 * Sólo en dev. Elegí el modo (1v1 / 2v2 / 3v3): se muestran esos jugadores en
 * su lugar. Seleccioná a QUÉ jugador ponerle el mazo (dropdown o click en el
 * asiento) y arrastrá el 🃏 (mouse o dedo). El panel genera el CSS listo para
 * pegar en TableCenter.module.css. No toca el juego real: sólo calibra dónde
 * cae el mazo según el repartidor (dealerSeat).
 * ============================================================= */
import { useRef, useState, type PointerEvent } from 'react';

type Mode = '1v1' | '2v2' | '3v3';
interface SeatDef {
  cls: string; // clase CSS que se edita
  label: string; // nombre del jugador/lugar
  ref: { top: number; left: number }; // dónde se dibuja el asiento (referencia)
}

/** Jugadores por modo, en su lugar real, con la clase CSS que le corresponde. */
const MODES: Record<Mode, SeatDef[]> = {
  '1v1': [
    { cls: 'deckRightBottom', label: 'VOS (abajo)', ref: { top: 90, left: 50 } },
    { cls: 'deckLeftTop', label: 'Rival (arriba)', ref: { top: 6, left: 50 } },
  ],
  '2v2': [
    { cls: 'deckMano_bottom', label: 'VOS (abajo)', ref: { top: 90, left: 50 } },
    { cls: 'deckMano_right', label: 'Rival derecha', ref: { top: 40, left: 96 } },
    { cls: 'deckMano_top', label: 'Compañero (arriba)', ref: { top: 6, left: 50 } },
    { cls: 'deckMano_left', label: 'Rival izquierda', ref: { top: 40, left: 4 } },
  ],
  '3v3': [
    { cls: 'deckMano_bottom', label: 'VOS (abajo)', ref: { top: 90, left: 50 } },
    { cls: 'deckMano_bottomRight', label: 'abajo-derecha', ref: { top: 60, left: 94 } },
    { cls: 'deckMano_topRight', label: 'arriba-derecha', ref: { top: 8, left: 92 } },
    { cls: 'deckMano_top', label: 'arriba', ref: { top: 4, left: 50 } },
    { cls: 'deckMano_topLeft', label: 'arriba-izquierda', ref: { top: 8, left: 8 } },
    { cls: 'deckMano_bottomLeft', label: 'abajo-izquierda', ref: { top: 60, left: 6 } },
  ],
};

/** Posición inicial del mazo por clase (= valores actuales en el CSS). */
const START: Record<string, { top: number; left: number }> = {
  deckRightBottom: { top: 94, left: 97 },
  deckLeftTop: { top: 4, left: 3 },
  deckMano_bottom: { top: 84, left: 76 },
  deckMano_top: { top: 13, left: 50 },
  deckMano_left: { top: 40, left: 13 },
  deckMano_right: { top: 40, left: 87 },
  deckMano_topLeft: { top: 15, left: 14 },
  deckMano_topRight: { top: 15, left: 86 },
  deckMano_bottomLeft: { top: 52, left: 14 },
  deckMano_bottomRight: { top: 52, left: 86 },
};

const round1 = (x: number) => Math.round(x * 10) / 10;

export function DeckLabPage() {
  const [mode, setMode] = useState<Mode>('2v2');
  const [pos, setPos] = useState<Record<string, { top: number; left: number }>>(START);
  const seats = MODES[mode];
  const [activeCls, setActiveCls] = useState<string>(seats[0].cls);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Al cambiar de modo, aseguramos que el lugar activo pertenezca al modo.
  const seatClasses = seats.map((s) => s.cls);
  const active = seatClasses.includes(activeCls) ? activeCls : seats[0].cls;

  const move = (e: PointerEvent) => {
    if (!dragging.current || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const left = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const top = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    setPos((p) => ({ ...p, [active]: { top: round1(top), left: round1(left) } }));
  };

  const cur = pos[active];

  /** Línea CSS de una clase (right cuando está en la mitad derecha, bottom abajo). */
  const cssLine = (cls: string) => {
    const { top, left } = pos[cls];
    const horiz = left > 50 ? `right: ${round1(100 - left)}%;` : `left: ${round1(left)}%;`;
    const vert = top > 50 ? `bottom: ${round1(100 - top)}%;` : `top: ${round1(top)}%;`;
    const extra = cls === 'deckMano_top' ? ' transform: translateX(-50%);' : '';
    return `.${cls} { ${vert} ${horiz}${extra} }`;
  };

  const modeCss = seats.map((s) => cssLine(s.cls)).join('\n');

  return (
    <div style={{ padding: 16, color: '#eee', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: '0 0 6px' }}>Editor del mazo (dev)</h2>

        {/* Selector de MODO */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['1v1', '2v2', '3v3'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setActiveCls(MODES[m][0].cls);
              }}
              style={{
                padding: '6px 14px', cursor: 'pointer', fontWeight: 700,
                background: mode === m ? '#c96a2f' : '#2f2316',
                color: '#fff', border: '1px solid #a54c1a', borderRadius: 6,
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <p style={{ margin: '0 0 10px', maxWidth: 520, color: '#bbb', fontSize: 14 }}>
          Tocá un asiento (o elegilo en la lista) para activarlo y arrastrá el 🃏
          hasta dejarlo al lado de ese jugador.
        </p>

        {/* Mesa de referencia */}
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
          {/* Asientos del modo actual (clickeables para activarlos) */}
          {seats.map((s) => (
            <button
              key={s.cls}
              onClick={() => setActiveCls(s.cls)}
              style={{
                position: 'absolute',
                top: `${s.ref.top}%`,
                left: `${s.ref.left}%`,
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', fontSize: 11, cursor: 'pointer',
                color: active === s.cls ? '#ffd98a' : '#cbd5c0',
                background: 'transparent', border: 'none',
              }}
            >
              <div
                style={{
                  width: 40, height: 26, margin: '0 auto 2px',
                  border: `2px ${active === s.cls ? 'solid #ffd98a' : 'dashed #9db'}`,
                  borderRadius: 4,
                }}
              />
              {s.label}
            </button>
          ))}

          {/* Mazo arrastrable */}
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
              background: '#b03020', border: '2px solid #e8cf7a', borderRadius: 6,
              display: 'grid', placeItems: 'center', cursor: 'grab', fontSize: 22,
              boxShadow: '0 4px 14px rgba(0,0,0,.5)',
            }}
            title="Arrastrame"
          >
            🃏
          </div>
        </div>
      </div>

      {/* Panel */}
      <div style={{ minWidth: 300, flex: 1 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>
          Jugador ({mode}):
        </label>
        <select
          value={active}
          onChange={(e) => setActiveCls(e.target.value)}
          style={{ padding: 6, marginBottom: 12, width: '100%', fontSize: 14 }}
        >
          {seats.map((s) => (
            <option key={s.cls} value={s.cls}>{s.label} → .{s.cls}</option>
          ))}
        </select>

        <div style={{ marginBottom: 12, fontFamily: 'monospace', fontSize: 14 }}>
          <div>Activo: <b>{seats.find((s) => s.cls === active)?.label}</b></div>
          <div>top: {cur.top}% · left: {cur.left}%</div>
          <div style={{ color: '#e8cf7a', marginTop: 4 }}>{cssLine(active)}</div>
        </div>

        <button
          onClick={() => navigator.clipboard?.writeText(modeCss)}
          style={{ padding: '8px 14px', marginBottom: 10, cursor: 'pointer' }}
        >
          Copiar CSS de {mode}
        </button>

        <p style={{ fontSize: 13, color: '#bbb', margin: '0 0 6px' }}>
          Pegá en <code>TableCenter.module.css</code>:
        </p>
        <textarea
          readOnly
          value={modeCss}
          style={{
            width: '100%', height: 180, fontFamily: 'monospace', fontSize: 12,
            background: '#111', color: '#dfe', padding: 8, borderRadius: 6,
          }}
        />
        <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          1v1 usa <code>.deckRightBottom</code> / <code>.deckLeftTop</code>. 2v2 y
          3v3 usan <code>.deckMano_*</code>. El mazo real se ancla al repartidor.
        </p>
      </div>
    </div>
  );
}
