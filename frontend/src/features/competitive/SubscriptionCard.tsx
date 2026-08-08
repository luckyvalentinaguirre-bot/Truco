/* =============================================================
 * Tarjeta de suscripción competitiva (US$3/mes). El acceso lo decide el
 * backend: acá sólo se muestra el estado y se inicia el checkout de Mercado
 * Pago (redirección) o se cancela la renovación. Sin pay-to-win.
 * ============================================================= */
import { useEffect, useState } from 'react';
import { Panel, Button, Badge } from '@/components/ui';
import {
  getSubscription,
  checkoutSubscription,
  cancelSubscription,
  type SubscriptionState,
} from '@/api/competitive';

export function SubscriptionCard() {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => getSubscription().then(setState).catch(() => setState(null));
  useEffect(() => {
    void load();
  }, []);

  const subscribe = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await checkoutSubscription();
      if (r.checkoutUrl) window.location.href = r.checkoutUrl; // → Mercado Pago
      else setMsg('No se pudo iniciar el checkout.');
    } catch {
      setMsg('El pago todavía no está disponible.');
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    setBusy(true);
    await cancelSubscription().catch(() => undefined);
    setBusy(false);
    void load();
  };

  const access = state?.access ?? 'blocked';
  const active = access === 'active' || access === 'canceled_but_active';
  const until = state?.subscription?.currentPeriodEnd
    ? new Date(state.subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <section>
      <h3 style={{ marginBottom: 8 }}>Competitivo</h3>
      <Panel raised padding="md" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 18 }}>US$3 / mes</strong>
          {active ? (
            <Badge tone="success" size="sm">Activo</Badge>
          ) : (
            <Badge tone="accent" size="sm">Bloqueado</Badge>
          )}
        </div>
        <p style={{ margin: 0, color: 'var(--c-text-mut)', fontSize: 13 }}>
          Accedé a partidas clasificatorias, ELO, ranking, temporadas, estadísticas
          e historial competitivo. Sin pay-to-win: todos juegan con las mismas reglas.
        </p>
        {until && (
          <p style={{ margin: 0, fontSize: 13 }}>
            {state?.subscription?.cancelAtPeriodEnd
              ? `Activo hasta ${until} · no se renovará.`
              : `Activo hasta ${until}.`}
          </p>
        )}
        {msg && <p style={{ margin: 0, color: 'var(--c-warning)', fontSize: 13 }}>{msg}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          {active ? (
            !state?.subscription?.cancelAtPeriodEnd && (
              <Button variant="secondary" size="sm" onClick={cancel} disabled={busy}>
                Cancelar renovación
              </Button>
            )
          ) : (
            <Button variant="primary" size="sm" onClick={subscribe} disabled={busy}>
              {busy ? '…' : 'Suscribirme'}
            </Button>
          )}
        </div>
      </Panel>
    </section>
  );
}
