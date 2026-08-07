/* =============================================================
 * TRUCO ENGINE · PRNG determinista (mulberry32)
 * -------------------------------------------------------------
 * Un generador sembrado y serializable. Guardando sólo la semilla,
 * la partida es reproducible y verificable por el servidor.
 * ============================================================= */

/** Devuelve un RNG [0,1) determinista a partir de una semilla entera. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG para una mano concreta: combina semilla de partida y nº de mano. */
export function handRng(seed: number, handNumber: number): () => number {
  return mulberry32((seed ^ (handNumber * 0x9e3779b1)) >>> 0);
}
