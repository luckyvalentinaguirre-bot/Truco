/* =============================================================
 * Matchmaking por ELO — cola con rango que se ENSANCHA con la espera.
 * (sin DB, factory y reloj inyectados).
 * ============================================================= */
import { describe, it, expect, beforeEach } from 'vitest';
import { Matchmaking, toleranceFor } from './matchmaking.js';

let created: { mode: string; seatUsers: string[] }[];
let clock: number;
function make(): Matchmaking {
  created = [];
  clock = 0;
  let n = 0;
  return new Matchmaking(
    (mode, seatUsers) => {
      created.push({ mode, seatUsers });
      return `match-${++n}`;
    },
    () => clock,
  );
}

describe('matchmaking · tolerancia por espera', () => {
  it('el rango se ensancha con el tiempo', () => {
    expect(toleranceFor(0)).toBe(150);
    expect(toleranceFor(6 * 60_000)).toBe(400);
    expect(toleranceFor(12 * 60_000)).toBe(900);
    expect(toleranceFor(20 * 60_000)).toBe(Infinity);
  });
});

describe('Matchmaking', () => {
  let mm: Matchmaking;
  beforeEach(() => {
    mm = make();
  });

  it('1v1: empareja a dos de ELO cercano (dentro de ±150)', () => {
    expect(mm.join('a', 1000, '1v1').status).toBe('queued');
    const b = mm.join('b', 1100, '1v1');
    expect(b.status).toBe('matched');
    expect(created).toHaveLength(1);
  });

  it('1v1: NO empareja si el ELO está lejos… hasta que pasa el tiempo', () => {
    expect(mm.join('a', 1000, '1v1').status).toBe('queued');
    // 1400 está a 400 del 1000: fuera del rango inicial (±150).
    expect(mm.join('b', 1400, '1v1').status).toBe('queued');
    expect(created).toHaveLength(0);
    // Pasan 6 minutos: el rango del que más esperó ('a') sube a ±400 ⇒ empareja.
    clock = 6 * 60_000;
    const s = mm.status('a');
    expect(s.status).toBe('matched');
    expect(created).toHaveLength(1);
  });

  it('2v2: agrupa a los 4 más cercanos y equilibra A (pares) / B (impares)', () => {
    mm.join('r1000', 1000, '2v2');
    mm.join('r1040', 1040, '2v2');
    mm.join('r0980', 980, '2v2');
    const last = mm.join('r1020', 1020, '2v2');
    expect(last.status).toBe('matched');
    const seats = created[0]!.seatUsers;
    // Orden por rating desc: [1040,1020,1000,980] → A={1040,1000}, B={1020,980}.
    expect(seats[0]).toBe('r1040');
    expect(seats[2]).toBe('r1000');
    expect(seats[1]).toBe('r1020');
    expect(seats[3]).toBe('r0980');
  });

  it('salir de la cola evita el emparejamiento', () => {
    mm.join('a', 1000, '1v1');
    mm.leave('a');
    expect(mm.join('b', 1000, '1v1').status).toBe('queued');
    expect(created).toHaveLength(0);
  });

  it('volver a join estando emparejado devuelve la misma asignación', () => {
    mm.join('a', 1000, '1v1');
    mm.join('b', 1050, '1v1');
    expect(mm.join('a', 1000, '1v1').status).toBe('matched');
  });
});
