/* =============================================================
 * Backend · Rules Engine compartido
 * -------------------------------------------------------------
 * Re-exporta el motor puro de `@truco/game-rules` (el MISMO que usa
 * el frontend). El futuro servidor autoritativo validará las acciones
 * de los jugadores con estas funciones, sin duplicar reglas.
 * ============================================================= */
export * from '@truco/game-rules';
