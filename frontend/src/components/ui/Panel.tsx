import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Panel más elevado / destacado. */
  raised?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Panel({
  raised = false,
  padding = 'md',
  className = '',
  children,
  ...rest
}: PanelProps) {
  const cls = [styles.panel, raised ? styles.raised : '', styles[`p_${padding}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
