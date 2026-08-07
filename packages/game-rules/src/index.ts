/* =============================================================
 * TRUCO ENGINE · Punto de entrada público
 * -------------------------------------------------------------
 * La UI consume el motor SOLO desde acá. Mantener la superficie
 * estable facilita mover el motor al backend más adelante.
 * ============================================================= */
export * from './types.js';
export * from './deck.js';
export * from './ranking.js';
export * from './envido.js';
export * from './flor.js';
export * from './ruleset.js';
export * from './senas.js';

// --- Motor de partida (Etapa 2) ---
export * from './prng.js';
export * from './tricks.js';
export * from './trucoBetting.js';
export * from './envidoBetting.js';
export * from './florBetting.js';
export * from './scoring.js';
export * from './state.js';
export * from './actions.js';
export * from './events.js';
export * from './setup.js';
export * from './pico.js';
export * from './teamplay.js';
export * from './engine.js';
export * from './ai.js';

// Señas disponibles según la mano (mecánica de juego).
export * from './senasEngine.js';
