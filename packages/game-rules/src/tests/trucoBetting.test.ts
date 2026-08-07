import { describe, it, expect } from 'vitest';
import {
  initTrucoState,
  canCallTruco,
  callTruco,
  acceptTruco,
  declineTruco,
  trucoPointsAtStake,
} from '../trucoBetting.js';

describe('Cadena del Truco', () => {
  it('Truco aceptado ⇒ 2 puntos en juego', () => {
    let s = initTrucoState();
    s = callTruco(s, 'A', 'truco');
    s = acceptTruco(s, 'B');
    expect(trucoPointsAtStake(s)).toBe(2);
  });

  it('Truco rechazado ⇒ el que cantó gana 1', () => {
    let s = initTrucoState();
    s = callTruco(s, 'A', 'truco');
    const res = declineTruco(s, 'B');
    expect(res.winner).toBe('A');
    expect(res.points).toBe(1);
  });

  it('Retruco: B contra-canta, aceptado ⇒ 3 puntos', () => {
    let s = initTrucoState();
    s = callTruco(s, 'A', 'truco');
    s = callTruco(s, 'B', 'retruco'); // contra-canto sin aceptar
    s = acceptTruco(s, 'A');
    expect(trucoPointsAtStake(s)).toBe(3);
  });

  it('Vale 4: cadena completa aceptada ⇒ 4 puntos', () => {
    let s = initTrucoState();
    s = callTruco(s, 'A', 'truco');
    s = acceptTruco(s, 'B');
    s = callTruco(s, 'B', 'retruco');
    s = acceptTruco(s, 'A');
    s = callTruco(s, 'A', 'vale4');
    s = acceptTruco(s, 'B');
    expect(trucoPointsAtStake(s)).toBe(4);
  });

  it('rechazo de Retruco ⇒ el que subió gana 2', () => {
    let s = initTrucoState();
    s = callTruco(s, 'A', 'truco');
    s = acceptTruco(s, 'B');
    s = callTruco(s, 'B', 'retruco');
    const res = declineTruco(s, 'A');
    expect(res.winner).toBe('B');
    expect(res.points).toBe(2);
  });

  describe('acciones inválidas', () => {
    it('no se puede cantar Vale 4 antes del Retruco', () => {
      const s = callTruco(initTrucoState(), 'A', 'truco');
      expect(canCallTruco(s, 'B', 'vale4')).toBe(false);
      expect(() => callTruco(s, 'B', 'vale4')).toThrow();
    });

    it('el mismo equipo no puede subir de nuevo sin que el rival responda', () => {
      let s = initTrucoState();
      s = callTruco(s, 'A', 'truco');
      s = acceptTruco(s, 'B');
      // A ya cantó/aceptó; no puede subir A, debe subir B.
      expect(canCallTruco(s, 'A', 'retruco')).toBe(false);
      expect(canCallTruco(s, 'B', 'retruco')).toBe(true);
    });

    it('no se puede aceptar si no hay canto pendiente', () => {
      expect(() => acceptTruco(initTrucoState(), 'B')).toThrow();
    });

    it('el propio cantor no puede aceptar su canto', () => {
      const s = callTruco(initTrucoState(), 'A', 'truco');
      expect(() => acceptTruco(s, 'A')).toThrow();
    });
  });
});
