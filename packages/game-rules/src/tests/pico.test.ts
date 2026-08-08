/* =============================================================
 * PICO A PICO — integrado en el motor (spec definitiva).
 * Verifica el flujo real que juega el cliente: 3v3 normal → ronda de pico
 * (reparto único, mazo congelado, tantos ocultos) → revelación → 3v3, y el
 * corte del ciclo al entrar a buenas. NO son tres partidas separadas.
 * ============================================================= */
import { describe, it, expect } from 'vitest';
import {
  createMatch,
  applyAction,
  actorNow,
  chooseAiAction,
  startNextHand,
  picoPhaseActive,
  SHORT_30,
  type MatchState,
} from '../index.js';

const rng = () => 0.5;

function activeCount(s: MatchState): number {
  return s.players.filter((p) => !p.folded).length;
}

/** Juega hasta que la mano/duelo en curso termine (o la partida). */
function playCurrentHand(s: MatchState): MatchState {
  let guard = 0;
  while (!s.hand.finished && s.phase !== 'finished') {
    if (++guard > 500) throw new Error('bucle en mano');
    const actor = actorNow(s);
    if (actor === null) throw new Error('actorNow=null');
    s = applyAction(s, chooseAiAction(s, actor, rng, { difficulty: 'normal' })!).state;
  }
  return s;
}

describe('pico a pico · arranque en 3v3 normal', () => {
  it('la partida NO entra directo al pico: la primera mano es 3v3 normal (6 activos)', () => {
    const s = createMatch({ mode: '3v3', seed: 1, picoAPico: true, ruleset: SHORT_30 });
    expect(s.picoAPico).toBe(true);
    expect(s.picoRound).toBeUndefined();
    expect(activeCount(s)).toBe(6);
  });
});

describe('pico a pico · ronda con reparto único y mazo congelado', () => {
  it('tras la mano normal entra el pico: 2 duelistas, mazo fijo en los 3 duelos', () => {
    let s = createMatch({ mode: '3v3', seed: 7, picoAPico: true, ruleset: SHORT_30 });
    s = playCurrentHand(s); // mano normal 3v3
    s = startNextHand(s); // rota mazo + COMIENZA pico (duelo 1)
    expect(s.picoRound).toBeDefined();
    expect(activeCount(s)).toBe(2);

    const deckPositions: number[] = [];
    for (let duel = 0; duel < 3; duel++) {
      expect(s.picoRound).toBeDefined();
      deckPositions.push(s.picoRound!.deckPosition);
      expect(activeCount(s)).toBe(2);
      s = playCurrentHand(s);
      s = startNextHand(s); // avanza al siguiente duelo o revela
    }
    // El mazo no se movió durante los tres duelos.
    expect(deckPositions).toEqual([18, 18, 18]);
    // Tras la revelación, volvió a 3v3 normal (o terminó la partida).
    expect(s.picoRound).toBeUndefined();
    if (s.phase !== 'finished') expect(activeCount(s)).toBe(6);
  });

  it('los tantos del duelo quedan OCULTOS: el marcador público no cambia durante los duelos', () => {
    let s = createMatch({ mode: '3v3', seed: 3, picoAPico: true, ruleset: SHORT_30 });
    s = playCurrentHand(s);
    const publicBefore = { ...s.score };
    s = startNextHand(s); // entra al pico
    expect(s.picoPublic).toEqual(publicBefore);
    // Durante los duelos, el marcador público (picoPublic) se mantiene.
    for (let duel = 0; duel < 3; duel++) {
      expect(s.picoPublic).toEqual(publicBefore);
      s = playCurrentHand(s);
      const stillPico = duel < 2;
      s = startNextHand(s);
      if (stillPico) expect(s.picoPublic).toEqual(publicBefore);
    }
    // En la revelación, los tantos ocultos se aplicaron al marcador público real.
    expect(s.picoPublic).toBeUndefined();
    expect(s.score.A + s.score.B).toBeGreaterThanOrEqual(publicBefore.A + publicBefore.B);
  });
});

describe('pico a pico · viaje del mazo (dealerSeat)', () => {
  it('rota al entrar al pico, queda FIJO en los 3 duelos y rota una vez al terminar', () => {
    const n = 6;
    let s = createMatch({ mode: '3v3', seed: 7, picoAPico: true, ruleset: SHORT_30 });
    s = playCurrentHand(s); // mano normal 3v3
    const dealerNormal = s.dealerSeat;
    s = startNextHand(s); // entra al pico: el mazo VIAJA una vez
    expect(s.picoRound).toBeDefined();
    const dealerPico = s.dealerSeat;
    expect(dealerPico).toBe((dealerNormal + 1) % n);

    // Durante los tres duelos el mazo NO se mueve.
    for (let duel = 0; duel < 3; duel++) {
      expect(s.dealerSeat).toBe(dealerPico);
      s = playCurrentHand(s);
      s = startNextHand(s);
    }
    // Terminados los tres duelos, volvió a 3v3 y el mazo viajó UN lugar más.
    if (s.phase !== 'finished') {
      expect(s.picoRound).toBeUndefined();
      expect(s.dealerSeat).toBe((dealerPico + 1) % n);
    }
  });
});

describe('pico a pico · partida completa', () => {
  it('juega alternando 3v3 y pico, y termina con un ganador', () => {
    for (const seed of [1, 7, 11, 23, 42]) {
      let s = createMatch({ mode: '3v3', seed, picoAPico: true, ruleset: SHORT_30 });
      let guard = 0;
      let sawPico = false;
      let sawNormal6 = false;
      while (s.phase !== 'finished') {
        if (++guard > 12000) throw new Error(`bucle seed ${seed}`);
        if (s.picoRound) sawPico = true;
        else if (activeCount(s) === 6) sawNormal6 = true;
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
      expect(sawPico).toBe(true);
      expect(sawNormal6).toBe(true);
    }
  });

  it('picoPhaseActive refleja malas/buenas', () => {
    const base = createMatch({ mode: '3v3', seed: 1, picoAPico: true, ruleset: SHORT_30 });
    expect(picoPhaseActive(base)).toBe(true);
    expect(picoPhaseActive({ ...base, score: { A: 15, B: 8 } })).toBe(false);
  });
});
