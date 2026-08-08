/* =============================================================
 * Competitivo · Rangos derivados del ELO (server-authoritative)
 * -------------------------------------------------------------
 * El rango SIEMPRE lo calcula el backend a partir del ELO; el frontend
 * nunca lo elige. Los umbrales reflejan la escalera visual de la Etapa 4
 * (frontend/src/data/ranks.ts) para mantener coherencia — sin redefinir
 * la identidad visual acá.
 * ============================================================= */

export interface RankTier {
  id: string;
  name: string;
  /** Orden ascendente (0 = más bajo). */
  order: number;
  /** ELO mínimo para alcanzar el rango. */
  minRating: number;
}

/** Escalera de rangos (mismos umbrales que la UI de la Etapa 4). */
export const RANK_TIERS: RankTier[] = [
  { id: 'principiante', name: 'Principiante', order: 0, minRating: 0 },
  { id: 'mate', name: 'Mate', order: 1, minRating: 800 },
  { id: 'copa', name: 'Copa', order: 2, minRating: 1100 },
  { id: 'flor', name: 'Flor', order: 3, minRating: 1400 },
  { id: 'truco', name: 'Truco', order: 4, minRating: 1700 },
  { id: 'retruco', name: 'Retruco', order: 5, minRating: 2000 },
  { id: 'vale4', name: 'Vale 4', order: 6, minRating: 2300 },
];

/** Rango correspondiente a un ELO (server-authoritative). */
export function rankByRating(rating: number): RankTier {
  let tier = RANK_TIERS[0]!;
  for (const t of RANK_TIERS) {
    if (rating >= t.minRating) tier = t;
  }
  return tier;
}
