import { describe, it, expect } from 'vitest';
import {
  initEnvidoState,
  callEnvido,
  acceptEnvido,
  declineEnvido,
  envidoPointsAtStake,
  canCallEnvido,
} from '../envidoBetting';

const scores = { A: 0, B: 0 };
const target = 40;

describe('Cadena del Envido', () => {
  it('Envido aceptado ⇒ 2 puntos', () => {
    let s = initEnvidoState();
    s = callEnvido(s, 'A', 'envido');
    s = acceptEnvido(s, 'B');
    expect(envidoPointsAtStake(s, scores, target)).toBe(2);
  });

  it('Envido + Envido = 4', () => {
    let s = initEnvidoState();
    s = callEnvido(s, 'A', 'envido');
    s = callEnvido(s, 'B', 'envido'); // revoque
    s = acceptEnvido(s, 'A');
    expect(envidoPointsAtStake(s, scores, target)).toBe(4);
  });

  it('Envido + Real Envido = 5', () => {
    let s = initEnvidoState();
    s = callEnvido(s, 'A', 'envido');
    s = callEnvido(s, 'B', 'real_envido');
    s = acceptEnvido(s, 'A');
    expect(envidoPointsAtStake(s, scores, target)).toBe(5);
  });

  it('rechazo del primer Envido ⇒ 1 punto para el cantor', () => {
    let s = initEnvidoState();
    s = callEnvido(s, 'A', 'envido');
    const res = declineEnvido(s, 'B', scores, target);
    expect(res.winner).toBe('A');
    expect(res.points).toBe(1);
  });

  it('rechazo de un aumento ⇒ se cobra lo previamente en juego', () => {
    let s = initEnvidoState();
    s = callEnvido(s, 'A', 'envido');
    s = acceptEnvido(s, 'B'); // 2 en juego
    s = callEnvido(s, 'B', 'real_envido');
    const res = declineEnvido(s, 'A', scores, target);
    expect(res.winner).toBe('B');
    expect(res.points).toBe(2);
  });

  it('Falta Envido depende del marcador', () => {
    let s = initEnvidoState();
    s = callEnvido(s, 'A', 'falta_envido');
    s = acceptEnvido(s, 'B');
    expect(envidoPointsAtStake(s, { A: 30, B: 12 }, 40)).toBe(10);
  });

  it('el mismo equipo no puede revocar su propio canto', () => {
    const s = callEnvido(initEnvidoState(), 'A', 'envido');
    expect(canCallEnvido(s, 'A', 'real_envido')).toBe(false);
  });

  it('Real Envido no admite un Envido posterior', () => {
    const s = callEnvido(initEnvidoState(), 'A', 'real_envido');
    expect(canCallEnvido(s, 'B', 'envido')).toBe(false);
    expect(canCallEnvido(s, 'B', 'falta_envido')).toBe(true);
  });
});
