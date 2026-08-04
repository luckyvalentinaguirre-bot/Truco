import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Panel, Button, Badge, StatTile, Icon } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { MatchRow } from '@/components/game/MatchRow';
import { api } from '@/services/api';
import { ProfileIdentity } from '@/features/auth/ProfileIdentity';
import { getRank } from '@/data/ranks';
import { formatPercent } from '@/lib/format';
import type { MatchRecord, UserProfile } from '@/types/domain';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);

  useEffect(() => {
    api.getCurrentUser().then(setUser);
    api.getRecentMatches().then(setMatches);
  }, []);

  if (!user) {
    return <Panel className={styles.loading}>Cargando perfil…</Panel>;
  }

  const rank = getRank(user.rankId);
  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Cuenta" title="Perfil" />

      {/* Identidad real (backend) + edición de displayName/avatar */}
      <ProfileIdentity />

      {/* Cabecera del perfil */}
      <Panel raised className={styles.header}>
        <Avatar name={user.displayName} size={96} framed online />
        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h2 className={styles.name}>{user.displayName}</h2>
            <Badge color={rank.color}>{rank.name}</Badge>
          </div>
          <span className={styles.handle}>@{user.username}</span>

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

      {/* Estadísticas */}
      <section>
        <h3 className={styles.sectionTitle}>Estadísticas</h3>
        <div className={styles.statGrid}>
          <StatTile label="Victorias" value={user.stats.wins} accent />
          <StatTile label="Derrotas" value={user.stats.losses} />
          <StatTile label="Winrate" value={formatPercent(user.stats.winrate)} />
          <StatTile label="Jugadas" value={user.stats.played} />
          <StatTile label="Trucos ganados" value={user.stats.trucosWon} />
          <StatTile label="Envidos ganados" value={user.stats.envidosWon} />
          <StatTile label="Flores ganadas" value={user.stats.floresWon} />
          <StatTile label="Mejor racha" value={`${user.stats.bestStreak} 🔥`} />
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
