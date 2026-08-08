/* =============================================================
 * Matchmaking por ELO — cola en memoria (sin DB, factory inyectada).
 * ============================================================= */
import { describe, it, expect, beforeEach } from 'vitest';
import { Matchmaking } from './matchmaking.js';

let created: { mode: string; seatUsers: string[] }[];
function make(): Matchmaking {
  created = [];
  let n = 0;
  return new Matchmaking((mode, seatUsers) => {
    created.push({ mode, seatUsers });
    return `match-${++n}`;
  });
}

describe('Matchmaking', () => {
  let mm: Matchmaking;
  beforeEach(() => {
    mm = make();
  });

  it('1v1: el primero espera, el segundo completa el cupo y crea la partida', () => {
    const a = mm.join('a', 1000, '1v1');
    expect(a.status).toBe('queued');
    const b = mm.join('b', 1000, '1v1');
    expect(b.status).toBe('matched');
    expect(created).toHaveLength(1);
    // Ambos quedan asignados a la misma partida, asientos distintos.
    const sa = mm.status('a');
    const sb = mm.status('b');
    expect(sa.status).toBe('matched');
    expect(sb.status).toBe('matched');
    if (sa.status === 'matched' && sb.status === 'matched') {
      expect(sa.matchId).toBe(sb.matchId);
      expect(sa.seat).not.toBe(sb.seat);
    }
  });

  it('2v2: equilibra por rating — equipos A (pares) y B (impares) balanceados', () => {
    mm.join('r1500', 1500, '2v2');
    mm.join('r1400', 1400, '2v2');
    mm.join('r1000', 1000, '2v2');
    const last = mm.join('r900', 900, '2v2');
    expect(last.status).toBe('matched');
    expect(created).toHaveLength(1);
    const seats = created[0]!.seatUsers;
    // Orden por rating: [1500,1400,1000,900] → A={1500,1000}, B={1400,900}.
    // Asientos pares = A, impares = B.
    expect(seats[0]).toBe('r1500');
    expect(seats[2]).toBe('r1000');
    expect(seats[1]).toBe('r1400');
    expect(seats[3]).toBe('r900');
  });

  it('salir de la cola evita el emparejamiento', () => {
    mm.join('a', 1000, '1v1');
    mm.leave('a');
    const b = mm.join('b', 1000, '1v1');
    expect(b.status).toBe('queued'); // a ya no está
    expect(created).toHaveLength(0);
  });

  it('volver a join estando emparejado devuelve la misma asignación', () => {
    mm.join('a', 1000, '1v1');
    mm.join('b', 1000, '1v1');
    const again = mm.join('a', 1000, '1v1');
    expect(again.status).toBe('matched');
  });
});
