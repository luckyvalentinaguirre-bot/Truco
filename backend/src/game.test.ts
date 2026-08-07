import { describe, it, expect } from 'vitest';
import {
  createMatch,
  applyAction,
  actorNow,
  chooseAiAction,
  startNextHand,
  legalActions,
  type GameMode,
} from './game.js';

/* =============================================================
 * Verifica que el BACKEND ejecuta el MISMO Rules Engine compartido
 * (@truco/game-rules): juega partidas completas y comprueba reglas
 * básicas. Esto habilita al futuro servidor autoritativo a validar
 * las acciones con exactamente las mismas reglas que el frontend.
 * ============================================================= */

function playFullGame(mode: GameMode, seed: number) {
  let s = createMatch({ mode, seed });
  let guard = 0;
  while (s.phase !== 'finished') {
    if (++guard > 8000) throw new Error('bucle: la partida no termina');
    if (s.hand.finished) {
      s = startNextHand(s);
      continue;
    }
    const actor = actorNow(s);
    if (actor === null) throw new Error('actorNow=null con mano en curso');
    expect(legalActions(s, actor).length).toBeGreaterThan(0);
    const action = chooseAiAction(s, actor, () => 0.5, { difficulty: 'normal' });
    s = applyAction(s, action!).state;
  }
  return s;
}

describe('backend · Rules Engine compartido (@truco/game-rules)', () => {
  it('crea una partida con el estado inicial correcto', () => {
    const s = createMatch({ mode: '1v1', seed: 1 });
    expect(s.players).toHaveLength(2);
    expect(s.phase).toBe('playing');
    expect(s.score).toEqual({ A: 0, B: 0 });
    // Cada jugador arranca con 3 cartas.
    for (const p of s.players) expect(p.hand.length).toBe(3);
  });

  it('las acciones ilegales no se aplican silenciosamente', () => {
    const s = createMatch({ mode: '1v1', seed: 1 });
    const notInTurn = s.players.find((p) => p.seat !== s.hand.turnSeat)!;
    // Jugar una carta fuera de turno debe lanzar (motor autoritativo).
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', seat: notInTurn.seat, card: notInTurn.hand[0]! }),
    ).toThrow();
  });

  it('juega partidas completas (1v1/2v2/3v3) y termina con ganador válido', () => {
    for (const mode of ['1v1', '2v2', '3v3'] as GameMode[]) {
      const end = playFullGame(mode, 7);
      expect(end.phase).toBe('finished');
      expect(end.winner === 'A' || end.winner === 'B').toBe(true);
      expect(end.score[end.winner!]).toBeGreaterThanOrEqual(end.ruleset.targetPoints);
    }
  });
});
