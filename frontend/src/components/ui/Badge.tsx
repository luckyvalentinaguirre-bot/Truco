import type { ReactNode } from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
  children: ReactNode;
  /** Color explícito (por ej. color del rango). */
  color?: string;
  tone?: 'neutral' | 'success' | 'danger' | 'accent';
  size?: 'sm' | 'md';
}

export function Badge({ children, color, tone = 'neutral', size = 'md' }: BadgeProps) {
  const style = color
    ? {
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
      }
    : undefined;
  return (
    <span
      className={[styles.badge, styles[tone], styles[size]].join(' ')}
      style={style}
    >
      {children}
    </span>
  );
}
