/* =============================================================
 * Herramienta de desarrollo: visor de los 40 assets + reverso.
 * -------------------------------------------------------------
 * Sólo se monta en dev (import.meta.env.DEV). Sirve para verificar que
 * cada {suit, rank} carga EXACTAMENTE su PNG y que ninguna ruta falla.
 * No aparece en la versión final.
 * ============================================================= */
import type { CSSProperties } from 'react';
import type { Suit } from '@/game';
import { PlayingCard } from '@/components/game/PlayingCard';
import { getCardAsset, getCardBackAsset } from '@/components/game/cardAssets';
import { MESA_THEMES, getMesaAsset } from '@/features/match/mesaAssets';

const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
const SUITS: { id: Suit; label: string }[] = [
  { id: 'oro', label: 'OROS' },
  { id: 'copa', label: 'COPAS' },
  { id: 'espada', label: 'ESPADAS' },
  { id: 'basto', label: 'BASTOS' },
];

const wrap: CSSProperties = { background: '#0f3d2e', minHeight: '100vh', padding: 20, color: '#f4ecd8' };
const rowCards: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 };
const cell: CSSProperties = { textAlign: 'center', fontSize: 11, fontFamily: 'monospace' };

export function CardsDevPage() {
  return (
    <div style={wrap}>
      <h1 style={{ fontFamily: 'Georgia, serif' }}>Test de assets · baraja real</h1>
      <p style={{ opacity: 0.8, fontSize: 13 }}>
        Cada carta muestra su ruta esperada. Si una aparece como recuadro rojo,
        el PNG real no está en <code>public/cartas_truco/</code>.
      </p>

      {SUITS.map((s) => (
        <section key={s.id}>
          <h2 style={{ fontFamily: 'Georgia, serif', color: '#e6c65a' }}>{s.label}</h2>
          <div style={rowCards}>
            {RANKS.map((rank) => (
              <div key={rank} style={cell}>
                <PlayingCard card={{ suit: s.id, rank }} size="md" />
                <div>{getCardAsset({ suit: s.id, rank }).replace('/cartas_truco/', '')}</div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 style={{ fontFamily: 'Georgia, serif', color: '#e6c65a' }}>REVERSO</h2>
        <div style={rowCards}>
          <div style={cell}>
            <PlayingCard faceDown size="md" />
            <div>{getCardBackAsset().replace('/cartas_truco/', '')}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: 'Georgia, serif', color: '#e6c65a' }}>MESAS</h2>
        <div style={rowCards}>
          {MESA_THEMES.map((m) => (
            <div key={m.id} style={cell}>
              <img
                src={getMesaAsset(m.id)}
                alt={`Mesa ${m.label}`}
                style={{ width: 260, borderRadius: 10, display: 'block' }}
              />
              <div>
                {m.label} · {getMesaAsset(m.id).replace('/mesas/', '')}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
