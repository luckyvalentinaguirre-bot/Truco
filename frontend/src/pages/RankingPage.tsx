import { useEffect, useState } from 'react';
import { PageHeader, Panel, Badge, SegmentedControl } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { api, type LeaderboardEntry } from '@/services/api';
import { RANK_TIERS, getRank } from '@/data/ranks';
import { currentUser } from '@/services/mockData';
import styles from './RankingPage.module.css';

type Scope = 'global' | 'amigos' | 'temporada';
type ModeFilter = 'todas' | '1v1' | '2v2' | '3v3';

export function RankingPage() {
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [scope, setScope] = useState<Scope>('global');
  const [modalidad, setModalidad] = useState<ModeFilter>('todas');

  useEffect(() => {
    api.getLeaderboard().then(setBoard);
  }, []);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Competitivo"
        title="Ranking"
        subtitle="Escalá de Principiante a Vale 4. El sistema por MMR y las temporadas llegan pronto."
      />

      {/* Escalera de rangos */}
      <Panel className={styles.ladder}>
        <h3 className={styles.ladderTitle}>Escalera de rangos</h3>
        <ol className={styles.tiers}>
          {RANK_TIERS.map((tier) => {
            const current = tier.id === currentUser.rankId;
            return (
              <li
                key={tier.id}
                className={[styles.tier, current ? styles.tierCurrent : ''].join(' ')}
                style={{ ['--tier' as string]: tier.color }}
              >
                <span className={styles.tierDot} />
                <span className={styles.tierName}>{tier.name}</span>
                {current && <Badge color={tier.color} size="sm">Vos</Badge>}
              </li>
            );
          })}
        </ol>
        <p className={styles.ladderNote}>
          El MMR mostrado es una previsualización. Las recompensas de temporada
          y el matchmaking competitivo están en la hoja de ruta.
        </p>
      </Panel>

      {/* Clasificación */}
      <div className={styles.boardHead}>
        <h3 className={styles.sectionTitle}>Clasificación</h3>
        <SegmentedControl<Scope>
          ariaLabel="Alcance del ranking"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'global', label: 'Global' },
            { value: 'amigos', label: 'Amigos' },
            { value: 'temporada', label: 'Temporada' },
          ]}
        />
      </div>

      {/* Ranking por modalidad (§21). */}
      <div className={styles.boardHead}>
        <span className={styles.sectionTitle}>Modalidad</span>
        <SegmentedControl<ModeFilter>
          ariaLabel="Ranking por modalidad"
          value={modalidad}
          onChange={setModalidad}
          options={[
            { value: 'todas', label: 'Todas' },
            { value: '1v1', label: '1 vs 1' },
            { value: '2v2', label: '2 vs 2' },
            { value: '3v3', label: '3 vs 3' },
          ]}
        />
      </div>

      <Panel padding="none" className={styles.tableWrap}>
        {board === null ? (
          <div className={styles.loading}>Cargando ranking…</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colPos}>#</th>
                <th>Jugador</th>
                <th className={styles.colRank}>Rango</th>
                <th className={styles.colNum}>MMR</th>
                <th className={styles.colNum}>Winrate</th>
              </tr>
            </thead>
            <tbody>
              {board.map((e) => {
                const rank = getRank(e.rankId);
                const isMe = e.username === currentUser.username;
                return (
                  <tr key={e.position} className={isMe ? styles.rowMe : ''}>
                    <td className={styles.colPos}>
                      <span className={styles.pos}>{e.position}</span>
                    </td>
                    <td>
                      <div className={styles.player}>
                        <Avatar name={e.username} size={34} />
                        <span className={styles.pname}>{e.username}</span>
                        {isMe && <Badge tone="accent" size="sm">Vos</Badge>}
                      </div>
                    </td>
                    <td className={styles.colRank}>
                      <Badge color={rank.color} size="sm">{rank.name}</Badge>
                    </td>
                    <td className={styles.colNum}>{e.mmr}</td>
                    <td className={styles.colNum}>{Math.round(e.winrate * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
