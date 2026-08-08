/* =============================================================
 * Panel administrativo (/admin). Protegido: requiere sesión + rol admin +
 * 2ª credencial (contraseña admin). TODA la autorización es server-side; este
 * componente sólo refleja el estado que devuelve el backend y ejecuta acciones
 * reales contra los endpoints /admin/*.
 * ============================================================= */
import { useEffect, useState } from 'react';
import * as api from '@/api/admin';
import { ApiError } from '@/api/client';
import s from './AdminPage.module.css';

type Gate = 'checking' | 'need_admin_login' | 'not_admin' | 'need_login' | 'ok';
type Tab = 'dashboard' | 'usuarios' | 'partidas' | 'matchmaking' | 'pagos' | 'temporadas' | 'reportes' | 'auditoria';

export function AdminPage() {
  const [gate, setGate] = useState<Gate>('checking');

  const check = async () => {
    try {
      await api.adminSession();
      setGate('ok');
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (e instanceof ApiError && e.status === 403) setGate('not_admin');
      else if (code === 'admin_required') setGate('need_admin_login');
      else setGate('need_login');
    }
  };
  useEffect(() => {
    void check();
  }, []);

  if (gate === 'checking') return <div className={s.wrap}>Cargando…</div>;
  if (gate === 'need_login')
    return (
      <div className={s.wrap}>
        <div className={s.center}>
          <h1 className={s.title}>Panel administrativo</h1>
          <p>Iniciá sesión con tu cuenta antes de acceder.</p>
          <a className={s.btn} href="/cuenta">Ir a iniciar sesión</a>
        </div>
      </div>
    );
  if (gate === 'not_admin')
    return (
      <div className={s.wrap}>
        <div className={s.center}>
          <h1 className={s.title}>Panel administrativo</h1>
          <p className={s.err}>No autorizado.</p>
        </div>
      </div>
    );
  if (gate === 'need_admin_login') return <AdminLogin onOk={check} />;
  return <AdminShell onLogout={() => setGate('need_admin_login')} />;
}

// -------------------- Login (2ª credencial) --------------------
function AdminLogin({ onOk }: { onOk: () => void }) {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg('');
    const { status, body } = await api.adminLogin(password);
    setBusy(false);
    if (status === 200) {
      onOk();
      return;
    }
    if (status === 423) {
      const mins = Math.ceil((body.retryAfterMs ?? 0) / 60000);
      setMsg(`Acceso bloqueado temporalmente. Reintentá en ~${mins} min.`);
    } else if (status === 503) setMsg('El panel no está configurado en el servidor.');
    else if (status === 401 && body.error?.code === 'bad_admin_password')
      setMsg(`Contraseña incorrecta. Intentos restantes: ${body.attemptsLeft ?? '—'}.`);
    else setMsg(body.error?.message ?? 'Error');
  };

  return (
    <div className={s.wrap}>
      <div className={s.center}>
        <h1 className={s.title}>Acceso administrativo</h1>
        <p>Ingresá la contraseña administrativa.</p>
        <input
          className={s.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Contraseña admin"
          autoFocus
        />
        {msg && <div className={s.err}>{msg}</div>}
        <button className={s.btn} onClick={submit} disabled={busy || !password}>
          {busy ? '…' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}

// -------------------- Shell + pestañas --------------------
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'partidas', label: 'Partidas' },
  { id: 'matchmaking', label: 'Matchmaking' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'temporadas', label: 'Temporadas' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'auditoria', label: 'Auditoría' },
];

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const logout = async () => {
    await api.adminLogout().catch(() => undefined);
    onLogout();
  };
  return (
    <div className={s.wrap}>
      <div className={s.topbar}>
        <h1 className={s.title}>TRUCO · Admin</h1>
        <button className={s.btnGhost} onClick={logout}>Salir</button>
      </div>
      <div className={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={[s.tab, tab === t.id ? s.tabActive : ''].join(' ')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'usuarios' && <UsersTab />}
      {tab === 'partidas' && <MatchesTab />}
      {tab === 'matchmaking' && <MatchmakingTab />}
      {tab === 'pagos' && <PaymentsTab />}
      {tab === 'temporadas' && <SeasonsTab />}
      {tab === 'reportes' && <ReportsTab />}
      {tab === 'auditoria' && <AuditTab />}
    </div>
  );
}

// -------------------- Dashboard --------------------
function Dashboard() {
  const [stats, setStats] = useState<Record<string, number>>({});
  useEffect(() => {
    void api.adminStats().then((r) => setStats(r.stats)).catch(() => undefined);
  }, []);
  const labels: Record<string, string> = {
    users: 'Usuarios', banned: 'Baneados', premiumActive: 'Premium activos',
    matches: 'Partidas', matchesResolved: 'Finalizadas', payments: 'Pagos', seasons: 'Temporadas',
  };
  return (
    <div className={s.grid}>
      {Object.entries(stats).map(([k, v]) => (
        <div key={k} className={s.card}>
          <div className={s.cardNum}>{v}</div>
          <div className={s.cardLbl}>{labels[k] ?? k}</div>
        </div>
      ))}
    </div>
  );
}

// -------------------- Usuarios (buscador + ficha + acciones) --------------------
function UsersTab() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<api.AdminUserRow[]>([]);
  const [detail, setDetail] = useState<api.AdminUserDetail | null>(null);
  const [msg, setMsg] = useState('');

  const search = async () => {
    setMsg('');
    try {
      setResults((await api.searchUsers(q)).results);
    } catch {
      setMsg('Error al buscar');
    }
  };
  const open = async (id: string) => {
    setDetail((await api.userDetail(id)).user);
  };
  const refresh = () => detail && open(detail.id);

  const doBan = async () => {
    if (!detail) return;
    const reason = prompt('Motivo del baneo:') ?? '';
    if (!reason) return;
    const daysStr = prompt('Duración en días (vacío = permanente):') ?? '';
    const days = daysStr ? Number(daysStr) : undefined;
    await api.banUser(detail.id, reason, days);
    refresh();
  };
  const doUnban = async () => {
    if (!detail) return;
    await api.unbanUser(detail.id);
    refresh();
  };
  const doPremium = async () => {
    if (!detail) return;
    const daysStr = prompt('Días de Premium a otorgar:', '30') ?? '';
    const days = Number(daysStr);
    if (!days) return;
    await api.grantPremium(detail.id, days);
    refresh();
  };

  return (
    <div>
      <div className={s.searchRow}>
        <input
          className={s.input}
          style={{ margin: 0 }}
          placeholder="🔎 Buscar usuario (username, email o ID)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className={s.btn} onClick={search}>Buscar</button>
      </div>
      {msg && <div className={s.err}>{msg}</div>}
      {results.length > 0 && (
        <table className={s.table}>
          <thead>
            <tr><th>Username</th><th>Email</th><th>Rol</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {results.map((u) => (
              <tr key={u.id} className={s.row} onClick={() => open(u.id)}>
                <td>{u.username ?? '—'}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td className={u.banned ? s.banned : ''}>{u.banned ? 'BANEADO' : 'activo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {detail && (
        <div className={s.ficha}>
          <h2 className={s.title}>{detail.username ?? detail.email}</h2>
          <div className={s.fichaGrid}>
            <div><div className={s.k}>ID</div><div className={s.v}>{detail.id}</div></div>
            <div><div className={s.k}>Email</div><div className={s.v}>{detail.email}</div></div>
            <div><div className={s.k}>Registro</div><div className={s.v}>{new Date(detail.createdAt).toLocaleDateString()}</div></div>
            <div><div className={s.k}>Estado</div><div className={detail.banned ? s.banned : s.v}>{detail.banned ? `BANEADO${detail.banReason ? ` (${detail.banReason})` : ''}` : 'activo'}</div></div>
            <div><div className={s.k}>Premium</div><div className={s.v}>{detail.subscriptionStatus ?? '—'}</div></div>
            <div><div className={s.k}>Vence</div><div className={s.v}>{detail.subscriptionUntil ? new Date(detail.subscriptionUntil).toLocaleDateString() : '—'}</div></div>
            <div><div className={s.k}>ELO</div><div className={s.v}>{detail.rating ?? '—'}</div></div>
            <div><div className={s.k}>V / D</div><div className={s.v}>{detail.wins ?? 0} / {detail.losses ?? 0}</div></div>
          </div>
          <div className={s.actions}>
            {detail.banned
              ? <button className={s.btnGhost} onClick={doUnban}>Desbanear</button>
              : <button className={[s.btnGhost, s.btnDanger].join(' ')} onClick={doBan}>Banear</button>}
            <button className={s.btnGhost} onClick={doPremium}>Otorgar Premium</button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- Pestañas de solo lectura (tablas simples) --------------------
function useLoad<T>(fn: () => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    void fn().then(setData).catch(() => setData(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}

function MatchesTab() {
  const active = useLoad(() => api.adminMatchesActive());
  const finished = useLoad(() => api.adminMatchesFinished());
  return (
    <div>
      <h3 className={s.title}>Activas</h3>
      <pre className={s.card} style={{ overflow: 'auto' }}>{JSON.stringify(active?.matches ?? [], null, 1)}</pre>
      <h3 className={s.title}>Finalizadas</h3>
      <pre className={s.card} style={{ overflow: 'auto' }}>{JSON.stringify(finished?.matches ?? [], null, 1)}</pre>
    </div>
  );
}

function MatchmakingTab() {
  const q = useLoad(() => api.adminMatchmaking());
  return <pre className={s.card} style={{ overflow: 'auto' }}>{JSON.stringify(q?.queues ?? [], null, 1)}</pre>;
}

function PaymentsTab() {
  const p = useLoad(() => api.adminPayments());
  return (
    <table className={s.table}>
      <thead><tr><th>Usuario</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>
        {(p?.payments ?? []).map((x, i) => (
          <tr key={i}><td>{x.userId}</td><td>{x.amount} {x.currency}</td><td>{x.status}</td><td>{new Date(x.date).toLocaleString()}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function SeasonsTab() {
  const data = useLoad(() => api.adminSeasons());
  return (
    <table className={s.table}>
      <thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th></tr></thead>
      <tbody>
        {(data?.seasons ?? []).map((se) => (
          <tr key={se.id}><td>{se.name}</td><td>{new Date(se.startsAt).toLocaleDateString()}</td><td>{new Date(se.endsAt).toLocaleDateString()}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState<{ id: string; targetUsername: string | null; reason: string; status: string; date: string }[]>([]);
  const load = () => api.adminReports('open').then((r) => setReports(r.reports)).catch(() => undefined);
  useEffect(() => { void load(); }, []);
  const resolve = async (id: string) => {
    await api.resolveReport(id, 'resolved');
    void load();
  };
  return (
    <table className={s.table}>
      <thead><tr><th>Usuario reportado</th><th>Motivo</th><th>Fecha</th><th></th></tr></thead>
      <tbody>
        {reports.map((r) => (
          <tr key={r.id}>
            <td>{r.targetUsername ?? '—'}</td><td>{r.reason}</td><td>{new Date(r.date).toLocaleString()}</td>
            <td><button className={s.btnGhost} onClick={() => resolve(r.id)}>Resolver</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AuditTab() {
  const data = useLoad(() => api.adminAudit());
  return (
    <table className={s.table}>
      <thead><tr><th>Acción</th><th>Usuario afectado</th><th>Motivo</th><th>Resultado</th><th>Fecha</th></tr></thead>
      <tbody>
        {(data?.audit ?? []).map((a, i) => (
          <tr key={i}><td>{a.action}</td><td>{a.targetUserId ?? '—'}</td><td>{a.reason ?? '—'}</td><td>{a.result}</td><td>{new Date(a.date).toLocaleString()}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
