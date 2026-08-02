import type { ReactNode } from 'react';
import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}

export function StatTile({ label, value, hint, accent = false }: StatTileProps) {
  return (
    <div className={[styles.tile, accent ? styles.accent : ''].join(' ')}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
