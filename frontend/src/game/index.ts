/* =============================================================
 * TRUCO ENGINE · Punto de entrada público
 * -------------------------------------------------------------
 * La UI consume el motor SOLO desde acá. Mantener la superficie
 * estable facilita mover el motor al backend más adelante.
 * ============================================================= */
export * from './types';
export * from './deck';
export * from './ranking';
export * from './envido';
export * from './flor';
export * from './ruleset';
export * from './senas';

// --- Motor de partida (Etapa 2) ---
export * from './prng';
export * from './tricks';
export * from './trucoBetting';
export * from './envidoBetting';
export * from './florBetting';
export * from './scoring';
export * from './state';
export * from './actions';
export * from './events';
export * from './setup';
export * from './engine';
export * from './ai';

// Señas disponibles según la mano (mecánica de juego).
export * from './senasEngine';
