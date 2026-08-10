/* =============================================================
 * Jugar ONLINE: matchmaking competitivo por ELO o práctica vs bots, y la mesa
 * conectada al servidor autoritativo por WebSocket. El servidor decide todo;
 * la mesa sólo renderiza el snapshot y envía la intención de acción.
 * ============================================================= */
import { useEffect, useRef, useState } from 'react';
import type { GameMode } from '@/game';
import { MatchBoard } from '@/features/match/components/MatchBoard';
import { useOnlineMatch } from '@/features/match/useOnlineMatch';
import { joinMatchmaking, matchmakingStatus, leaveMatchmaking, createPractice } from '@/api/match';

type Phase = 'choose' | 'searching' | 'playing';

export function OnlinePlayPage() {
  const [phase, setPhase] = useState<Phase>('choose');
  const [mode, setMode] = useState<GameMode>('1v1');
  const [msg, setMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => stopPoll(), []);

  const search = async (m: GameMode) => {
    setMode(m);
    setMsg('');
    try {
      const r = await joinMatchmaking(m);
      if (r.status === 'matched') return setPhase('playing');
      setPhase('searching');
      pollRef.current = setInterval(async () => {
        const s = await matchmakingStatus().catch(() => null);
        if (s?.status === 'matched') {
          stopPoll();
          setPhase('playing');
        }
      }, 2000);
    } catch {
      setMsg('Necesitás iniciar sesión para jugar online.');
    }
  };

  const practice = async (m: GameMode) => {
    setMsg('');
    try {
      await createPractice(m, m === '3v3');
      setPhase('playing');
    } catch {
      setMsg('Necesitás iniciar sesión para jugar.');
    }
  };

  const cancelSearch = async () => {
    stopPoll();
    await leaveMatchmaking().catch(() => undefined);
    setPhase('choose');
  };

  if (phase === 'playing') return <OnlineBoard />;

  if (phase === 'searching') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2>Buscando partida {mode}…</h2>
        <p style={{ color: 'var(--c-text-mut)' }}>Emparejando por ELO (el rango se amplía con la espera).</p>
        <button className="btn" onClick={cancelSearch} style={{ marginTop: 12 }}>Cancelar</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 520 }}>
      <h1>Jugar online</h1>
      {msg && <p style={{ color: 'var(--c-warning)' }}>{msg}</p>}
      <section>
        <h3>Competitivo (ranked)</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['1v1', '2v2', '3v3'] as GameMode[]).map((m) => (
            <button key={m} className="btn" onClick={() => search(m)}>{m}</button>
          ))}
        </div>
      </section>
      <section>
        <h3>Práctica vs bots</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['1v1', '2v2', '3v3'] as GameMode[]).map((m) => (
            <button key={m} className="btn" onClick={() => practice(m)}>{m}</button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Mesa conectada al servidor por WebSocket. */
function OnlineBoard() {
  const { snapshot, netStatus, dispatch, chatBubbles, sendChat } = useOnlineMatch();

  if (!snapshot) {
    return <div style={{ padding: 24 }}>Conectando a la partida… ({netStatus})</div>;
  }
  const humanSeat = snapshot.viewerSeat ?? 0;
  const aiSeat = humanSeat === 0 ? 1 : 0;

  return (
    <MatchBoard
      state={snapshot.game}
      humanSeat={humanSeat}
      aiSeat={aiSeat}
      bubbles={chatBubbles}
      reveal={[]}
      dispatch={dispatch}
      onRestart={() => window.location.assign('/online')}
      netStatus={netStatus}
      onChat={sendChat}
    />
  );
}
