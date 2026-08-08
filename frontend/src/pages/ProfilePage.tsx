import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Panel, Button, Badge, StatTile, Icon } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { MatchRow } from '@/components/game/MatchRow';
import { api } from '@/services/api';
import { getCompetitiveMe, type CompetitiveMe } from '@/api/competitive';
import { SubscriptionCard } from '@/features/competitive/SubscriptionCard';
import { useAuth } from '@/features/auth/AuthContext';
import { ProfileIdentity } from '@/features/auth/ProfileIdentity';
import { getRank } from '@/data/ranks';
import { formatPercent } from '@/lib/format';
import type { MatchRecord, UserProfile } from '@/types/domain';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const { profile: authProfile } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [me, setMe] = useState<CompetitiveMe | null>(null);

  useEffect(() => {
    api.getCurrentUser().then(setUser);
    api.getRecentMatches().then(setMatches);
    getCompetitiveMe().then(setMe).catch(() => setMe(null));
  }, []);

  if (!user) {
    return <Panel className={styles.loading}>Cargando perfil…</Panel>;
  }

  // ELO/rango/stats REALES del backend competitivo (con fallback al placeholder).
  const rank = getRank(me?.rank.id ?? user.rankId);
  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  // Identidad REAL del backend (auth); las estadísticas/rango siguen siendo
  // placeholders hasta que exista su backend (§9: no inventar datos).
  const realName = authProfile?.displayName || authProfile?.username || user.displayName;
  const realHandle = authProfile?.username || user.username;

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Cuenta" title="Perfil" />

      {/* Identidad real (backend) + edición de displayName/avatar */}
      <ProfileIdentity />

      {/* Cabecera del perfil */}
      <Panel raised className={styles.header}>
        <Avatar name={realName} size={96} framed online />
        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h2 className={styles.name}>{realName}</h2>
            <Badge color={rank.color}>{rank.name}</Badge>
          </div>
          <span className={styles.handle}>@{realHandle}</span>

          <div className={styles.levelRow}>
            <span className={styles.levelBadge}>
              <Icon name="bolt" size={14} /> Nivel {user.level}
            </span>
            <div className={styles.xpBar} aria-label={`Experiencia ${xpPct}%`}>
              <span className={styles.xpFill} style={{ width: `${xpPct}%` }} />
            </div>
            <span className={styles.xpText}>
              {user.xp} / {user.xpToNext} XP
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary">Editar perfil</Button>
        </div>
      </Panel>

      {/* Suscripción competitiva (US$3/mes) */}
      <SubscriptionCard />

      {/* Estadísticas competitivas (reales del backend cuando hay temporada) */}
      <section>
        <h3 className={styles.sectionTitle}>Estadísticas competitivas</h3>
        <div className={styles.statGrid}>
          <StatTile label="ELO" value={me?.rating ?? '—'} accent />
          <StatTile label="Rango" value={me?.rank.name ?? rank.name} />
          <StatTile label="Victorias" value={me?.wins ?? user.stats.wins} />
          <StatTile label="Derrotas" value={me?.losses ?? user.stats.losses} />
          <StatTile label="Winrate" value={formatPercent(me?.winrate ?? user.stats.winrate)} />
          <StatTile label="Partidas" value={me?.games ?? user.stats.played} />
          <StatTile label="Mejor ELO" value={me?.bestRating ?? '—'} />
          <StatTile label="Racha" value={me ? `${me.streak}` : `${user.stats.bestStreak} 🔥`} />
        </div>
      </section>

      {/* Partidas recientes */}
      <section>
        <div className={styles.recentHead}>
          <h3 className={styles.sectionTitle}>Partidas recientes</h3>
          <Link to="/historial" className={styles.link}>
            Ver historial <Icon name="chevron" size={16} />
          </Link>
        </div>
        <div className={styles.matchList}>
          {matches.slice(0, 4).map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </div>
      </section>
    </div>
  );
}
