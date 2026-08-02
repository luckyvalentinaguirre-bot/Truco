import { describe, it, expect } from 'vitest';
import { createMatch } from '../setup';
import { applyAction, startNextHand } from '../engine';
import type { MatchState } from '../state';
import type { Ruleset } from '../types';
import { OFFICIAL_40 } from '../ruleset';

/** Juega la mano actual tirando siempre la primera carta del turno. */
function playOutHand(state: MatchState): MatchState {
  let s = state;
  let guard = 0;
  while (!s.hand.finished && s.phase === 'playing') {
    if (guard++ > 50) throw new Error('bucle infinito en playOutHand');
    const seat = s.hand.turnSeat;
    const card = s.players[seat].hand[0];
    s = applyAction(s, { type: 'PLAY_CARD', seat, card }).state;
  }
  return s;
}

describe('Creación y reparto', () => {
  it('reparte 3 cartas a cada jugador y descubre una muestra', () => {
    const s = createMatch({ mode: '1v1', seed: 123 });
    expect(s.players).toHaveLength(2);
    expect(s.players[0].hand).toHaveLength(3);
    expect(s.players[1].hand).toHaveLength(3);
    expect(s.hand.muestra).toBeDefined();
    expect(s.hand.manoSeat).toBe(0);
    expect(s.hand.turnSeat).toBe(0);
  });

  it('es determinista para una misma semilla', () => {
    const a = createMatch({ seed: 999 });
    const b = createMatch({ seed: 999 });
    expect(a.players[0].hand).toEqual(b.players[0].hand);
    expect(a.hand.muestra).toEqual(b.hand.muestra);
  });

  it('reparte sin cartas repetidas (mano + muestra)', () => {
    const s = createMatch({ seed: 7 });
    const all = [...s.players.flatMap((p) => p.hand), s.hand.muestra];
    const ids = new Set(all.map((c) => `${c.rank}-${c.suit}`));
    expect(ids.size).toBe(all.length);
  });
});

describe('Juego de una mano y puntuación', () => {
  it('jugar la mano completa otorga al menos 1 punto y la cierra', () => {
    const s0 = createMatch({ mode: '1v1', seed: 42 });
    const s1 = playOutHand(s0);
    expect(s1.hand.finished).toBe(true);
    expect(s1.hand.winner).not.toBeNull();
    expect(s1.score.A + s1.score.B).toBe(1); // sin cantos: 1 punto
  });

  it('startNextHand rota el reparto y reparte de nuevo', () => {
    const s0 = createMatch({ mode: '1v1', seed: 42 });
    const s1 = playOutHand(s0);
    const s2 = startNextHand(s1);
    expect(s2.hand.finished).toBe(false);
    expect(s2.hand.manoSeat).toBe(1); // rotó
    expect(s2.players[0].hand).toHaveLength(3);
  });
});

describe('Truco dentro de la mano', () => {
  it('Truco aceptado ⇒ la mano vale 2 puntos', () => {
    const s0 = createMatch({ mode: '1v1', seed: 5 });
    let s = applyAction(s0, { type: 'CALL_TRUCO', seat: 0, call: 'truco' }).state;
    s = applyAction(s, { type: 'ACCEPT', seat: 1 }).state;
    s = playOutHand(s);
    expect(s.score.A + s.score.B).toBe(2);
  });

  it('Truco rechazado ⇒ el cantor gana 1 y termina la mano', () => {
    const s0 = createMatch({ mode: '1v1', seed: 5 });
    let s = applyAction(s0, { type: 'CALL_TRUCO', seat: 0, call: 'truco' }).state;
    const r = applyAction(s, { type: 'DECLINE', seat: 1 });
    s = r.state;
    expect(s.hand.finished).toBe(true);
    expect(s.score.A).toBe(1);
    expect(r.events.some((e) => e.type === 'HAND_ENDED')).toBe(true);
  });
});

describe('Irse al mazo', () => {
  it('otorga al rival los puntos en juego (1 sin cantos)', () => {
    const s0 = createMatch({ mode: '1v1', seed: 8 });
    const r = applyAction(s0, { type: 'FOLD', seat: 0 });
    expect(r.state.hand.finished).toBe(true);
    expect(r.state.score.B).toBe(1);
    expect(r.events.some((e) => e.type === 'PLAYER_FOLDED')).toBe(true);
  });
});

describe('Envido dentro de la mano', () => {
  // Reglamento sin Flor para aislar el Envido del bloqueo por Flor.
  const noFlor: Ruleset = { ...OFFICIAL_40, withFlor: false };

  it('Envido aceptado otorga puntos a algún equipo', () => {
    const s0 = createMatch({ mode: '1v1', seed: 3, ruleset: noFlor });
    let s = applyAction(s0, { type: 'CALL_ENVIDO', seat: 0, call: 'envido' }).state;
    const r = applyAction(s, { type: 'ACCEPT', seat: 1 });
    s = r.state;
    expect(s.score.A + s.score.B).toBe(2);
    expect(r.events.some((e) => e.type === 'ENVIDO_RESOLVED')).toBe(true);
  });

  it('Envido rechazado ⇒ el cantor gana 1', () => {
    const s0 = createMatch({ mode: '1v1', seed: 3, ruleset: noFlor });
    let s = applyAction(s0, { type: 'CALL_ENVIDO', seat: 0, call: 'envido' }).state;
    s = applyAction(s, { type: 'DECLINE', seat: 1 }).state;
    expect(s.score.A).toBe(1);
  });
});

describe('Acciones inválidas', () => {
  it('no se puede jugar fuera de turno', () => {
    const s = createMatch({ mode: '1v1', seed: 1 });
    const card = s.players[1].hand[0];
    expect(() => applyAction(s, { type: 'PLAY_CARD', seat: 1, card })).toThrow();
  });

  it('no se puede jugar una carta que no se tiene', () => {
    const s = createMatch({ mode: '1v1', seed: 1 });
    const foreign = s.players[1].hand[0]; // carta del rival
    expect(() => applyAction(s, { type: 'PLAY_CARD', seat: 0, card: foreign })).toThrow();
  });

  it('no se puede jugar mientras hay un canto pendiente', () => {
    const s0 = createMatch({ mode: '1v1', seed: 1 });
    const s = applyAction(s0, { type: 'CALL_TRUCO', seat: 0, call: 'truco' }).state;
    const card = s.players[0].hand[0];
    expect(() => applyAction(s, { type: 'PLAY_CARD', seat: 0, card })).toThrow();
  });

  it('no se puede cantar Vale 4 antes del Retruco', () => {
    const s0 = createMatch({ mode: '1v1', seed: 1 });
    const s = applyAction(s0, { type: 'CALL_TRUCO', seat: 0, call: 'truco' }).state;
    expect(() => applyAction(s, { type: 'CALL_TRUCO', seat: 1, call: 'vale4' })).toThrow();
  });
});

describe('Fin de partida', () => {
  it('la partida termina cuando un equipo alcanza el objetivo', () => {
    let s = createMatch({ mode: '1v1', seed: 11 });
    let guard = 0;
    while (s.phase === 'playing') {
      if (guard++ > 500) throw new Error('la partida no termina');
      s = playOutHand(s);
      if (s.phase === 'playing') s = startNextHand(s);
    }
    expect(s.phase).toBe('finished');
    expect(s.winner).not.toBeNull();
    const w = s.winner!;
    expect(s.score[w]).toBeGreaterThanOrEqual(OFFICIAL_40.targetPoints);
  });

  it('no se puede aplicar una acción con la partida terminada', () => {
    const finished: MatchState = {
      ...createMatch({ seed: 1 }),
      phase: 'finished',
      winner: 'A',
    };
    expect(() =>
      applyAction(finished, { type: 'FOLD', seat: 0 }),
    ).toThrow();
  });
});
