import { describe, it, expect } from 'vitest';
import type { Card } from '../types';
import type { MatchState } from '../state';
import { calcFlor } from '../flor';
import { createMatch } from '../setup';
import { applyAction } from '../engine';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

/** Estado 1v1 con manos y muestra forzadas, en ventana de flor. */
function forced(hand0: Card[], hand1: Card[], muestra: Card): MatchState {
  const base = createMatch({ mode: '1v1', seed: 1 });
  return {
    ...base,
    players: base.players.map((p, i) => ({
      ...p,
      hand: i === 0 ? hand0 : hand1,
      played: [],
      folded: false,
    })),
    hand: { ...base.hand, muestra, envidoWindowOpen: true },
  };
}

describe('calcFlor', () => {
  it('Caso 1: tres cartas del mismo palo ⇒ Flor; 7+6+3 = 36', () => {
    const r = calcFlor([c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], c(1, 'oro'));
    expect(r.hasFlor).toBe(true);
    expect(r.reason).toBe('tres_mismo_palo');
    expect(r.value).toBe(36);
  });

  it('Caso 2: dos piezas ⇒ Flor', () => {
    const muestra = c(7, 'oro'); // piezas: 2,4,5,11,10 de oro
    const r = calcFlor([c(2, 'oro'), c(4, 'oro'), c(6, 'copa')], muestra);
    expect(r.hasFlor).toBe(true);
    expect(r.reason).toBe('dos_piezas');
    // 20 + 10 (2 muestra) + 9 (4 muestra) + 6 = 45
    expect(r.value).toBe(45);
  });

  it('Caso 3: una pieza + dos cartas del mismo palo ⇒ Flor', () => {
    const muestra = c(7, 'oro'); // 5 de oro es pieza
    const r = calcFlor([c(5, 'oro'), c(6, 'copa'), c(4, 'copa')], muestra);
    expect(r.hasFlor).toBe(true);
    expect(r.reason).toBe('pieza_mas_dos_palo');
    // 20 + 8 (5 muestra) + 6 + 4 = 38
    expect(r.value).toBe(38);
  });

  it('mano sin Flor', () => {
    const r = calcFlor([c(1, 'espada'), c(6, 'copa'), c(4, 'basto')], c(3, 'oro'));
    expect(r.hasFlor).toBe(false);
    expect(r.value).toBe(0);
  });
});

describe('Puntaje de la Flor (motor)', () => {
  it('flor no disputada ⇒ el que la canta suma 3', () => {
    const s = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], // flor
      [c(1, 'espada'), c(6, 'copa'), c(4, 'basto')], // sin flor
      c(1, 'oro'),
    );
    const teamA = s.players[0].team;
    const { state, events } = applyAction(s, { type: 'CALL_FLOR', seat: 0 });
    expect(state.score[teamA]).toBe(3);
    expect(state.hand.flor.resolved).toBe(true);
    expect(events.some((e) => e.type === 'FLOR_RESOLVED')).toBe(true);
  });

  it('flor disputada: se abre el duelo; al aceptar gana la más alta y suma 6', () => {
    const s = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], // flor = 36
      [c(7, 'copa'), c(6, 'copa'), c(5, 'copa')], // flor = 38
      c(1, 'oro'),
    );
    const teamB = s.players[1].team;
    // Canta el que tiene la flor MÁS BAJA (asiento 0): NO se resuelve todavía.
    const s1 = applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state;
    expect(s1.hand.flor.pendingCall).toBe('flor');
    expect(s1.score[teamB]).toBe(0);
    // El rival con flor (asiento 1) acepta el duelo ⇒ gana la más alta (+6).
    const s2 = applyAction(s1, { type: 'ACCEPT', seat: 1 }).state;
    expect(s2.hand.flor.resolved).toBe(true);
    expect(s2.score[teamB]).toBe(6);
    expect(s2.score[s.players[0].team]).toBe(0);
  });

  it('Contraflor al resto QUERIDA ⇒ la flor más alta gana la falta', () => {
    const s = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], // flor = 36
      [c(7, 'copa'), c(6, 'copa'), c(5, 'copa')], // flor = 38
      c(1, 'oro'),
    );
    const teamB = s.players[1].team;
    const s1 = applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state;
    // El rival (asiento 1) sube a Contraflor al resto.
    const s2 = applyAction(s1, {
      type: 'CALL_FLOR',
      seat: 1,
      call: 'contraflor_resto',
    }).state;
    expect(s2.hand.flor.pendingCall).toBe('contraflor_resto');
    // El que cantó primero (asiento 0) acepta ⇒ gana la flor más alta (B) por
    // la falta (targetPoints - líder = 40 con marcador 0-0).
    const s3 = applyAction(s2, { type: 'ACCEPT', seat: 0 });
    expect(s3.state.hand.flor.resolved).toBe(true);
    // La partida se define: B alcanza el objetivo.
    expect(s3.state.score[teamB]).toBeGreaterThanOrEqual(40);
    expect(s3.state.phase).toBe('finished');
  });

  it('Contraflor al resto NO QUERIDA ⇒ el que la cantó se lleva 6', () => {
    const s = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], // flor = 36
      [c(7, 'copa'), c(6, 'copa'), c(5, 'copa')], // flor = 38
      c(1, 'oro'),
    );
    const teamB = s.players[1].team;
    const teamA = s.players[0].team;
    const s1 = applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state;
    const s2 = applyAction(s1, {
      type: 'CALL_FLOR',
      seat: 1,
      call: 'contraflor_resto',
    }).state;
    // El asiento 0 NO quiere ⇒ el que cantó Contraflor (B) se lleva 6.
    const s3 = applyAction(s2, { type: 'DECLINE', seat: 0 }).state;
    expect(s3.hand.flor.resolved).toBe(true);
    expect(s3.score[teamB]).toBe(6);
    expect(s3.score[teamA]).toBe(0);
  });

  it('no se puede cantar Flor sin tenerla', () => {
    const s = forced(
      [c(1, 'espada'), c(6, 'copa'), c(4, 'basto')],
      [c(1, 'espada'), c(6, 'copa'), c(4, 'basto')],
      c(3, 'oro'),
    );
    expect(() => applyAction(s, { type: 'CALL_FLOR', seat: 0 })).toThrow();
  });
});
