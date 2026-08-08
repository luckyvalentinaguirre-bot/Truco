import { describe, it, expect } from 'vitest';
import { createMatch } from '../setup.js';
import { applyAction, actorNow, startNextHand } from '../engine.js';
import { chooseAiAction } from '../ai.js';
import {
  canToca,
  teammatesOf,
  isLastTeammateToAct,
  canSelectTeammate,
  canPeekTeammate,
  teammatePeekCards,
} from '../teamplay.js';
import type { MatchState } from '../state.js';

/** Fuerza el mano de una mano ya repartida (sin tocar cartas). */
function withMano(s: MatchState, manoSeat: number): MatchState {
  return { ...s, hand: { ...s.hand, manoSeat, turnSeat: manoSeat } };
}

describe('teamplay · TOCA', () => {
  it('2v2: los DOS jugadores de cada equipo pueden TOCA', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    // Asientos 0,2 = A ; 1,3 = B.
    for (const seat of [0, 1, 2, 3]) expect(canToca(s, seat)).toBe(true);
  });

  it('3v3: los TRES jugadores de cada equipo pueden TOCA', () => {
    const s = createMatch({ mode: '3v3', seed: 1 });
    for (const seat of [0, 1, 2, 3, 4, 5]) expect(canToca(s, seat)).toBe(true);
  });

  it('1v1: TOCA de equipo NO disponible (no hay compañero)', () => {
    const s = createMatch({ mode: '1v1', seed: 1 });
    expect(canToca(s, 0)).toBe(false);
    expect(canToca(s, 1)).toBe(false);
  });

  it('no disponible si la partida terminó', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    const finished: MatchState = { ...s, phase: 'finished', winner: 'A' };
    expect(canToca(finished, 0)).toBe(false);
  });
});

describe('teamplay · compañeros', () => {
  it('2v2: cada jugador tiene EXACTAMENTE un compañero, del mismo equipo', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    expect(teammatesOf(s, 0)).toEqual([2]); // A: 0 y 2
    expect(teammatesOf(s, 2)).toEqual([0]);
    expect(teammatesOf(s, 1)).toEqual([3]); // B: 1 y 3
    // Nunca incluye rivales.
    expect(teammatesOf(s, 0)).not.toContain(1);
  });

  it('3v3: cada jugador tiene DOS compañeros, del mismo equipo', () => {
    const s = createMatch({ mode: '3v3', seed: 1 });
    expect(teammatesOf(s, 0)).toEqual([2, 4]); // A
    expect(teammatesOf(s, 3)).toEqual([1, 5]); // B
    for (const rival of [1, 3, 5]) expect(teammatesOf(s, 0)).not.toContain(rival);
  });

  it('1v1: sin compañeros', () => {
    const s = createMatch({ mode: '1v1', seed: 1 });
    expect(teammatesOf(s, 0)).toEqual([]);
  });
});

describe('teamplay · último jugador del equipo (orden real)', () => {
  it('2v2: el último del equipo es el de mayor rango de mano (no la posición)', () => {
    let s = createMatch({ mode: '2v2', seed: 1 });
    // Mano = asiento 0 ⇒ orden 0,1,2,3. Equipo A = {0,2}: último = 2.
    s = withMano(s, 0);
    expect(isLastTeammateToAct(s, 2)).toBe(true);
    expect(isLastTeammateToAct(s, 0)).toBe(false);
    expect(canSelectTeammate(s, 2)).toBe(true);
    expect(canSelectTeammate(s, 0)).toBe(false);
    // Si el mano pasa al asiento 2 ⇒ orden 2,3,0,1. Equipo A={2,0}: último = 0.
    s = withMano(s, 2);
    expect(isLastTeammateToAct(s, 0)).toBe(true);
    expect(isLastTeammateToAct(s, 2)).toBe(false);
  });

  it('3v3: el último del equipo cambia con el mano', () => {
    let s = createMatch({ mode: '3v3', seed: 1 });
    s = withMano(s, 0); // orden 0..5, A={0,2,4} último=4
    expect(isLastTeammateToAct(s, 4)).toBe(true);
    expect(canSelectTeammate(s, 4)).toBe(true);
    expect(isLastTeammateToAct(s, 0)).toBe(false);
    s = withMano(s, 1); // orden 1,2,3,4,5,0 ; A={2,4,0} ranks 1,3,5 → último=0
    expect(isLastTeammateToAct(s, 0)).toBe(true);
    expect(isLastTeammateToAct(s, 4)).toBe(false);
  });

  it('1v1: no hay "último de equipo" ni selección', () => {
    const s = createMatch({ mode: '1v1', seed: 1 });
    expect(isLastTeammateToAct(s, 0)).toBe(false);
    expect(canSelectTeammate(s, 0)).toBe(false);
  });
});

describe('teamplay · peek (privacidad)', () => {
  it('2v2: un jugador puede ver a su compañero, nunca a rivales', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    expect(canPeekTeammate(s, 0, 2)).toBe(true); // A ve A
    expect(canPeekTeammate(s, 2, 0)).toBe(true);
    expect(canPeekTeammate(s, 0, 1)).toBe(false); // A→B rival
    expect(canPeekTeammate(s, 0, 3)).toBe(false);
    expect(canPeekTeammate(s, 0, 0)).toBe(false); // no a sí mismo
  });

  it('3v3: ve a sus dos compañeros, nunca a los tres rivales', () => {
    const s = createMatch({ mode: '3v3', seed: 1 });
    for (const mate of [2, 4]) expect(canPeekTeammate(s, 0, mate)).toBe(true);
    for (const rival of [1, 3, 5]) expect(canPeekTeammate(s, 0, rival)).toBe(false);
  });

  it('1v1: peek no disponible', () => {
    const s = createMatch({ mode: '1v1', seed: 1 });
    expect(canPeekTeammate(s, 0, 1)).toBe(false);
  });

  it('teammatePeekCards devuelve SÓLO las cartas del objetivo autorizado', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    const cards = teammatePeekCards(s, 0, 2);
    expect(cards).toHaveLength(3);
    expect(cards).toEqual(s.players[2].hand);
    // Es una copia (no la referencia interna).
    expect(cards).not.toBe(s.players[2].hand);
  });

  it('teammatePeekCards LANZA para un rival (nunca filtra cartas)', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    expect(() => teammatePeekCards(s, 0, 1)).toThrow();
    expect(() => teammatePeekCards(s, 0, 3)).toThrow();
  });

  it('pico a pico: no se pueden ver las cartas de un compañero que NO está al pico', () => {
    // Arranca 3v3 normal: jugamos esa mano y entramos a la ronda de pico.
    let s = createMatch({ mode: '3v3', seed: 3, picoAPico: true });
    let guard = 0;
    while (!s.hand.finished && s.phase !== 'finished') {
      if (++guard > 500) throw new Error('bucle');
      const actor = actorNow(s)!;
      s = applyAction(s, chooseAiAction(s, actor, () => 0.5, { difficulty: 'normal' })!).state;
    }
    s = startNextHand(s); // ronda de pico: 2 duelistas activos, el resto al mazo
    // En pico, sólo 2 duelistas activos; el resto folded (sin cartas).
    const active = s.players.filter((p) => !p.folded).map((p) => p.seat);
    expect(active.length).toBe(2);
    const duelistA = s.players.find((p) => !p.folded && p.team === 'A')!.seat;
    // Sus compañeros de equipo A están folded ⇒ no se pueden ver.
    const foldedMateA = s.players.find((p) => p.folded && p.team === 'A')!.seat;
    expect(canPeekTeammate(s, duelistA, foldedMateA)).toBe(false);
    expect(() => teammatePeekCards(s, duelistA, foldedMateA)).toThrow();
    // Y jamás al rival que está al pico.
    const duelistB = s.players.find((p) => !p.folded && p.team === 'B')!.seat;
    expect(canPeekTeammate(s, duelistA, duelistB)).toBe(false);
  });
});
