/* =============================================================
 * Anuncio transitorio sobre la mesa: cantos (VOS/RIVAL canta TRUCO) y
 * resultados de Envido/Flor (con tantos y "¡Es buena!"). Puramente visual;
 * el texto lo arma matchView a partir de los eventos del motor.
 * ============================================================= */
import type { MatchAnnouncement } from '../matchView';
import styles from './Announcement.module.css';

export function Announcement({ data }: { data: MatchAnnouncement | null }) {
  if (!data) return null;
  return (
    <div className={styles.overlay} aria-live="assertive">
      <div
        key={`${data.title}-${data.verdict ?? ''}`}
        className={[styles.card, styles[data.tone]].join(' ')}
      >
        {data.who && (
          <span className={styles.who}>
            {data.who} <span className={styles.sub}>{data.subtitle}</span>
          </span>
        )}
        <span className={styles.title}>{data.title}</span>

        {data.rows && (
          <div className={styles.rows}>
            {data.rows.map((r) => (
              <div key={r.label} className={[styles.row, r.you ? styles.rowYou : ''].join(' ')}>
                <span className={styles.rowLabel}>{r.label}</span>
                <span className={styles.rowValue}>{r.value >= 0 ? r.value : '—'}</span>
              </div>
            ))}
          </div>
        )}

        {data.verdict && <span className={styles.verdict}>{data.verdict}</span>}
      </div>
    </div>
  );
}
