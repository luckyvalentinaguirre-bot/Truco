import { describe, it, expect } from 'vitest';
import type { Card, TeamId, TrickOutcome } from '../types.js';
import { resolveTrick, resolveHand, type Play } from '../tricks.js';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const play = (seat: number, team: TeamId, card: Card): Play => ({ seat, team, card });

describe('resolveTrick', () => {
  const muestra = c(6, 'copa');
  it('gana la carta de mayor fuerza', () => {
    const r = resolveTrick([play(0, 'A', c(3, 'oro')), play(1, 'B', c(2, 'oro'))], muestra);
    expect(r.outcome).toBe('A');
    expect(r.winnerSeat).toBe(0);
  });
  it('cartas de igual fuerza y distinto equipo ⇒ parda', () => {
    const r = resolveTrick([play(0, 'A', c(3, 'oro')), play(1, 'B', c(3, 'basto'))], muestra);
    expect(r.outcome).toBe('parda');
    expect(r.winnerSeat).toBeNull();
  });
  it('en 2v2, empate en la cima del mismo equipo ⇒ gana ese equipo', () => {
    const r = resolveTrick(
      [
        play(0, 'A', c(3, 'oro')),
        play(1, 'B', c(6, 'oro')),
        play(2, 'A', c(3, 'basto')),
        play(3, 'B', c(5, 'oro')),
      ],
      muestra,
    );
    expect(r.outcome).toBe('A');
    expect(r.winnerSeat).toBe(0);
  });
});

describe('resolveHand — pardas y ventaja de la mano', () => {
  const A: TeamId = 'A';

  it('ganador normal 2 de 3', () => {
    expect(resolveHand(['A', 'B', 'A'], A)).toBe('A');
  });
  it('victoria automática tras ganar las dos primeras', () => {
    expect(resolveHand(['A', 'A'], A)).toBe('A');
  });
  it('baza ganada + parda posterior ⇒ gana quien había ganado', () => {
    expect(resolveHand(['A', 'parda'], A)).toBe('A');
  });
  it('primera parda ⇒ la segunda es decisiva', () => {
    expect(resolveHand(['parda'], A)).toBeNull();
    expect(resolveHand(['parda', 'B'], A)).toBe('B');
  });
  it('1-1 y tercera parda ⇒ gana quien ganó la primera', () => {
    expect(resolveHand(['A', 'B', 'parda'], A)).toBe('A');
  });
  it('dos pardas y luego una ganada ⇒ gana esa', () => {
    expect(resolveHand(['parda', 'parda', 'B'], A)).toBe('B');
  });
  it('tres pardas ⇒ gana la mano', () => {
    expect(resolveHand(['parda', 'parda', 'parda'], A)).toBe('A');
    expect(resolveHand(['parda', 'parda', 'parda'], 'B')).toBe('B');
  });
  it('no decide con una sola baza ganada', () => {
    expect(resolveHand(['A'], A)).toBeNull();
  });

  it('cobertura de outcomes tipados', () => {
    const seq: TrickOutcome[] = ['A', 'parda'];
    expect(resolveHand(seq, A)).toBe('A');
  });
});
