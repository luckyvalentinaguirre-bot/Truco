import { describe, it, expect } from 'vitest';
import type { Card } from '../types';
import type { MatchState } from '../state';
import { calcFlor } from '../flor';
import { createMatch } from '../setup';
import { applyAction, legalActions } from '../engine';

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

  it('flor disputada: se abre el duelo; al aceptar gana la más alta y suma 3', () => {
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
    // El rival con flor (asiento 1) acepta el duelo ⇒ gana la más alta (+3).
    const s2 = applyAction(s1, { type: 'ACCEPT', seat: 1 }).state;
    expect(s2.hand.flor.resolved).toBe(true);
    expect(s2.score[teamB]).toBe(3);
    expect(s2.score[s.players[0].team]).toBe(0);
  });

  it('Con Flor Envido QUERIDO ⇒ gana la flor más alta y suma 5', () => {
    const s = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], // flor = 36
      [c(7, 'copa'), c(6, 'copa'), c(5, 'copa')], // flor = 38
      c(1, 'oro'),
    );
    const teamB = s.players[1].team;
    const s1 = applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state;
    // El rival (asiento 1) sube a Con Flor Envido.
    const s2 = applyAction(s1, {
      type: 'CALL_FLOR',
      seat: 1,
      call: 'contraflor_envido',
    }).state;
    expect(s2.hand.flor.pendingCall).toBe('contraflor_envido');
    // El asiento 0 quiere ⇒ gana la flor más alta (B), +5.
    const s3 = applyAction(s2, { type: 'ACCEPT', seat: 0 }).state;
    expect(s3.hand.flor.resolved).toBe(true);
    expect(s3.score[teamB]).toBe(5);
  });

  it('Con Flor Envido NO QUERIDO ⇒ el que lo cantó se lleva 3 (la flor)', () => {
    const s = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')],
      [c(7, 'copa'), c(6, 'copa'), c(5, 'copa')],
      c(1, 'oro'),
    );
    const teamB = s.players[1].team;
    const s1 = applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state;
    const s2 = applyAction(s1, {
      type: 'CALL_FLOR',
      seat: 1,
      call: 'contraflor_envido',
    }).state;
    const s3 = applyAction(s2, { type: 'DECLINE', seat: 0 }).state;
    expect(s3.score[teamB]).toBe(3);
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

  it('Contraflor al resto (tras la flor) NO QUERIDA ⇒ el que la cantó se lleva 3', () => {
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
    // No hubo Con Flor Envido en el medio ⇒ el nivel en la mesa era la Flor (3).
    const s3 = applyAction(s2, { type: 'DECLINE', seat: 0 }).state;
    expect(s3.hand.flor.resolved).toBe(true);
    expect(s3.score[teamB]).toBe(3);
    expect(s3.score[teamA]).toBe(0);
  });

  it('cadena Flor→Con Flor Envido→Contraflor al resto: no querida se paga 5', () => {
    const s = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], // flor 36
      [c(7, 'copa'), c(6, 'copa'), c(5, 'copa')], // flor 38
      c(1, 'oro'),
    );
    const teamA = s.players[0].team;
    const s1 = applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state; // A: flor
    const s2 = applyAction(s1, {
      type: 'CALL_FLOR',
      seat: 1,
      call: 'contraflor_envido',
    }).state; // B: con flor envido (5)
    const s3 = applyAction(s2, {
      type: 'CALL_FLOR',
      seat: 0,
      call: 'contraflor_resto',
    }).state; // A: al resto
    // B no quiere ⇒ A se lleva el nivel en la mesa: Con Flor Envido = 5.
    const s4 = applyAction(s3, { type: 'DECLINE', seat: 1 }).state;
    expect(s4.score[teamA]).toBe(5);
  });

  it('la Flor bloquea el Envido aunque ya se haya jugado una carta', () => {
    const base = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')], // flor
      [c(1, 'espada'), c(6, 'copa'), c(4, 'basto')], // sin flor
      c(1, 'oro'),
    );
    // El de la flor ya jugó una carta: quedan 2 en la mano (played + hand = 3).
    const played = base.players[0].hand[0];
    const s = {
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, hand: p.hand.slice(1), played: [played] } : p,
      ),
      hand: { ...base.hand, turnSeat: 1, envidoWindowOpen: true },
    };
    // El rival (asiento 1) NO puede cantar Envido: hubo flor en la mano.
    expect(legalActions(s, 1).some((a) => a.type === 'CALL_ENVIDO')).toBe(false);
    expect(() =>
      applyAction(s, { type: 'CALL_ENVIDO', seat: 1, call: 'envido' }),
    ).toThrow();
  });

  it('un compañero NO bloquea la Flor propia: ambos pueden anunciarla (2v2)', () => {
    // 2v2: asientos 0 y 2 = equipo A ; 1 y 3 = equipo B. 0 y 2 con flor.
    const base = createMatch({ mode: '2v2', seed: 1 });
    const s: MatchState = {
      ...base,
      players: base.players.map((p, i) => ({
        ...p,
        hand:
          i === 0
            ? [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')] // flor
            : i === 2
              ? [c(7, 'copa'), c(6, 'copa'), c(5, 'copa')] // flor (mismo equipo A)
              : [c(1, 'espada'), c(6, 'oro'), c(4, 'basto')], // sin flor
        played: [],
        folded: false,
      })),
      hand: { ...base.hand, muestra: c(1, 'oro'), envidoWindowOpen: true },
    };
    // El asiento 0 canta Flor.
    const s1 = applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state;
    expect(s1.hand.flor.declaredSeats).toContain(0);
    // El compañero (asiento 2) TAMBIÉN puede cantar su Flor.
    const r2 = applyAction(s1, { type: 'CALL_FLOR', seat: 2 });
    expect(r2.state.hand.flor.declaredSeats).toEqual([0, 2]);
    expect(r2.events.some((e) => e.type === 'FLOR_DECLARED' && e.seat === 2)).toBe(true);
  });

  it('un jugador SIN flor no puede cantarla, aunque su compañero tenga', () => {
    const base = createMatch({ mode: '2v2', seed: 1 });
    const s: MatchState = {
      ...base,
      players: base.players.map((p, i) => ({
        ...p,
        hand:
          i === 0
            ? [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')] // flor
            : [c(1, 'espada'), c(6, 'oro'), c(4, 'basto')], // sin flor
        played: [],
        folded: false,
      })),
      hand: { ...base.hand, muestra: c(1, 'oro'), envidoWindowOpen: true },
    };
    const s1 = applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state;
    // El asiento 2 (equipo A, sin flor) NO puede cantar.
    expect(() => applyAction(s1, { type: 'CALL_FLOR', seat: 2 })).toThrow();
  });

  it('un jugador que ya jugó su primera carta no puede cantar Flor', () => {
    const base = forced(
      [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')],
      [c(1, 'espada'), c(6, 'copa'), c(4, 'basto')],
      c(1, 'oro'),
    );
    const s = {
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, hand: p.hand.slice(1), played: [p.hand[0]] } : p,
      ),
    };
    expect(() => applyAction(s, { type: 'CALL_FLOR', seat: 0 })).toThrow();
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
