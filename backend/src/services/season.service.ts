/* =============================================================
 * Backend · Servicio de temporadas (bootstrap)
 * -------------------------------------------------------------
 * Garantiza que SIEMPRE haya una temporada activa: si no hay ninguna vigente,
 * crea una nueva que corre desde hoy hasta ~30 días. No borra historial: las
 * temporadas anteriores quedan; ésta es sólo la vigente.
 * ============================================================= */
import {
  getActiveSeason,
  createSeason,
  type SeasonRow,
} from '../repositories/seasons.repository.js';

/** Duración por defecto de una temporada nueva (30 días). */
export const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Nombre legible por mes: "Temporada 2026-08". */
function seasonName(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `Temporada ${y}-${m}`;
}

/**
 * Devuelve la temporada activa; si no hay ninguna vigente, crea una nueva.
 * Idempotente en la práctica: si dos arranques compiten, ambos ven/crean una
 * temporada vigente (la ventana de carrera es despreciable en el MVP).
 */
export async function ensureActiveSeason(now: Date = new Date()): Promise<SeasonRow> {
  const active = await getActiveSeason(now);
  if (active) return active;
  return createSeason({
    name: seasonName(now),
    startsAt: now,
    endsAt: new Date(now.getTime() + SEASON_DURATION_MS),
  });
}
