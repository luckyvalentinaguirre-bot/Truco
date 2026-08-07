/* =============================================================
 * Verificación de trazabilidad del REGLAMENTO del Truco Uruguayo.
 * -------------------------------------------------------------
 * Cada caso referencia la sección (§) del reglamento y comprueba que
 * el motor existente (@truco/game-rules) la respeta de forma exacta y
 * determinista. Los valores fueron verificados contra el código real.
 * ============================================================= */
import { describe, it, expect } from 'vitest';
import type { Card } from '../types.js';
import { buildDeck } from '../deck.js';
import { calcEnvido } from '../envido.js';
import { calcFlor } from '../flor.js';
import { resolveHand } from '../tricks.js';
import { envidoWinnerFrom } from '../engine.js';
import {
  initEnvidoState,
  callEnvido,
  declineEnvido,
  canCallEnvido,
} from '../envidoBetting.js';
import { initTrucoState, canCallTruco } from '../trucoBetting.js';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('Reglamento · Baraja (§3, §4)', () => {
  it('baraja española de 40 cartas, sin 8 ni 9, 4 palos', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(40);
    // El tipo Rank ni siquiera admite 8/9; lo comprobamos también en runtime.
    expect(deck.some((x) => (x.rank as number) === 8 || (x.rank as number) === 9)).toBe(false);
    expect(new Set(deck.map((x) => x.suit)).size).toBe(4);
  });
});

describe('Reglamento · Piezas (§5)', () => {
  const muestra = c(1, 'espada');
  it('el 2 de la muestra ES pieza (aporta al envido)', () => {
    // 2 de espada (pieza=30) → envido con una sola pieza = 36 verificado.
    expect(calcEnvido([c(2, 'espada'), c(6, 'copa'), c(4, 'basto')], muestra).value).toBe(36);
  });
  it('el 12 del palo de la muestra NO es pieza', () => {
    // 12 (figura) + 6, mismo palo espada: 20 + 0 + 6 = 26 (no lo trata como pieza).
    expect(calcEnvido([c(12, 'espada'), c(6, 'espada'), c(4, 'basto')], muestra).value).toBe(26);
  });
});

describe('Reglamento · Envido (§7, §11, §12, §13, §25)', () => {
  it('las figuras (10,11,12) valen 0 tantos (§7)', () => {
    expect(calcEnvido([c(10, 'copa'), c(11, 'copa'), c(4, 'basto')], c(3, 'oro')).value).toBe(20);
  });

  it('tras el máximo ordinario sólo se puede Falta Envido (§11, §12)', () => {
    let s = initEnvidoState();
    s = callEnvido(s, 'A', 'envido');
    s = callEnvido(s, 'B', 'real_envido');
    // Después de Real Envido: sólo Falta Envido (no otro envido/real).
    expect(canCallEnvido(s, 'A', 'envido')).toBe(false);
    expect(canCallEnvido(s, 'A', 'real_envido')).toBe(false);
    expect(canCallEnvido(s, 'A', 'falta_envido')).toBe(true);
    // Tras Falta Envido no hay más aumentos (§12).
    s = callEnvido(s, 'A', 'falta_envido');
    expect(canCallEnvido(s, 'B', 'falta_envido')).toBe(false);
    expect(canCallEnvido(s, 'B', 'real_envido')).toBe(false);
  });

  it('cadena Envido+Envido y "No quiero" cobra la cadena previa (§13)', () => {
    // A Envido, B Envido, A No quiero ⇒ B cobra 2 (el envido previo), NO 1.
    let s = initEnvidoState();
    s = callEnvido(s, 'A', 'envido');
    s = callEnvido(s, 'B', 'envido');
    const r = declineEnvido(s, 'A', { A: 0, B: 0 }, 30);
    expect(r.winner).toBe('B');
    expect(r.points).toBe(2);
  });

  it('empate de tantos ⇒ gana el de mayor prioridad de mano (§25)', () => {
    // mano = asiento 0 (equipo A); ambos con 28 ⇒ gana A (más mano).
    const winner = envidoWinnerFrom(
      [{ seat: 0, team: 'A', value: 28 }, { seat: 1, team: 'B', value: 28 }],
      0,
      2,
    );
    expect(winner).toBe('A');
  });
});

describe('Reglamento · Flor (§14, §24)', () => {
  it('la Flor se detecta automáticamente (§14)', () => {
    expect(calcFlor([c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], c(1, 'oro')).hasFlor).toBe(true);
    expect(calcFlor([c(1, 'espada'), c(6, 'copa'), c(4, 'basto')], c(3, 'oro')).hasFlor).toBe(false);
  });
  it('a igual valor de Flor gana la prioridad de mano (§24)', () => {
    // Misma prioridad que el envido: menor rango de mano gana el desempate.
    const winner = envidoWinnerFrom(
      [{ seat: 2, team: 'A', value: 30 }, { seat: 3, team: 'B', value: 30 }],
      0,
      4,
    );
    expect(winner).toBe('A'); // asiento 2 (rank 2) es más mano que 3 (rank 3)
  });
});

describe('Reglamento · Truco (§26, §27, §28)', () => {
  it('el equipo que cantó Truco NO puede Retruco; el rival SÍ (§27)', () => {
    const t = { ...initTrucoState(), level: 'truco' as const, pending: true, callerTeam: 'A' as const };
    expect(canCallTruco(t, 'A', 'retruco')).toBe(false); // compañeros del cantor
    expect(canCallTruco(t, 'B', 'retruco')).toBe(true); // rival
  });

  it('Vale Cuatro es el nivel máximo (§28)', () => {
    // Con Vale Cuatro aceptado ya no hay canto superior posible.
    const t = { ...initTrucoState(), level: 'vale4' as const, acceptedLevel: 'vale4' as const, callerTeam: 'A' as const };
    for (const call of ['truco', 'retruco', 'vale4'] as const) {
      expect(canCallTruco(t, 'B', call)).toBe(false);
    }
  });
});

describe('Reglamento · Parda (§31, §32)', () => {
  it('Parda / gana / gana ⇒ gana ese equipo', () => {
    expect(resolveHand(['parda', 'A', 'A'], 'B')).toBe('A');
    expect(resolveHand(['parda', 'A'], 'B')).toBe('A'); // decide en la 2ª
  });
  it('Parda / Parda / gana ⇒ gana el que ganó la 3ª', () => {
    expect(resolveHand(['parda', 'parda', 'A'], 'B')).toBe('A');
  });
  it('tres Pardas ⇒ gana el Mano (§32, §33)', () => {
    expect(resolveHand(['parda', 'parda', 'parda'], 'B')).toBe('B');
    expect(resolveHand(['parda', 'parda', 'parda'], 'A')).toBe('A');
  });
});
