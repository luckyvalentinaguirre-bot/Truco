/* Definición única de la navegación principal (desktop + mobile). */
import type { IconName } from '@/components/ui';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Se muestra en la barra inferior mobile. */
  primaryMobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Jugar', icon: 'play', primaryMobile: true },
  { to: '/lan', label: 'Jugar con amigos', icon: 'online' },
  { to: '/ranking', label: 'Ranking', icon: 'ranking', primaryMobile: true },
  { to: '/perfil', label: 'Perfil', icon: 'profile', primaryMobile: true },
  { to: '/amigos', label: 'Amigos', icon: 'friends', primaryMobile: true },
  { to: '/historial', label: 'Historial', icon: 'history' },
  { to: '/configuracion', label: 'Configuración', icon: 'settings' },
];

/** Ítems visibles en la barra inferior del celular. */
export const MOBILE_PRIMARY = NAV_ITEMS.filter((i) => i.primaryMobile);
