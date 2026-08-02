/* =============================================================
 * TRUCO ENGINE · Cálculo del Envido (v1)
 * -------------------------------------------------------------
 * Reglas del Truco Uruguayo con piezas. Aislado y testeable.
 * Marcado como v1: la arquitectura permite refinar/variar sin
 * tocar la UI (ver docs/RULES_ENGINE.md).
 * ============================================================= */
import type { Card, Rank } from './types';
import { matchPiece } from './ranking';

/** Puntos de envido que aporta una carta común (figuras = 0). */
function commonEnvidoPoints(rank: Rank): number {
  return rank >= 10 ? 0 : rank; // 10, 11, 12 => 0
}

/** Valor especial de envido de cada pieza según su rango lógico. */
const PIECE_ENVIDO: Record<number, number> = {
  2: 30,
  4: 29,
  5: 28,
  11: 27,
  10: 27,
};

export interface EnvidoResult {
  value: number;
  /** Explicación legible para UI / tooltips. */
  detail: string;
}

/**
 * Calcula el envido de una mano de 3 cartas dada la muestra.
 *
 * Casos contemplados:
 *  - Con pieza: valor especial de la pieza + mayor carta restante.
 *  - Sin pieza, dos del mismo palo: 20 + ambos valores.
 *  - Sin pieza, tres palos distintos: la carta más alta.
 *
 * Máximo normal = 37 (pieza de 30 + 7).
 */
export function calcEnvido(hand: Card[], muestra: Card): EnvidoResult {
  const pieces = hand
    .map((c) => ({ card: c, slot: matchPiece(c, muestra) }))
    .filter((x) => x.slot !== null);

  const nonPieces = hand.filter((c) => matchPiece(c, muestra) === null);

  if (pieces.length > 0) {
    // La pieza de mayor valor especial encabeza.
    const best = pieces
      .map((p) => PIECE_ENVIDO[p.slot!.logicalRank])
      .sort((a, b) => b - a)[0];

    // Suma la mayor carta restante (cualquier palo), figuras = 0.
    const restBest = Math.max(
      0,
      ...nonPieces.map((c) => commonEnvidoPoints(c.rank)),
      ...pieces
        .filter((_, i) => i !== 0)
        .map((p) => PIECE_ENVIDO[p.slot!.logicalRank]),
    );
    const value = best + restBest;
    return { value, detail: `Pieza (${best}) + ${restBest}` };
  }

  // Sin piezas: agrupar por palo.
  const bySuit = new Map<string, number[]>();
  for (const c of hand) {
    const pts = commonEnvidoPoints(c.rank);
    const arr = bySuit.get(c.suit) ?? [];
    arr.push(pts);
    bySuit.set(c.suit, arr);
  }

  let best = 0;
  let detail = '';
  for (const [suit, pts] of bySuit) {
    if (pts.length >= 2) {
      const top2 = [...pts].sort((a, b) => b - a).slice(0, 2);
      const v = 20 + top2[0] + top2[1];
      if (v > best) {
        best = v;
        detail = `20 + ${top2[0]} + ${top2[1]} (${suit})`;
      }
    }
  }

  if (best === 0) {
    // Tres palos distintos: la carta más alta.
    const top = Math.max(...hand.map((c) => commonEnvidoPoints(c.rank)));
    best = top;
    detail = `Carta más alta (${top})`;
  }

  return { value: best, detail };
}

/** Puntos base de cada canto de envido (falta se resuelve por marcador). */
export const ENVIDO_BASE_POINTS: Record<string, number> = {
  envido: 2,
  real_envido: 3,
};

/**
 * Puntos de Falta Envido: los que le faltan al líder para el chico.
 * Configurable por reglamento (targetPoints).
 */
export function faltaEnvidoPoints(
  scoreA: number,
  scoreB: number,
  targetPoints: number,
): number {
  const leader = Math.max(scoreA, scoreB);
  return Math.max(1, targetPoints - leader);
}
