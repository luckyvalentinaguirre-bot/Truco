/* =============================================================
 * Competitivo · Temporadas — estado derivado de fechas (puro)
 * -------------------------------------------------------------
 * El reset de temporada NO borra historial: el ranking de cada temporada
 * queda congelado y las temporadas anteriores se conservan.
 * ============================================================= */

export type SeasonStatus = 'upcoming' | 'active' | 'finished';

export interface Season {
  id: string;
  name: string;
  /** Inicio (epoch ms). */
  startsAt: number;
  /** Fin (epoch ms). */
  endsAt: number;
}

/** Estado de una temporada en un instante dado. */
export function seasonStatus(season: Season, now: number = Date.now()): SeasonStatus {
  if (now < season.startsAt) return 'upcoming';
  if (now >= season.endsAt) return 'finished';
  return 'active';
}

/** Temporada activa (si hay) dentro de una lista, en un instante dado. */
export function activeSeason(seasons: Season[], now: number = Date.now()): Season | null {
  return seasons.find((s) => seasonStatus(s, now) === 'active') ?? null;
}
