/* =============================================================
 * Chat de equipo: un canal breve entre vos y tu(s) compañero(s).
 * -------------------------------------------------------------
 * Reemplaza al botón "Toca". Se abre desde un botón fijo abajo a la derecha.
 * Ofrece frases rápidas (señas) y texto libre; cada mensaje enviado se muestra
 * como burbuja junto a tu asiento (onSend) y queda en el registro del panel.
 * Sólo aparece en partidas por equipos (>1 jugador por lado).
 * ============================================================= */
import { useState } from 'react';
import { teammatesOf, type MatchState, type Seat } from '@/game';
import { Icon } from '@/components/ui';
import styles from './TeamChat.module.css';

interface Props {
  state: MatchState;
  humanSeat: Seat;
  /** Emite el texto enviado (para mostrarlo como burbuja / enviarlo por red). */
  onSend: (text: string) => void;
}

/** Frases rápidas típicas de coordinación en el truco. */
const QUICK = ['¡Tengo!', 'No tengo', 'Andá', 'Quiero', 'No quiero', 'Cuidado', '¡Buena!'];

interface ChatLine {
  id: number;
  text: string;
}

let chatSeq = 0;

export function TeamChat({ state, humanSeat, onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [log, setLog] = useState<ChatLine[]>([]);

  // Sólo en partidas por equipos (tenés al menos un compañero).
  if (teammatesOf(state, humanSeat).length === 0) return null;

  const send = (msg: string) => {
    const clean = msg.trim();
    if (!clean) return;
    setLog((l) => [...l.slice(-19), { id: ++chatSeq, text: clean }]);
    onSend(clean);
    setText('');
  };

  return (
    <div className={styles.wrap}>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Chat con tu compañero">
          <div className={styles.head}>
            <span className={styles.title}>Equipo</span>
            <button className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar">
              <Icon name="close" size={16} />
            </button>
          </div>

          <div className={styles.log}>
            {log.length === 0 ? (
              <span className={styles.empty}>Coordiná con tu compañero…</span>
            ) : (
              log.map((l) => (
                <span key={l.id} className={styles.line}>
                  {l.text}
                </span>
              ))
            )}
          </div>

          <div className={styles.quick}>
            {QUICK.map((q) => (
              <button key={q} className={styles.chip} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>

          <form
            className={styles.inputRow}
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input
              className={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribir…"
              maxLength={120}
            />
            <button className={styles.sendBtn} type="submit" aria-label="Enviar" disabled={!text.trim()}>
              <Icon name="play" size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        className={styles.fab}
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat con tu compañero"
        aria-expanded={open}
      >
        <Icon name="chat" size={20} />
      </button>
    </div>
  );
}
