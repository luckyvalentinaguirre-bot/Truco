/* =============================================================
 * Loader centralizado de imágenes de la baraja real.
 * -------------------------------------------------------------
 * Única fuente de verdad para vincular {suit, rank} → PNG real de
 * `frontend/public/cartas_truco/`. Ningún componente arma rutas a mano.
 *
 * Estructura REAL de assets (respetar mayúsculas de carpeta, minúsculas
 * de archivo):
 *   /cartas_truco/OROS/oros-3.png
 *   /cartas_truco/COPAS/copas-7.png
 *   /cartas_truco/ESPADAS/espadas-1.png
 *   /cartas_truco/BASTOS/bastos-12.png
 *   /cartas_truco/card_back.png
 *
 * Reglas y gráficos separados: el engine trabaja con {suit, rank}; acá
 * sólo se traduce a la imagen que la representa. La imagen NUNCA cambia
 * por estado de juego (pieza, muestra, etc.).
 * ============================================================= */
import type { Card, Rank, Suit } from '@/game';

export const CARDS_BASE = '/cartas_truco';
export const CARD_BACK_SRC = `${CARDS_BASE}/card_back.png`;

/**
 * Palo del engine (singular) → carpeta real y prefijo de archivo.
 * OJO: la carpeta de copas en los assets reales es `COPA` (singular),
 * mientras que el resto es plural. Se respeta la estructura tal cual existe
 * en `public/cartas_truco/` (verificado en disco), no la asumida.
 */
const SUIT_DIR: Record<Suit, { folder: string; file: string }> = {
  oro: { folder: 'OROS', file: 'oros' },
  copa: { folder: 'COPA', file: 'copas' },
  espada: { folder: 'ESPADAS', file: 'espadas' },
  basto: { folder: 'BASTOS', file: 'bastos' },
};

/** Valores válidos de la baraja española de 40 (no existen 8, 9 ni comodines). */
const VALID_RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export function isValidSuit(suit: unknown): suit is Suit {
  return suit === 'oro' || suit === 'copa' || suit === 'espada' || suit === 'basto';
}

export function isValidRank(rank: unknown): rank is Rank {
  return typeof rank === 'number' && (VALID_RANKS as readonly number[]).includes(rank);
}

/**
 * Ruta pública del PNG que representa exactamente esta carta.
 * Lanza si el palo o el valor son inválidos (nunca inventa un asset).
 *
 *   getCardAsset({ suit: 'oro', rank: 3 })    → '/cartas_truco/OROS/oros-3.png'
 *   getCardAsset({ suit: 'espada', rank: 1 }) → '/cartas_truco/ESPADAS/espadas-1.png'
 */
export function getCardAsset(card: Card): string {
  if (!isValidSuit(card.suit)) {
    throw new Error(`Palo inválido: ${JSON.stringify(card.suit)}`);
  }
  if (!isValidRank(card.rank)) {
    throw new Error(`Valor inválido para ${card.suit}: ${JSON.stringify(card.rank)}`);
  }
  const { folder, file } = SUIT_DIR[card.suit];
  return `${CARDS_BASE}/${folder}/${file}-${card.rank}.png`;
}

/** Reverso oficial de la baraja (cartas ocultas). */
export function getCardBackAsset(): string {
  return CARD_BACK_SRC;
}

/** Las 40 cartas (para la herramienta de test de assets). */
export function allCards(): Card[] {
  const suits: Suit[] = ['oro', 'copa', 'espada', 'basto'];
  return suits.flatMap((suit) => VALID_RANKS.map((rank) => ({ suit, rank })));
}
