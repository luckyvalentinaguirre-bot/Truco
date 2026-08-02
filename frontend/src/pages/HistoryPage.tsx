import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Panel, SegmentedControl, StatTile } from '@/components/ui';
import { MatchRow } from '@/components/game/MatchRow';
import { api } from '@/services/api';
import { formatPercent } from '@/lib/format';
import type { MatchRecord } from '@/types/domain';
import styles from './HistoryPage.module.css';

type Filter = 'todas' | 'win' | 'loss';

export function HistoryPage() {
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);
  const [filter, setFilter] = useState<Filter>('todas');

  useEffect(() => {
    api.getRecentMatches().then(setMatches);
  }, []);

  const filtered = useMemo(() => {
    if (!matches) return [];
    if (filter === 'todas') return matches;
    return matches.filter((m) => m.result === filter);
  }, [matches, filter]);

  const wins = matches?.filter((m) => m.result === 'win').length ?? 0;
  const total = matches?.length ?? 0;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Registro"
        title="Historial"
        subtitle="Cada partida jugada queda registrada. Más adelante podrás revisar mano por mano."
      />

      <div className={styles.summary}>
        <StatTile label="Partidas" value={total} />
        <StatTile label="Victorias" value={wins} accent />
        <StatTile
          label="Winrate"
          value={total ? formatPercent(wins / total) : '—'}
        />
      </div>

      <div className={styles.controls}>
        <SegmentedControl<Filter>
          ariaLabel="Filtrar partidas"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todas', label: 'Todas' },
            { value: 'win', label: 'Ganadas' },
            { value: 'loss', label: 'Perdidas' },
          ]}
        />
      </div>

      <Panel padding="sm" className={styles.list}>
        {matches === null ? (
          <div className={styles.empty}>Cargando historial…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay partidas para este filtro.</div>
        ) : (
          filtered.map((m) => <MatchRow key={m.id} match={m} />)
        )}
      </Panel>
    </div>
  );
}
