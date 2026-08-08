/* =============================================================
 * §51 · ELO — escenarios controlados y documentados.
 * ============================================================= */
import { describe, it, expect } from 'vitest';
import {
  expectedScore,
  calculateRatingChange,
  resolveMatchRatings,
  teamAverage,
  DEFAULT_K,
  RATING_FLOOR,
} from './elo.js';

describe('ELO · expectedScore', () => {
  it('ratings iguales ⇒ 0.5', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });
  it('favorito tiene expectativa > 0.5', () => {
    expect(expectedScore(1800, 1200)).toBeGreaterThan(0.9);
    expect(expectedScore(1200, 1800)).toBeLessThan(0.1);
  });
});

describe('ELO · calculateRatingChange (1v1)', () => {
  it('1500 vs 1500: ganar suma ~K/2, perder resta ~K/2', () => {
    const win = calculateRatingChange(1500, 1500, true);
    const lose = calculateRatingChange(1500, 1500, false);
    expect(win.delta).toBe(Math.round(DEFAULT_K * 0.5)); // +16
    expect(lose.delta).toBe(-Math.round(DEFAULT_K * 0.5)); // -16
    // Suma cero en enfrentamiento simétrico.
    expect(win.delta + lose.delta).toBe(0);
  });

  it('favorito (1800) que gana a underdog (1200) suma poco', () => {
    const win = calculateRatingChange(1800, 1200, true);
    expect(win.delta).toBeGreaterThan(0);
    expect(win.delta).toBeLessThan(DEFAULT_K * 0.5); // menos que un empate de ratings
  });

  it('underdog (1200) que gana al favorito (1800) suma mucho', () => {
    const win = calculateRatingChange(1200, 1800, true);
    expect(win.delta).toBeGreaterThan(DEFAULT_K * 0.5);
    expect(win.delta).toBeLessThanOrEqual(DEFAULT_K);
  });

  it('nunca baja del piso', () => {
    const r = calculateRatingChange(RATING_FLOOR, 3000, false);
    expect(r.after).toBe(RATING_FLOOR);
    expect(r.delta).toBe(0);
  });
});

describe('ELO · equipos (2v2 / 3v3)', () => {
  it('teamAverage promedia y redondea', () => {
    expect(teamAverage([1000, 1200])).toBe(1100);
    expect(teamAverage([1000, 1000, 1300])).toBe(1100);
    expect(teamAverage([])).toBe(1000);
  });

  it('2v2 simétrico: ganadores +, perdedores −, mismo delta por integrante', () => {
    const res = resolveMatchRatings(
      { members: [{ userId: 'a', rating: 1500 }, { userId: 'b', rating: 1500 }] },
      { members: [{ userId: 'c', rating: 1500 }, { userId: 'd', rating: 1500 }] },
    );
    expect(res.winners.every((w) => w.delta === res.winners[0]!.delta)).toBe(true);
    expect(res.winners[0]!.delta).toBeGreaterThan(0);
    expect(res.losers[0]!.delta).toBeLessThan(0);
    expect(res.winners[0]!.delta + res.losers[0]!.delta).toBe(0);
  });

  it('3v3: el balance usa el promedio de cada equipo', () => {
    const strongWins = resolveMatchRatings(
      {
        members: [
          { userId: 'a', rating: 1900 },
          { userId: 'b', rating: 1900 },
          { userId: 'c', rating: 1900 },
        ],
      },
      {
        members: [
          { userId: 'd', rating: 1100 },
          { userId: 'e', rating: 1100 },
          { userId: 'f', rating: 1100 },
        ],
      },
    );
    // Equipo fuerte gana al débil ⇒ suma casi nada (favorito esperado).
    expect(strongWins.winners[0]!.delta).toBeGreaterThanOrEqual(0);
    expect(strongWins.winners[0]!.delta).toBeLessThan(DEFAULT_K * 0.5);
    // Y si el débil diera la sorpresa, ganaría mucho.
    const upset = resolveMatchRatings(
      { members: [{ userId: 'd', rating: 1100 }] },
      { members: [{ userId: 'a', rating: 1900 }] },
    );
    expect(upset.winners[0]!.delta).toBeGreaterThan(DEFAULT_K * 0.5);
  });
});
