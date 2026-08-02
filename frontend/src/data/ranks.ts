/* =============================================================
 * Escalera de rangos competitivos de TRUCO.
 * Preparada para MMR/Elo, temporadas y recompensas futuras.
 * ============================================================= */
import type { RankTier } from '@/types/domain';

export const RANK_TIERS: RankTier[] = [
  { id: 'principiante', name: 'Principiante', order: 0, color: '#8a93a5', minMmr: 0 },
  { id: 'mate', name: 'Mate', order: 1, color: '#a8703c', minMmr: 800 },
  { id: 'copa', name: 'Copa', order: 2, color: '#d6564f', minMmr: 1100 },
  { id: 'flor', name: 'Flor', order: 3, color: '#4faa72', minMmr: 1400 },
  { id: 'truco', name: 'Truco', order: 4, color: '#5b8fd6', minMmr: 1700 },
  { id: 'retruco', name: 'Retruco', order: 5, color: '#9b6cd6', minMmr: 2000 },
  { id: 'vale4', name: 'Vale 4', order: 6, color: '#d9b168', minMmr: 2300 },
];

export function getRank(id: string): RankTier {
  return RANK_TIERS.find((r) => r.id === id) ?? RANK_TIERS[0];
}

export function rankByMmr(mmr: number): RankTier {
  return [...RANK_TIERS].reverse().find((r) => mmr >= r.minMmr) ?? RANK_TIERS[0];
}
