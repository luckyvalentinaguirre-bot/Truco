/* =============================================================
 * Loader centralizado de imágenes de mesa (assets reales).
 * -------------------------------------------------------------
 * Las tres imágenes son la MISMA mesa oval (riel de madera + cuero) en
 * distinto color de paño. Se usan como capa visual de fondo; las cartas,
 * botones, marcador, muestra y jugadores siguen siendo componentes encima.
 *
 *   verde → /mesas/IMG_1540.PNG   (clásico, por defecto)
 *   bordo → /mesas/IMG_1539.PNG
 *   azul  → /mesas/IMG_1541.PNG
 *
 * Ningún componente escribe la ruta a mano: siempre por getMesaAsset().
 * ============================================================= */
export type MesaTheme = 'verde' | 'bordo' | 'azul';

const MESA_SRC: Record<MesaTheme, string> = {
  verde: '/mesas/IMG_1540.PNG',
  bordo: '/mesas/IMG_1539.PNG',
  azul: '/mesas/IMG_1541.PNG',
};

export const MESA_THEMES: { id: MesaTheme; label: string }[] = [
  { id: 'verde', label: 'Verde' },
  { id: 'bordo', label: 'Bordó' },
  { id: 'azul', label: 'Azul' },
];

export function isMesaTheme(v: unknown): v is MesaTheme {
  return v === 'verde' || v === 'bordo' || v === 'azul';
}

/** Ruta pública del PNG de mesa para el tema pedido (fallback: verde). */
export function getMesaAsset(theme: MesaTheme): string {
  return MESA_SRC[theme] ?? MESA_SRC.verde;
}
