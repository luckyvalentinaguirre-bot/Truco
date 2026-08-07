/* =============================================================
 * Indicador de estado de conexión (funcional, no sólo color).
 * Usa texto + un punto; con aria-label para accesibilidad.
 * ============================================================= */
import styles from './ConnectionIndicator.module.css';

export type ConnState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

const LABEL: Record<ConnState, string> = {
  connected: 'Conectado',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…',
  disconnected: 'Desconectado',
};

export function ConnectionIndicator({ state }: { state: ConnState }) {
  return (
    <span
      className={[styles.wrap, styles[state]].join(' ')}
      role="status"
      aria-label={`Conexión: ${LABEL[state]}`}
      title={LABEL[state]}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.text}>{LABEL[state]}</span>
    </span>
  );
}
