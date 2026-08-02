import { describe, it, expect } from 'vitest';
import { createMatch } from '../setup';
import { applyAction, startNextHand, legalActions } from '../engine';
import { calcFlor } from '../flor';
import type { MatchState } from '../state';

/** Lleva la partida al borde de ganar para poder testear el cierre. */
function nearWin(seed: number): MatchState {
  const base = createMatch({ mode: '1v1', seed });
  return { ...base, score: { A: 39, B: 0 } };
}

describe('Nueva mano automática (flujo del controlador)', () => {
  it('mano termina → marcador actualiza → nueva mano lista', () => {
    const s0 = createMatch({ mode: '1v1', seed: 21 });
    // El humano (mano) se va al mazo: el rival cobra 1.
    const s1 = applyAction(s0, { type: 'FOLD', seat: 0 }).state;
    expect(s1.hand.finished).toBe(true);
    expect(s1.score.B).toBe(1);

    const s2 = startNextHand(s1);
    expect(s2.hand.finished).toBe(false);
    expect(s2.handNumber).toBe(s1.handNumber + 1);
    expect(s2.players[0].hand).toHaveLength(3);
    expect(s2.players[1].hand).toHaveLength(3);
    expect(s2.hand.muestra).toBeDefined();
    // El marcador se conserva entre manos.
    expect(s2.score.B).toBe(1);
  });
});

describe('Fin de partida: no se inicia otra mano', () => {
  it('al llegar a 40 la partida termina y startNextHand no crea mano', () => {
    const s0 = nearWin(7); // A: 39
    // A (humano, mano) canta Truco, B no quiere ⇒ A suma 1 ⇒ 40.
    let s = applyAction(s0, { type: 'CALL_TRUCO', seat: 0, call: 'truco' }).state;
    s = applyAction(s, { type: 'DECLINE', seat: 1 }).state;
    expect(s.phase).toBe('finished');
    expect(s.winner).toBe('A');
    expect(() => startNextHand(s)).toThrow();
  });
});

describe('Flor bloquea el Envido', () => {
  it('si un jugador tiene Flor, cantar Envido no es legal', () => {
    // Buscar una semilla donde algún jugador tenga Flor en la primera mano.
    let found: MatchState | null = null;
    for (let seed = 1; seed < 400 && !found; seed++) {
      const s = createMatch({ mode: '1v1', seed });
      const someoneFlor = s.players.some(
        (p) => calcFlor(p.hand, s.hand.muestra).hasFlor,
      );
      if (someoneFlor) found = s;
    }
    expect(found).not.toBeNull();
    const state = found!;
    // Para el jugador en turno (mano), Envido no debe estar entre las legales.
    const seat = state.hand.turnSeat;
    const legal = legalActions(state, seat);
    expect(legal.some((a) => a.type === 'CALL_ENVIDO')).toBe(false);
  });
});
