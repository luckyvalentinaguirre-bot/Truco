import styles from './StatusBar.module.css';

interface StatusBarProps {
  banner: string | null;
}

/** Sólo el banner transitorio de eventos (baza ganada/perdida, etc.). */
export function StatusBar({ banner }: StatusBarProps) {
  if (!banner) return null;
  return (
    <div className={styles.wrap} aria-live="polite">
      <span key={banner} className={styles.banner}>{banner}</span>
    </div>
  );
}
