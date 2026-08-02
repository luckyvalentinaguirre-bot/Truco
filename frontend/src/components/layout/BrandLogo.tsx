import styles from './BrandLogo.module.css';

interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className={styles.brand} aria-label="TRUCO">
      <span className={styles.mark} aria-hidden="true">
        <span className={styles.card1} />
        <span className={styles.card2} />
      </span>
      {!compact && <span className={styles.word}>TRUCO</span>}
    </span>
  );
}
