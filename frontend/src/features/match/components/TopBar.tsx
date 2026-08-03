import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MatchState, Seat, TeamId } from '@/game';
import { Icon } from '@/components/ui';
import { loadSettings, saveSettings } from '@/services/settings';
import { Fosforos } from './Fosforos';
import styles from './TopBar.module.css';

interface TopBarProps {
  state: MatchState;
  humanSeat: Seat;
}

/** Barra superior: menú · marcador (VOS – RIVAL) · sonido/config/abandonar. */
export function TopBar({ state, humanSeat }: TopBarProps) {
  const navigate = useNavigate();
  const [sound, setSound] = useState(() => loadSettings().sound);
  const [confirmExit, setConfirmExit] = useState(false);

  const humanTeam: TeamId = state.players[humanSeat].team;
  const rivalTeam: TeamId = humanTeam === 'A' ? 'B' : 'A';
  const malas = state.ruleset.malas;
  const malasBoxes = Math.ceil(malas / 5);
  const buenasBoxes = Math.ceil((state.ruleset.targetPoints - malas) / 5);

  const enBuenas = (pts: number) => pts >= malas;
  const malasPts = (pts: number) => Math.min(pts, malas);
  const buenasPts = (pts: number) => Math.max(0, pts - malas);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    saveSettings({ sound: next });
  };

  const [menuOpen, setMenuOpen] = useState(false);

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
              <button
                className={styles.dropItem}
                onClick={() => {
                  toggleSound();
                }}
              >
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
                <Icon name="menu" size={18} /> Inicio
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.marcador}>
        <div className={styles.side}>
          <span className={[styles.team, styles.vos].join(' ')}>Nosotros</span>
          <span className={styles.sticks}>
            <span
              className={[styles.zoneBox, enBuenas(state.score[humanTeam]) ? styles.done : ''].join(' ')}
            >
              <Fosforos
                points={malasPts(state.score[humanTeam])}
                boxes={malasBoxes}
                color="var(--c-noquiero)"
              />
              <span className={styles.zoneLbl}>Malas</span>
            </span>
            <span className={[styles.zoneBox, styles.buenasBox].join(' ')}>
              <Fosforos
                points={buenasPts(state.score[humanTeam])}
                boxes={buenasBoxes}
                color="var(--c-gold-soft)"
              />
              <span className={styles.zoneLbl}>Buenas</span>
            </span>
          </span>
          <span className={styles.num}>{state.score[humanTeam]}</span>
        </div>
        <div className={styles.mid}>
          <span className={styles.dash}>—</span>
          <span className={styles.target}>A {state.ruleset.targetPoints}</span>
        </div>
        <div className={styles.side}>
          <span className={[styles.team, styles.rival].join(' ')}>Ellos</span>
          <span className={styles.sticks}>
            <span
              className={[styles.zoneBox, enBuenas(state.score[rivalTeam]) ? styles.done : ''].join(' ')}
            >
              <Fosforos
                points={malasPts(state.score[rivalTeam])}
                boxes={malasBoxes}
                color="var(--c-noquiero)"
              />
              <span className={styles.zoneLbl}>Malas</span>
            </span>
            <span className={[styles.zoneBox, styles.buenasBox].join(' ')}>
              <Fosforos
                points={buenasPts(state.score[rivalTeam])}
                boxes={buenasBoxes}
                color="var(--c-cream)"
              />
              <span className={styles.zoneLbl}>Buenas</span>
            </span>
          </span>
          <span className={styles.num}>{state.score[rivalTeam]}</span>
        </div>
      </div>

      <div className={styles.controls}>
        {confirmExit ? (
          <div className={styles.confirm}>
            <span>¿Abandonar?</span>
            <button className={styles.confirmYes} onClick={() => navigate('/')}>Sí</button>
            <button className={styles.confirmNo} onClick={() => setConfirmExit(false)}>No</button>
          </div>
        ) : (
          <button className={styles.abandonar} onClick={() => setConfirmExit(true)}>
            Abandonar
          </button>
        )}
      </div>
    </header>
  );
}
