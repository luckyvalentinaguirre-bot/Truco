/* =============================================================
 * TRUCO ENGINE · Reglamentos (variantes configurables)
 * ============================================================= */
import type { GameMode, Ruleset, TrucoCall, EnvidoCall } from './types';

/** Reglamento oficial de la primera versión de TRUCO. */
export const OFFICIAL_40: Ruleset = {
  id: 'uruguayo-40',
  label: 'Uruguayo · 40 puntos',
  targetPoints: 40,
  malas: 20,
  buenas: 20,
  withFlor: true,
  withSenas: true,
};

/** Variante corta preparada para el futuro (no activa por defecto). */
export const SHORT_30: Ruleset = {
  id: 'uruguayo-30',
  label: 'Uruguayo · 30 puntos',
  targetPoints: 30,
  malas: 15,
  buenas: 15,
  withFlor: true,
  withSenas: true,
};

export const RULESETS: Record<string, Ruleset> = {
  [OFFICIAL_40.id]: OFFICIAL_40,
  [SHORT_30.id]: SHORT_30,
};

/** Valores de la cadena de Truco (aceptado / no querido). */
export const TRUCO_VALUES: Record<TrucoCall, { accepted: number; declined: number }> = {
  truco: { accepted: 2, declined: 1 },
  retruco: { accepted: 3, declined: 2 },
  vale4: { accepted: 4, declined: 3 },
};

/** Escalada válida del Truco (alterna entre equipos). */
export const TRUCO_ESCALATION: Record<TrucoCall, TrucoCall | null> = {
  truco: 'retruco',
  retruco: 'vale4',
  vale4: null,
};

export const ENVIDO_LADDER: EnvidoCall[] = ['envido', 'real_envido', 'falta_envido'];

/** Reparto de cartas por modo. */
export const CARDS_PER_MODE: Record<GameMode, { players: number; teams: number }> = {
  '1v1': { players: 2, teams: 2 },
  '2v2': { players: 4, teams: 2 },
  '3v3': { players: 6, teams: 2 },
  '3players': { players: 3, teams: 2 }, // dos vs uno (mano recibe 4 y descarta)
};
