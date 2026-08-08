import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MatchState, Seat, TeamId } from '@/game';
import { Icon } from '@/components/ui';
import { loadSettings, saveSettings } from '@/services/settings';
import { ConnectionIndicator, type ConnState } from './ConnectionIndicator';
import styles from './TopBar.module.css';

interface TopBarProps {
  state: MatchState;
  humanSeat: Seat;
  /** Estado de conexión (LAN/online). En local no se pasa. */
  netStatus?: ConnState;
}

/**
 * Barra superior en partida — minimal: sólo lo indispensable.
 *   menú (sonido · configuración · salir) · marcador Nosotros/Ellos · conexión.
 * El estado de la partida (modalidad, mano, pico) se ve en la mesa, no acá.
 */
export function TopBar({ state, humanSeat, netStatus }: TopBarProps) {
  const navigate = useNavigate();
  const [sound, setSound] = useState(() => loadSettings().sound);
  const [menuOpen, setMenuOpen] = useState(false);

  const humanTeam: TeamId = state.players[humanSeat].team;
  const rivalTeam: TeamId = humanTeam === 'A' ? 'B' : 'A';
  // En Pico a Pico `state.score` es el marcador AISLADO del duelo (oculto): se
  // muestra el marcador público real.
  const score = state.picoPublic ?? state.score;

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    saveSettings({ sound: next });
  };

  return (
    <header className={styles.bar}>
      <div className={styles.menuWrap}>
        <button
          className={styles.iconBtn}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menú"
          aria-expanded={menuOpen}
        >
          <Icon name="menu" size={22} />
        </button>
        {menuOpen && (
          <>
            <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />
            <div className={styles.dropdown} role="menu">
              <button className={styles.dropItem} onClick={toggleSound}>
                <Icon name={sound ? 'sound' : 'mute'} size={18} />
                {sound ? 'Silenciar' : 'Activar sonido'}
              </button>
              <button
                className={styles.dropItem}
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/configuracion');
                }}
              >
                <Icon name="settings" size={18} /> Configuración
              </button>
              <button
                className={styles.dropItem}
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/');
                }}
              >
                <Icon name="menu" size={18} /> Salir de la partida
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.marcador}>
        <div className={styles.side}>
          <span className={[styles.team, styles.vos].join(' ')}>Nosotros</span>
          <span className={styles.num}>{score[humanTeam]}</span>
        </div>
        <div className={styles.mid}>
          <span className={styles.dash}>—</span>
          <span className={styles.target}>a {state.ruleset.targetPoints}</span>
        </div>
        <div className={styles.side}>
          <span className={styles.num}>{score[rivalTeam]}</span>
          <span className={[styles.team, styles.rival].join(' ')}>Ellos</span>
        </div>
      </div>

      <div className={styles.controls}>
        {netStatus && <ConnectionIndicator state={netStatus} />}
      </div>
    </header>
  );
}
