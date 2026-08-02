/* =============================================================
 * TRUCO ENGINE · Señas (mecánica real, no decorativa)
 * -------------------------------------------------------------
 * Catálogo de señas tradicionales. En 2v2 el jugador podrá
 * ejecutarlas al compañero. La UI mobile las expondrá con
 * controles táctiles apropiados.
 * ============================================================= */

export interface Sena {
  id: string;
  /** Descripción de la carta que representa. */
  card: string;
  /** Gesto tradicional. */
  gesture: string;
}

export const SENAS: Sena[] = [
  { id: 'pieza-2', card: '2 de la muestra', gesture: 'Levantar las cejas' },
  { id: 'pieza-4', card: '4 de la muestra', gesture: 'Beso / labios hacia adelante' },
  { id: 'pieza-5', card: '5 de la muestra', gesture: 'Arrugar la nariz' },
  { id: 'pieza-11', card: '11 de la muestra', gesture: 'Guiñar ojo derecho' },
  { id: 'pieza-10', card: '10 de la muestra', gesture: 'Guiñar ojo izquierdo' },
  { id: 'mata-1e', card: '1 de Espadas', gesture: 'Mueca hacia la derecha' },
  { id: 'mata-1b', card: '1 de Bastos', gesture: 'Mueca hacia la derecha' },
  { id: 'mata-7e', card: '7 de Espadas', gesture: 'Mueca hacia la izquierda' },
  { id: 'mata-7o', card: '7 de Oros', gesture: 'Mueca hacia la izquierda' },
  { id: 'any-3', card: 'Cualquier 3', gesture: 'Morder labio inferior' },
  { id: 'any-2', card: 'Cualquier 2', gesture: 'Abrir ligeramente la boca' },
  { id: 'malas', card: 'Cartas malas', gesture: 'Cerrar ambos ojos' },
];
