import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameMode } from '@/game';
import { DEFAULT_LAN_PORT } from '@/net/protocol';
import { useNetworkMatch, type NetworkMatchOptions } from '@/features/match/useNetworkMatch';
import { MatchBoard } from '@/features/match/components/MatchBoard';
import styles from './LanPage.module.css';

const MODES: { mode: GameMode; label: string }[] = [
  { mode: '1v1', label: '1 vs 1' },
  { mode: '2v2', label: '2 vs 2' },
  { mode: '3v3', label: '3 vs 3' },
];

function defaultUrl(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `ws://${host}:${DEFAULT_LAN_PORT}`;
}

/** Sesión activa: conecta al servidor y muestra el lobby o el tablero. */
function LanSession({ opts, onExit }: { opts: NetworkMatchOptions; onExit: () => void }) {
  const net = useNetworkMatch(opts);

  if (net.status === 'error') {
    return (
      <div className={styles.center}>
        <p className={styles.err}>{net.error ?? 'Error de conexión'}</p>
        <p className={styles.hint}>¿El servidor está corriendo? (npm run server)</p>
        <button className={styles.btn} onClick={onExit}>Volver</button>
      </div>
    );
  }

  if (!net.state) {
    const info = net.lobby;
    return (
      <div className={styles.center}>
        <h2 className={styles.title}>Sala LAN</h2>
        {info ? (
          <>
            <div className={styles.code}>{info.code}</div>
            <p className={styles.hint}>Compartí este código con los demás jugadores.</p>
            <p className={styles.count}>
              {info.filled} / {info.needed} jugadores
            </p>
            <ul className={styles.players}>
              {info.names.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <p className={styles.hint}>La partida arranca al completarse.</p>
          </>
        ) : (
          <p className={styles.hint}>Conectando…</p>
        )}
        <button className={styles.btn} onClick={onExit}>Cancelar</button>
      </div>
    );
  }

  const aiSeat = net.state.players.find((p) => p.seat !== net.mySeat)?.seat ?? net.mySeat;
  // Estado de conexión funcional para la barra superior. (El caso 'error' ya
  // se manejó y retornó antes; aquí sólo quedan estados conectados.)
  const conn = net.status === 'connecting' ? 'connecting' : 'connected';
  return (
    <MatchBoard
      state={net.state}
      humanSeat={net.mySeat}
      aiSeat={aiSeat}
      bubbles={net.bubbles}
      reveal={net.reveal}
      dispatch={net.dispatch}
      onRestart={net.restart}
      netStatus={conn}
    />
  );
}

export function LanPage() {
  const navigate = useNavigate();
  const [opts, setOpts] = useState<NetworkMatchOptions | null>(null);
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<GameMode>('1v1');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState(defaultUrl);

  if (opts) {
    return <LanSession opts={opts} onExit={() => setOpts(null)} />;
  }

  const start = () => {
    const base = { url, name: name.trim() || 'Jugador' };
    setOpts(tab === 'create' ? { ...base, mode } : { ...base, code: code.trim().toUpperCase() });
  };
  const canStart = tab === 'create' ? true : code.trim().length >= 3;

  return (
    <div className={styles.center}>
      <h1 className={styles.title}>Jugar por LAN</h1>

      <div className={styles.tabs}>
        <button
          className={[styles.tab, tab === 'create' ? styles.tabOn : ''].join(' ')}
          onClick={() => setTab('create')}
        >
          Crear sala
        </button>
        <button
          className={[styles.tab, tab === 'join' ? styles.tabOn : ''].join(' ')}
          onClick={() => setTab('join')}
        >
          Unirse
        </button>
      </div>

      <label className={styles.field}>
        <span>Tu nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jugador" />
      </label>

      {tab === 'create' ? (
        <label className={styles.field}>
          <span>Modo</span>
          <div className={styles.modes}>
            {MODES.map((m) => (
              <button
                key={m.mode}
                className={[styles.mode, mode === m.mode ? styles.modeOn : ''].join(' ')}
                onClick={() => setMode(m.mode)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </label>
      ) : (
        <label className={styles.field}>
          <span>Código de sala</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={6}
          />
        </label>
      )}

      <label className={styles.field}>
        <span>Servidor</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>

      <div className={styles.row}>
        <button className={styles.btnGhost} onClick={() => navigate('/')}>Volver</button>
        <button className={styles.btn} onClick={start} disabled={!canStart}>
          {tab === 'create' ? 'Crear' : 'Unirse'}
        </button>
      </div>
    </div>
  );
}
