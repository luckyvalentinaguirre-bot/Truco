import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, type Seat } from '@/game';
import { humanOptions, statusText, isCardPlayable } from './matchView';

const HUMAN: Seat = 0;

describe('matchView (adaptador de vista)', () => {
  it('al inicio es el turno del humano y puede jugar sus 3 cartas', () => {
    const s = createMatch({ mode: '1v1', seed: 10 });
    const opts = humanOptions(s, HUMAN);
    expect(opts.playableCardIds).toHaveLength(3);
    expect(statusText(s, HUMAN)).toMatch(/tu turno/i);
  });

  it('tras jugar el humano, el estado pasa a turno del rival', () => {
    const s0 = createMatch({ mode: '1v1', seed: 10 });
    const card = s0.players[HUMAN].hand[0];
    const s1 = applyAction(s0, { type: 'PLAY_CARD', seat: HUMAN, card }).state;
    expect(statusText(s1, HUMAN)).toMatch(/rival/i);
    // Ya no es el turno del humano: no ofrece cartas jugables.
    expect(humanOptions(s1, HUMAN).playableCardIds).toHaveLength(0);
  });

  it('cuando el rival canta Truco, el humano puede aceptar o rechazar', () => {
    const s0 = createMatch({ mode: '1v1', seed: 10 });
    // El rival (asiento 1) canta Truco.
    const s1 = applyAction(s0, { type: 'CALL_TRUCO', seat: 1, call: 'truco' }).state;
    const opts = humanOptions(s1, HUMAN);
    expect(opts.canAccept).toBe(true);
    expect(opts.canDecline).toBe(true);
    expect(statusText(s1, HUMAN)).toMatch(/truco/i);
  });

  it('isCardPlayable refleja las opciones legales', () => {
    const s = createMatch({ mode: '1v1', seed: 10 });
    const opts = humanOptions(s, HUMAN);
    const c = s.players[HUMAN].hand[0];
    expect(isCardPlayable(opts, c.rank, c.suit)).toBe(true);
    // Una carta del rival no es jugable por el humano.
    const rival = s.players[1].hand[0];
    expect(isCardPlayable(opts, rival.rank, rival.suit)).toBe(false);
  });
});
