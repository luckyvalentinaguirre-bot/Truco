import { useEffect, useState } from 'react';
import { PageHeader, Panel, Button, Badge, Icon } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { api } from '@/services/api';
import type { Friend } from '@/types/domain';
import styles from './FriendsPage.module.css';

export function FriendsPage() {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.getFriends().then(setFriends);
  }, []);

  const filtered = (friends ?? []).filter((f) =>
    f.username.toLowerCase().includes(query.toLowerCase()),
  );
  const online = filtered.filter((f) => f.online);
  const offline = filtered.filter((f) => !f.online);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Social"
        title="Jugar con amigos"
        subtitle="Invitá a tus amigos a una mesa privada o creá una sala para compartir."
        actions={
          <Button leading={<Icon name="plus" size={18} />}>Crear sala privada</Button>
        }
      />

      <Panel className={styles.searchBar} padding="sm">
        <Icon name="search" size={20} />
        <input
          className={styles.input}
          placeholder="Buscar amigo por usuario…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar amigo"
        />
        <Button variant="ghost" size="sm">
          Agregar
        </Button>
      </Panel>

      {friends === null ? (
        <Panel className={styles.empty}>Cargando amigos…</Panel>
      ) : (
        <div className={styles.columns}>
          <section>
            <h3 className={styles.groupTitle}>
              En línea <span className={styles.count}>{online.length}</span>
            </h3>
            <div className={styles.list}>
              {online.length === 0 && (
                <Panel className={styles.empty}>Ningún amigo en línea.</Panel>
              )}
              {online.map((f) => (
                <FriendRow key={f.id} friend={f} />
              ))}
            </div>
          </section>

          <section>
            <h3 className={styles.groupTitle}>
              Desconectados <span className={styles.count}>{offline.length}</span>
            </h3>
            <div className={styles.list}>
              {offline.map((f) => (
                <FriendRow key={f.id} friend={f} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  return (
    <Panel className={styles.row} padding="sm">
      <Avatar name={friend.username} size={44} online={friend.online} />
      <div className={styles.rowMeta}>
        <span className={styles.username}>{friend.username}</span>
        {friend.inGame ? (
          <Badge tone="accent" size="sm">
            En partida
          </Badge>
        ) : friend.online ? (
          <Badge tone="success" size="sm">
            Disponible
          </Badge>
        ) : (
          <span className={styles.offline}>Desconectado</span>
        )}
      </div>
      <Button
        size="sm"
        variant={friend.online && !friend.inGame ? 'primary' : 'secondary'}
        disabled={!friend.online || friend.inGame}
      >
        Invitar
      </Button>
    </Panel>
  );
}
