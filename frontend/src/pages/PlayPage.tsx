import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Panel, Button, Badge, Icon, SegmentedControl } from '@/components/ui';
import { PlayingCard } from '@/components/game/PlayingCard';
import type { Card, GameMode } from '@/game';
import { loadSettings, saveSettings, type Difficulty, type Puntos } from '@/services/settings';
import { useAuth } from '@/features/auth/AuthContext';
import styles from './PlayPage.module.css';

interface ModeCardData {
  mode: GameMode | 'custom';
  title: string;
  desc: string;
  players: string;
  icon: 'bolt' | 'cards' | 'friends' | 'trophy';
  featured?: boolean;
}

const MODES: ModeCardData[] = [
  { mode: '1v1', title: 'Rápida 1 vs 1', desc: 'Emparejamiento inmediato contra un rival de tu nivel.', players: '2 jugadores', icon: 'bolt', featured: true },
  { mode: '2v2', title: 'Parejas 2 vs 2', desc: 'El clásico. Sentate con tu compañero y usá las señas.', players: '4 jugadores', icon: 'cards' },
  { mode: '3v3', title: 'Equipos 3 vs 3', desc: 'Truco a lo grande, con modalidad pico a pico.', players: '6 jugadores', icon: 'friends' },
  { mode: 'custom', title: 'Competitivo', desc: 'Partidas rankeadas por MMR. Próximamente.', players: 'Ranked', icon: 'trophy' },
];

// Mano de muestra para el preview de la mesa (solo presentación).
const PREVIEW_HAND: Card[] = [
  { rank: 2, suit: 'oro' },
  { rank: 1, suit: 'espada' },
  { rank: 7, suit: 'copa' },
];

export function PlayPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => loadSettings().difficulty,
  );
  const [puntos, setPuntos] = useState<Puntos>(() => loadSettings().puntos);
  const { isAuthenticated, profile } = useAuth();
  const navigate = useNavigate();
  const startMatch = (mode: GameMode = '1v1') =>
    navigate('/mesa', { state: { difficulty, mode, puntos } });

  const changeDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    saveSettings({ difficulty: d });
  };

  const changePuntos = (p: Puntos) => {
    setPuntos(p);
    saveSettings({ puntos: p });
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={
          isAuthenticated
            ? `Hola, ${profile?.displayName || profile?.username || 'jugador'}`
            : 'Truco Uruguayo'
        }
        title="Jugá una partida"
        subtitle={
          puntos === 40
            ? 'Reglamento uruguayo · 40 puntos (20 malas + 20 buenas).'
            : 'Reglamento uruguayo · 30 puntos (15 malas + 15 buenas).'
        }
      />

      {/* Hero + preview de mesa */}
      <Panel raised padding="none" className={styles.hero}>
        <div className={styles.heroText}>
          <Badge tone="accent">
            <Icon name="online" size={10} /> En línea
          </Badge>
          <h2 className={styles.heroTitle}>Sentate a la mesa</h2>
          <p className={styles.heroDesc}>
            Buscá una partida al instante o desafiá a un amigo. Piezas, matas,
            envido, flor y señas — todo el Truco de verdad.
          </p>
          <div className={styles.difficulty}>
            <span className={styles.difficultyLabel}>Dificultad de la IA</span>
            <SegmentedControl<Difficulty>
              ariaLabel="Dificultad"
              value={difficulty}
              onChange={changeDifficulty}
              options={[
                { value: 'facil', label: 'Fácil' },
                { value: 'normal', label: 'Normal' },
                { value: 'dificil', label: 'Difícil' },
              ]}
            />
          </div>
          <div className={styles.difficulty}>
            <span className={styles.difficultyLabel}>Puntos para ganar</span>
            <SegmentedControl<'30' | '40'>
              ariaLabel="Puntos"
              value={String(puntos) as '30' | '40'}
              onChange={(v) => changePuntos(Number(v) as Puntos)}
              options={[
                { value: '30', label: '30 · Corta' },
                { value: '40', label: '40 · Larga' },
              ]}
            />
          </div>

          <div className={styles.heroActions}>
            <Button
              size="lg"
              leading={<Icon name="play" size={20} />}
              onClick={() => startMatch('1v1')}
            >
              Jugar vs IA
            </Button>
            <Button
              size="lg"
              variant="secondary"
              leading={<Icon name="friends" size={20} />}
              onClick={() => navigate('/lan')}
            >
              Jugar por LAN
            </Button>
          </div>
        </div>

        <div className={styles.table} aria-hidden="true">
          <div className={styles.felt}>
            <span className={styles.muestraLabel}>Muestra</span>
            <div className={styles.muestra}>
              <PlayingCard card={{ rank: 4, suit: 'oro' }} size="sm" />
            </div>
            <div className={styles.hand}>
              {PREVIEW_HAND.map((c, i) => (
                <PlayingCard
                  key={i}
                  card={c}
                  selected={selected === i}
                  onClick={() => setSelected(selected === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Modos de juego */}
      <section>
        <h3 className={styles.sectionTitle}>Modos de juego</h3>
        <div className={styles.modeGrid}>
          {MODES.map((m) => (
            <Panel
              key={m.mode}
              className={[styles.modeCard, m.featured ? styles.modeFeatured : ''].join(' ')}
            >
              <div className={styles.modeIcon}>
                <Icon name={m.icon} size={26} />
              </div>
              <div className={styles.modeBody}>
                <div className={styles.modeHead}>
                  <h4>{m.title}</h4>
                  <span className={styles.modePlayers}>{m.players}</span>
                </div>
                <p>{m.desc}</p>
              </div>
              <Button
                variant={m.featured ? 'primary' : 'secondary'}
                block
                disabled={m.mode === 'custom'}
                trailing={<Icon name="chevron" size={18} />}
                onClick={m.mode !== 'custom' ? () => startMatch(m.mode as GameMode) : undefined}
              >
                {m.mode === 'custom' ? 'Muy pronto' : 'Jugar vs IA'}
              </Button>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}
