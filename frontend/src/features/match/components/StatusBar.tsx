import styles from './StatusBar.module.css';

interface StatusBarProps {
  status: string;
  banner: string | null;
}

/** Indicador contextual siempre visible + banner transitorio de eventos. */
export function StatusBar({ status, banner }: StatusBarProps) {
  return (
    <div className={styles.wrap} aria-live="polite">
      <span className={styles.status}>{status}</span>
      {banner && <span key={banner} className={styles.banner}>{banner}</span>}
    </div>
  );
}
