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

  const half = (pts: number) => (pts >= malas ? pts - malas : pts);
  const zone = (pts: number) => (pts >= malas ? 'Buenas' : 'Malas');

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
          <span className={[styles.team, styles.vos].join(' ')}>Vos</span>
          <span className={styles.sticks}>
            <Fosforos points={half(state.score[humanTeam])} />
          </span>
          <span className={styles.num}>{state.score[humanTeam]}</span>
          <span className={styles.zone}>
            {zone(state.score[humanTeam])} · {state.score[humanTeam]}
          </span>
        </div>
        <div className={styles.mid}>
          <span className={styles.dash}>—</span>
          <span className={styles.target}>A {state.ruleset.targetPoints}</span>
        </div>
        <div className={styles.side}>
          <span className={[styles.team, styles.rival].join(' ')}>Rival</span>
          <span className={styles.sticks}>
            <Fosforos points={half(state.score[rivalTeam])} color="var(--c-cream)" />
          </span>
          <span className={styles.num}>{state.score[rivalTeam]}</span>
          <span className={styles.zone}>
            {zone(state.score[rivalTeam])} · {state.score[rivalTeam]}
          </span>
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
