/* =============================================================
 * Preferencias locales (persistidas en localStorage).
 * Sin backend. Fuente única para sonido, animaciones y dificultad.
 * ============================================================= */
export type Difficulty = 'facil' | 'normal' | 'dificil';
export type MesaTheme = 'verde' | 'bordo' | 'azul';
/** Puntos para ganar la partida: 30 (corta) o 40 (larga, oficial). */
export type Puntos = 30 | 40;

export interface Settings {
  sound: boolean;
  animations: boolean;
  difficulty: Difficulty;
  mesaTheme: MesaTheme;
  puntos: Puntos;
}

const KEY = 'truco.settings.v1';

const DEFAULTS: Settings = {
  sound: true,
  animations: true,
  difficulty: 'normal',
  mesaTheme: 'verde',
  puntos: 30,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Aplica la preferencia de animaciones (desactiva transiciones si off). */
export function applyAnimationPreference(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.animations = enabled ? 'on' : 'off';
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
  // Notifica a los suscriptores (p. ej. el módulo de sonido).
  window.dispatchEvent(new CustomEvent('truco:settings', { detail: next }));
  return next;
}
