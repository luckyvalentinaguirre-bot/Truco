/* =============================================================
 * HUD mínimo de la partida (reemplaza la barra superior): un menú hamburguesa
 * en una esquina y el tanteador (Nosotros/Ellos) en la otra, superpuestos sobre
 * la mesa para dejarle todo el alto disponible.
 * ============================================================= */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MatchState, Seat, TeamId } from '@/game';
import { Icon } from '@/components/ui';
import { loadSettings, saveSettings } from '@/services/settings';
import { ConnectionIndicator, type ConnState } from './ConnectionIndicator';
import styles from './MatchHud.module.css';

interface Props {
  state: MatchState;
  humanSeat: Seat;
  netStatus?: ConnState;
}

export function MatchHud({ state, humanSeat, netStatus }: Props) {
  const navigate = useNavigate();
  const [sound, setSound] = useState(() => loadSettings().sound);
  const [open, setOpen] = useState(false);

  const humanTeam: TeamId = state.players[humanSeat].team;
  const rivalTeam: TeamId = humanTeam === 'A' ? 'B' : 'A';
  const score = state.picoPublic ?? state.score;

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    saveSettings({ sound: next });
  };

  return (
    <>
      <div className={styles.menuWrap}>
        <button className={styles.iconBtn} onClick={() => setOpen((o) => !o)} aria-label="Menú" aria-expanded={open}>
          <Icon name="menu" size={20} />
        </button>
        {open && (
          <>
            <div className={styles.backdrop} onClick={() => setOpen(false)} />
            <div className={styles.dropdown} role="menu">
              <button className={styles.item} onClick={toggleSound}>
                <Icon name={sound ? 'sound' : 'mute'} size={16} /> {sound ? 'Silenciar' : 'Sonido'}
              </button>
              <button className={styles.item} onClick={() => { setOpen(false); navigate('/configuracion'); }}>
                <Icon name="settings" size={16} /> Configuración
              </button>
              <button className={styles.item} onClick={() => { setOpen(false); navigate('/'); }}>
                <Icon name="menu" size={16} /> Salir
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.score}>
        {netStatus && <ConnectionIndicator state={netStatus} />}
        <span className={styles.us}>{score[humanTeam]}</span>
        <span className={styles.sep}>—</span>
        <span className={styles.them}>{score[rivalTeam]}</span>
        <span className={styles.target}>/{state.ruleset.targetPoints}</span>
      </div>
    </>
  );
}
