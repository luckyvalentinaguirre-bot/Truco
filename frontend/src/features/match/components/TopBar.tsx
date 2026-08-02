import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MatchState, Seat, TeamId } from '@/game';
import { Icon } from '@/components/ui';
import { loadSettings, saveSettings } from '@/services/settings';
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

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    saveSettings({ sound: next });
  };

  return (
    <header className={styles.bar}>
      <button className={styles.iconBtn} onClick={() => navigate('/')} aria-label="Menú">
        <Icon name="menu" size={22} />
      </button>

      <div className={styles.marcador}>
        <div className={styles.side}>
          <span className={[styles.team, styles.vos].join(' ')}>Vos</span>
          <span className={styles.pts}>{state.score[humanTeam]}</span>
          <span className={styles.malas}>
            {state.score[humanTeam] >= malas ? 'Buenas' : 'Malas'}: {state.score[humanTeam] % malas}
          </span>
        </div>
        <div className={styles.mid}>
          <span className={styles.dash}>—</span>
          <span className={styles.target}>A {state.ruleset.targetPoints} puntos</span>
        </div>
        <div className={styles.side}>
          <span className={[styles.team, styles.rival].join(' ')}>Rival</span>
          <span className={styles.pts}>{state.score[rivalTeam]}</span>
          <span className={styles.malas}>
            {state.score[rivalTeam] >= malas ? 'Buenas' : 'Malas'}: {state.score[rivalTeam] % malas}
          </span>
        </div>
      </div>

      <div className={styles.controls}>
        <button
          className={[styles.iconBtn, sound ? '' : styles.off].join(' ')}
          onClick={toggleSound}
          aria-label={sound ? 'Silenciar' : 'Activar sonido'}
          aria-pressed={sound}
        >
          <Icon name={sound ? 'sound' : 'mute'} size={20} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={() => navigate('/configuracion')}
          aria-label="Configuración"
        >
          <Icon name="settings" size={20} />
        </button>
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
