/* =============================================================
 * TRUCO ENGINE · Tipos del dominio
 * -------------------------------------------------------------
 * Motor de reglas INDEPENDIENTE de la UI. No importa React ni
 * ningún módulo de presentación. Pensado para poder ejecutarse
 * también en el backend (Node) — la validación de jugadas es
 * autoridad del servidor, nunca del cliente.
 *
 *   Game State  ->  Rules Engine  ->  Actions  ->  Events  ->  UI
 * ============================================================= */

/** Palos de la baraja española. */
export type Suit = 'oro' | 'copa' | 'espada' | 'basto';

/** Rangos vigentes tras quitar 8, 9 y comodines. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  suit: Suit;
  rank: Rank;
}

/** Identificador estable de una carta, útil para UI y red. */
export type CardId = `${Rank}-${Suit}`;

/** Categoría jerárquica de una carta dada una muestra. */
export type CardCategory = 'pieza' | 'mata' | 'comun';

/** Modalidades de partida contempladas por la arquitectura. */
export type GameMode = '1v1' | '2v2' | '3v3' | '3players';

/** Cantos de la línea de Truco. */
export type TrucoCall = 'truco' | 'retruco' | 'vale4';

/** Cantos de la línea de Envido. */
export type EnvidoCall = 'envido' | 'real_envido' | 'falta_envido';

/** Cantos de la línea de Flor. */
export type FlorCall = 'flor' | 'contraflor_envido' | 'contraflor_resto';

export interface RankedCard extends Card {
  /** Fuerza para resolver bazas: mayor gana; igual = parda. */
  strength: number;
  category: CardCategory;
}

/** Reglamento configurable de una partida (permite variantes futuras). */
export interface Ruleset {
  id: string;
  label: string;
  /** Puntos totales del chico (40 = 20 malas + 20 buenas). */
  targetPoints: number;
  malas: number;
  buenas: number;
  withFlor: boolean;
  withSenas: boolean;
}
