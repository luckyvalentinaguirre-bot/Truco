/* =============================================================
 * TRUCO ENGINE · Punto de entrada (frontend)
 * -------------------------------------------------------------
 * El motor de reglas vive ahora en el paquete compartido
 * `packages/game-rules`, consumido también por el backend. Este
 * barrel re-exporta el motor para que la UI siga importando desde
 * `@/game` sin cambios. NO poner lógica de reglas acá.
 * ============================================================= */
export * from '../../../packages/game-rules/src/index';
