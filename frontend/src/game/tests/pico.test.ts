import { describe, it, expect } from 'vitest';
import {
  createMatch,
  applyAction,
  actorNow,
  chooseAiAction,
  startNextHand,
  legalActions,
  initPicoActive,
  picoNextPair,
  picoPhaseActive,
  PICO_PAIRS,
  SHORT_30,
  type MatchState,
} from '../index';

const rng = () => 0.5;

/** Cuenta jugadores activos (no al mazo) en la mano actual. */
function activeCount(s: MatchState): number {
  return s.players.filter((p) => !p.folded).length;
}

describe('pico a pico · unidades', () => {
  it('el duelo es entre jugadores ENFRENTADOS (i ↔ i+3), no de al lado', () => {
    // Duelistas iniciales: par (0,3). Cruzan equipos: A=0, B=3.
    let a = initPicoActive();
    expect(a).toEqual({ A: 0, B: 3 });
    // Cada duelista tiene enfrente a su rival (diferencia de 3 asientos).
    expect(Math.abs(a.A - a.B)).toBe(3);
    // Ronda por medio: pasa al siguiente par enfrentado (1,4) → A=4, B=1.
    a = picoNextPair(a);
    expect(a).toEqual({ A: 4, B: 1 });
    expect(Math.abs(a.A - a.B)).toBe(3);
    // Siguiente par (2,5) → A=2, B=5.
    a = picoNextPair(a);
    expect(a).toEqual({ A: 2, B: 5 });
    // Vuelve al primero (circular).
    a = picoNextPair(a);
    expect(a).toEqual({ A: 0, B: 3 });
  });

  it('los tres pares enfrentados son (0,3), (1,4), (2,5)', () => {
    expect(PICO_PAIRS).toEqual([
      [0, 3],
      [1, 4],
      [2, 5],
    ]);
    // Cada par cruza equipos (uno par = A, uno impar = B).
    for (const [x, y] of PICO_PAIRS) {
      expect(x % 2).not.toBe(y % 2);
    }
  });

  it('picoPhaseActive: true en malas, false cuando un equipo entra a buenas', () => {
    const base = createMatch({ mode: '3v3', seed: 1, picoAPico: true, ruleset: SHORT_30 });
    expect(picoPhaseActive(base)).toBe(true);
    // SHORT_30: malas = 15.
    const enBuenas = { ...base, score: { A: 15, B: 8 } };
    expect(picoPhaseActive(enBuenas)).toBe(false);
  });
});

describe('pico a pico · reparto', () => {
  it('mientras hay malas, sólo 2 jugadores están activos (duelo 1v1)', () => {
    const s = createMatch({ mode: '3v3', seed: 1, picoAPico: true, ruleset: SHORT_30 });
    expect(s.picoAPico).toBe(true);
    expect(activeCount(s)).toBe(2);
    // Los dos activos son los duelistas al pico (uno de cada equipo).
    const active = s.players.filter((p) => !p.folded).map((p) => p.seat).sort();
    expect(active).toEqual([s.picoActive!.A, s.picoActive!.B].sort());
    // Cada duelista tiene 3 cartas; el resto ninguna.
    for (const p of s.players) {
      expect(p.hand.length).toBe(p.folded ? 0 : 3);
    }
    // El mano es uno de los duelistas.
    expect([s.picoActive!.A, s.picoActive!.B]).toContain(s.hand.manoSeat);
  });
});

describe('pico a pico · partida completa', () => {
  it('juega 1v1 en malas, pasa a 3v3 al entrar a buenas y termina con ganador', () => {
    let s = createMatch({ mode: '3v3', seed: 7, picoAPico: true, ruleset: SHORT_30 });
    const malas = s.ruleset.malas;
    let sawPico = false; // vimos al menos una mano con 2 activos
    let sawFull = false; // y al menos una con 6 activos (tras entrar a buenas)
    let guard = 0;

    while (s.phase !== 'finished') {
      if (++guard > 6000) throw new Error('bucle infinito en pico a pico');

      if (s.hand.finished) {
        s = startNextHand(s);
        continue;
      }
      // Invariante clave: en malas hay 2 activos; en buenas, los 6.
      const bothMalas = s.score.A < malas && s.score.B < malas;
      if (bothMalas) {
        expect(activeCount(s)).toBe(2);
        sawPico = true;
      } else {
        expect(activeCount(s)).toBe(6);
        sawFull = true;
      }

      const actor = actorNow(s);
      if (actor === null) throw new Error('actorNow=null con mano en curso');
      expect(legalActions(s, actor).length).toBeGreaterThan(0);
      const action = chooseAiAction(s, actor, rng, { difficulty: 'normal' });
      s = applyAction(s, action!).state;
    }

    expect(s.phase).toBe('finished');
    expect(s.winner === 'A' || s.winner === 'B').toBe(true);
    expect(sawPico).toBe(true);
    expect(sawFull).toBe(true);
  });

  it('varias semillas: la partida pico a pico siempre termina bien', () => {
    for (const seed of [1, 3, 11, 23, 42]) {
      let s = createMatch({ mode: '3v3', seed, picoAPico: true, ruleset: SHORT_30 });
      let guard = 0;
      while (s.phase !== 'finished') {
        if (++guard > 8000) throw new Error(`bucle en seed ${seed}`);
        if (s.hand.finished) {
          s = startNextHand(s);
          continue;
        }
        const actor = actorNow(s);
        if (actor === null) throw new Error(`actorNow=null seed ${seed}`);
        s = applyAction(s, chooseAiAction(s, actor, rng, { difficulty: 'normal' })!).state;
      }
      expect(s.winner === 'A' || s.winner === 'B').toBe(true);
      expect(s.score[s.winner!]).toBeGreaterThanOrEqual(s.ruleset.targetPoints);
    }
  });
});
