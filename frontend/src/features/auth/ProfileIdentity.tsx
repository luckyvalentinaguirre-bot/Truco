/* =============================================================
 * Tarjeta de identidad + edición de perfil (displayName/avatar).
 * Usa useAuth() para leer y updateProfile() para persistir.
 * ============================================================= */
import { useEffect, useState, type FormEvent } from 'react';
import { Panel, Button } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from './AuthContext';
import { updateProfile } from '@/api/auth';
import { ApiError } from '@/api/client';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ProfileIdentity() {
  const { profile, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
    setAvatar(profile?.avatar ?? '');
  }, [profile?.displayName, profile?.avatar]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setState('saving');
    setError(null);
    try {
      await updateProfile({ displayName: displayName || null, avatar: avatar || null });
      await refreshUser();
      setState('saved');
    } catch (err) {
      setState('error');
      setError(err instanceof ApiError ? err.message : 'Error al guardar');
    }
  };

  const name = profile?.displayName || profile?.username || 'Jugador';

  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Avatar name={name} size={48} />
        <div>
          <div style={{ fontWeight: 700 }}>{name}</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>@{profile?.username ?? '—'}</div>
        </div>
      </div>

      <form onSubmit={onSave} style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span>Nombre a mostrar</span>
          <input
            aria-label="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <span>Avatar</span>
          <input aria-label="avatar" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
        </div>
        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? 'Guardando…' : 'Guardar'}
        </Button>
        {state === 'saved' && <span style={{ color: '#7bc47b' }}>Guardado ✓</span>}
        {state === 'error' && <span role="alert" style={{ color: '#e88' }}>{error}</span>}
      </form>
    </Panel>
  );
}
