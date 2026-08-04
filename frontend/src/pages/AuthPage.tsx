/* =============================================================
 * Página mínima de cuenta: registro / login / perfil / logout.
 * Sirve para comprobar el circuito React → CORS → backend → Neon.
 * ============================================================= */
import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader, Panel, Button } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';

export function AuthPage() {
  const { status, isAuthenticated, user, profile, login, register, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
  }, [profile?.displayName]);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  };

  const onRegister = (e: FormEvent) => {
    e.preventDefault();
    void run(() => register(email, password, username), 'Cuenta creada, ya podés iniciar sesión.');
  };
  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    void run(() => login(email, password));
  };
  const onSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await authApi.updateProfile({ displayName });
    }, 'Perfil actualizado.');
  };

  if (status === 'loading') {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader eyebrow="Cuenta" title="Verificando sesión…" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', display: 'grid', gap: 16 }}>
      <PageHeader eyebrow="Cuenta" title={isAuthenticated ? 'Mi cuenta' : 'Ingresar'} />

      {err && <Panel><p style={{ color: '#e88' }}>{err}</p></Panel>}
      {msg && <Panel><p style={{ color: '#8e8' }}>{msg}</p></Panel>}

      {isAuthenticated ? (
        <>
          <Panel>
            <h3>Autenticado</h3>
            <p>Email: {user?.email}</p>
            <p>Usuario: {profile?.username}</p>
            <p>Nombre: {profile?.displayName ?? '—'}</p>
            <p>Avatar: {profile?.avatar ?? '—'}</p>
          </Panel>
          <Panel>
            <form onSubmit={onSaveProfile} style={{ display: 'grid', gap: 8 }}>
              <label>
                Nombre a mostrar
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <Button type="submit">Guardar perfil</Button>
            </form>
          </Panel>
          <Button variant="secondary" onClick={() => void run(() => logout())}>
            Cerrar sesión
          </Button>
        </>
      ) : (
        <>
          <Panel>
            <form onSubmit={onLogin} style={{ display: 'grid', gap: 8 }}>
              <h3>Iniciar sesión</h3>
              <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input
                placeholder="contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit">Entrar</Button>
            </form>
          </Panel>
          <Panel>
            <form onSubmit={onRegister} style={{ display: 'grid', gap: 8 }}>
              <h3>Crear cuenta</h3>
              <input placeholder="usuario" value={username} onChange={(e) => setUsername(e.target.value)} />
              <p style={{ fontSize: 12, opacity: 0.7 }}>Usá el email y contraseña de arriba.</p>
              <Button type="submit" variant="secondary">Registrarme</Button>
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}
