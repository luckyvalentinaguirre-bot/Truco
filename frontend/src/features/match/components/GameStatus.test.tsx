// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMatch, type MatchState } from '@/game';
import { GameStatus } from './GameStatus';
import { ConnectionIndicator } from './ConnectionIndicator';

afterEach(cleanup);

describe('GameStatus', () => {
  it('muestra la modalidad y la ronda (fuera de pico)', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    render(<GameStatus state={s} humanSeat={0} />);
    expect(screen.getByText('2 vs 2')).toBeTruthy();
    expect(screen.getByText(/Ronda/)).toBeTruthy();
  });

  it('muestra "Mano: vos" cuando el humano es el mano (≠ turno)', () => {
    const base = createMatch({ mode: '3v3', seed: 1 });
    const s: MatchState = { ...base, hand: { ...base.hand, manoSeat: 0, turnSeat: 2 } };
    render(<GameStatus state={s} humanSeat={0} />);
    expect(screen.getByText('Mano: vos')).toBeTruthy();
  });

  it('en Pico a Pico muestra el enfrentamiento X/3', () => {
    const s = createMatch({ mode: '3v3', seed: 3, picoAPico: true });
    render(<GameStatus state={s} humanSeat={0} />);
    expect(screen.getByText(/Pico a Pico · 1\/3/)).toBeTruthy();
  });
});

describe('ConnectionIndicator', () => {
  it('muestra un texto legible (no sólo color) por estado', () => {
    render(<ConnectionIndicator state="reconnecting" />);
    expect(screen.getByText('Reconectando…')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
