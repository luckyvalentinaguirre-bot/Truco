// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMatch, type MatchState } from '@/game';
import { useTeammatePeek } from './useTeammatePeek';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const base = createMatch({ mode: '2v2', seed: 1 }); // A={0,2}, B={1,3}

describe('useTeammatePeek', () => {
  it('revela al compañero y lo oculta EXACTAMENTE a los 5 s', () => {
    const { result } = renderHook(() => useTeammatePeek(base, 0));
    expect(result.current.peekReveal).toHaveLength(0);
    act(() => result.current.peek(2)); // compañero
    expect(result.current.peekedSeat).toBe(2);
    expect(result.current.peekReveal[0]?.cards).toEqual(base.players[2].hand);
    act(() => vi.advanceTimersByTime(4999));
    expect(result.current.peekedSeat).toBe(2); // aún visible
    act(() => vi.advanceTimersByTime(2));
    expect(result.current.peekedSeat).toBeNull(); // oculto a los 5 s
  });

  it('NO revela a un rival', () => {
    const { result } = renderHook(() => useTeammatePeek(base, 0));
    act(() => result.current.peek(1)); // rival
    expect(result.current.peekedSeat).toBeNull();
    act(() => result.current.peek(3)); // rival
    expect(result.current.peekedSeat).toBeNull();
  });

  it('re-tap reinicia el temporizador (no se acumulan timers)', () => {
    const { result } = renderHook(() => useTeammatePeek(base, 0));
    act(() => result.current.peek(2));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.peek(2)); // re-tap a los 3 s → reinicia
    act(() => vi.advanceTimersByTime(3000)); // 3 s desde el reinicio → visible
    expect(result.current.peekedSeat).toBe(2);
    act(() => vi.advanceTimersByTime(2001)); // completa los 5 s → oculto
    expect(result.current.peekedSeat).toBeNull();
  });

  it('cambiar de compañero muestra sólo uno (una visualización activa)', () => {
    const s = createMatch({ mode: '3v3', seed: 1 }); // A={0,2,4}
    const { result } = renderHook(() => useTeammatePeek(s, 0));
    act(() => result.current.peek(2));
    expect(result.current.peekedSeat).toBe(2);
    act(() => result.current.peek(4)); // cambia de compañero
    expect(result.current.peekedSeat).toBe(4);
    expect(result.current.peekReveal).toHaveLength(1);
  });

  it('nueva mano cancela la visualización', () => {
    let state: MatchState = base;
    const { result, rerender } = renderHook(() => useTeammatePeek(state, 0));
    act(() => result.current.peek(2));
    expect(result.current.peekedSeat).toBe(2);
    // Simula nuevo reparto (cambia handNumber).
    state = { ...base, handNumber: base.handNumber + 1 };
    rerender();
    expect(result.current.peekedSeat).toBeNull();
  });

  it('fin de partida oculta de inmediato', () => {
    let state: MatchState = base;
    const { result, rerender } = renderHook(() => useTeammatePeek(state, 0));
    act(() => result.current.peek(2));
    state = { ...base, phase: 'finished', winner: 'A' };
    rerender();
    expect(result.current.peekedSeat).toBeNull();
  });
});
