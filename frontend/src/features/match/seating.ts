/* =============================================================
 * Distribución de asientos alrededor de la mesa oval.
 * -------------------------------------------------------------
 * Traduce los jugadores del motor (por asiento) a una posición visual.
 * El humano siempre abajo-centro; el resto se reparte alrededor según la
 * cantidad de jugadores (1v1 / 2v2 / 3v3). Los equipos alternan A-B-A-B,
 * así que los rivales/compañeros quedan intercalados como en la mesa real.
 *
 * NO toca reglas: sólo mapea asiento → lugar. La usan la mesa (partida real)
 * y el visor de dev.
 * ============================================================= */
import type { Player, Seat, TeamId } from '@/game';

export type Spot =
  | 'bottom'
  | 'top'
  | 'left'
  | 'right'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight';

/** Lugares de los rivales/compañeros según total de jugadores (excluye al humano). */
const SPOTS_BY_COUNT: Record<number, Spot[]> = {
  2: ['top'], // 1v1: rival enfrente
  4: ['right', 'top', 'left'], // 2v2: rival der, compañero enfrente, rival izq
  6: ['bottomRight', 'topRight', 'top', 'topLeft', 'bottomLeft'], // 3v3 alternado
};

export interface SeatView {
  seat: Seat;
  team: TeamId;
  spot: Spot;
  isHuman: boolean;
  /** Distancia (en asientos, horario) desde el humano. */
  offset: number;
}

/** Vista de asientos: el humano abajo, los demás repartidos alrededor. */
export function seatViews(players: Player[], humanSeat: Seat): SeatView[] {
  const n = players.length;
  const spots = SPOTS_BY_COUNT[n] ?? SPOTS_BY_COUNT[2];
  return players.map((p) => {
    const offset = (p.seat - humanSeat + n) % n;
    const isHuman = offset === 0;
    return {
      seat: p.seat,
      team: p.team,
      isHuman,
      offset,
      spot: isHuman ? 'bottom' : spots[offset - 1] ?? 'top',
    };
  });
}
