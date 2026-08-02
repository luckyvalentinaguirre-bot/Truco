import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  /** Marco dorado (cosmético futuro). */
  framed?: boolean;
  online?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}

/** Color estable derivado del nombre (avatar por defecto). */
function hueFrom(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ name, src, size = 44, framed = false, online }: AvatarProps) {
  const hue = hueFrom(name);
  return (
    <span
      className={[styles.wrap, framed ? styles.framed : ''].join(' ')}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img className={styles.img} src={src} alt="" />
      ) : (
        <span
          className={styles.fallback}
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 45% 32%), hsl(${
              (hue + 40) % 360
            } 45% 22%))`,
            fontSize: size * 0.4,
          }}
          aria-hidden="true"
        >
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={[styles.dot, online ? styles.on : styles.off].join(' ')}
          style={{ width: size * 0.26, height: size * 0.26 }}
        />
      )}
    </span>
  );
}
