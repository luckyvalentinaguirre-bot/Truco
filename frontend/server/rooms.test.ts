import { describe, it, expect } from 'vitest';
import * as R from './rooms';

describe('salas LAN (lógica del servidor)', () => {
  it('cada modo necesita la cantidad correcta de asientos', () => {
    expect(R.neededSeats('1v1')).toBe(2);
    expect(R.neededSeats('2v2')).toBe(4);
    expect(R.neededSeats('3v3')).toBe(6);
  });

  it('2v2 arranca recién cuando se llenan los 4 asientos', () => {
    const room = R.createRoom<string>('AAAA', '2v2', 1);
    expect(R.addPlayer(room, 'a', 'Ana')).toBe(0);
    expect(R.addPlayer(room, 'b', 'Ben')).toBe(1);
    expect(R.addPlayer(room, 'c', 'Cé')).toBe(2);
    expect(R.startIfReady(room)).toBe(false);
    expect(R.addPlayer(room, 'd', 'Di')).toBe(3);
    expect(R.isFull(room)).toBe(true);
    expect(R.startIfReady(room)).toBe(true);
    expect(room.state?.players).toHaveLength(4);
  });

  it('no deja jugar por un asiento ajeno; el propio sí', () => {
    const room = R.createRoom<string>('BBBB', '1v1', 2);
    R.addPlayer(room, 'a', 'A');
    R.addPlayer(room, 'b', 'B');
    R.startIfReady(room);
    const mano = room.state!.hand.manoSeat;
    const other = mano === 0 ? 1 : 0;
    const card = room.state!.players[mano].hand[0];
    expect(() =>
      R.applyForSeat(room, other, { type: 'PLAY_CARD', seat: mano, card }),
    ).toThrow();
    const events = R.applyForSeat(room, mano, {
      type: 'PLAY_CARD',
      seat: mano,
      card,
    });
    expect(events.some((e) => e.type === 'CARD_PLAYED')).toBe(true);
  });

  it('libera el asiento al desconectarse', () => {
    const room = R.createRoom<string>('CCCC', '1v1', 3);
    R.addPlayer(room, 'a', 'A');
    expect(R.filledSeats(room)).toBe(1);
    expect(R.removePlayer(room, 'a')).toBe(0);
    expect(R.filledSeats(room)).toBe(0);
  });
});
