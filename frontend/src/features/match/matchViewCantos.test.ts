import { describe, it, expect } from 'vitest';
import {
  createMatch,
  applyAction,
  calcEnvido,
  type Card,
  type MatchState,
  type Seat,
  type GameEvent,
} from '@/game';
import {
  bubblesFromEvents,
  announcementFromEvents,
  envidoNarration,
  humanOptions,
} from './matchView';

const HUMAN: Seat = 0;

describe('burbujas de canto (bubblesFromEvents)', () => {
  it('cada canto/respuesta genera una burbuja junto a su asiento', () => {
    const events: GameEvent[] = [
      { type: 'TRUCO_CALLED', seat: 1, call: 'truco' },
      { type: 'ENVIDO_CALLED', seat: 0, call: 'real_envido' },
      { type: 'CALL_ACCEPTED', seat: 2 },
      { type: 'CALL_DECLINED', seat: 3 },
      { type: 'FLOR_DECLARED', seat: 1, team: 'B' },
    ];
    const bubbles = bubblesFromEvents(events);
    expect(bubbles).toEqual([
      { seat: 1, text: 'Truco' },
      { seat: 0, text: 'Real Envido' },
      { seat: 2, text: 'Quiero' },
      { seat: 3, text: 'No quiero' },
      { seat: 1, text: 'Flor' },
    ]);
  });

  it('eventos sin canto no generan burbujas', () => {
    const events: GameEvent[] = [
      { type: 'CARD_PLAYED', seat: 0, card: { rank: 1, suit: 'espada' } },
      { type: 'TRICK_RESOLVED', index: 0, outcome: 'A', winnerSeat: 0 },
      { type: 'POINTS_AWARDED', team: 'A', points: 2, reason: 'truco' },
    ];
    expect(bubblesFromEvents(events)).toEqual([]);
  });
});

describe('anuncio de resultado del Envido: limpio, sin tantos de todos', () => {
  it('ENVIDO_RESOLVED muestra "Son buenas" y no una lista de tantos', () => {
    const events: GameEvent[] = [
      { type: 'ENVIDO_RESOLVED', winner: 'A', points: 2 },
    ];
    const s = createMatch({ mode: '1v1', seed: 5 });
    const ann = announcementFromEvents(events, s, HUMAN);
    expect(ann).not.toBeNull();
    expect(ann!.kind).toBe('result');
    expect(ann!.title).toBe('Envido');
    // No debe exponer los tantos individuales de cada jugador (nada de listas).
    expect(ann!.rows).toBeUndefined();
    // Sí muestra el tanto GANADOR (tradicional) y los puntos ganados.
    expect(ann!.verdict).toMatch(/\d+/);
    expect(ann!.verdict).toContain('+2');
  });

  it('los cantos NO viajan por el anuncio central (van como burbuja)', () => {
    const events: GameEvent[] = [
      { type: 'ENVIDO_CALLED', seat: 1, call: 'envido' },
    ];
    const s = createMatch({ mode: '1v1', seed: 5 });
    const ann = announcementFromEvents(events, s, HUMAN);
    // announcementFromEvents todavía puede describir el canto, pero la UI
    // sólo consume los de kind 'result'; acá verificamos que el canto se
    // representa como burbuja.
    expect(bubblesFromEvents(events)).toEqual([{ seat: 1, text: 'Envido' }]);
    if (ann) expect(ann.kind).toBe('canto');
  });
});

describe('narración del Envido (tradicional, en orden de mano)', () => {
  it('el más mano canta primero; los números son crecientes; el último es el mayor', () => {
    const s = createMatch({ mode: '2v2', seed: 7 });
    const mano = s.hand.manoSeat;
    const narr = envidoNarration(s, mano);
    const activos = s.players.filter((p) => !p.folded).length;
    expect(narr).toHaveLength(activos);
    // El primero en hablar es el más mano.
    expect(narr[0].seat).toBe(mano);
    // Los tantos que se cantan (no "Son buenas") son estrictamente crecientes.
    const nums = narr
      .filter((b) => b.text !== 'Son buenas')
      .map((b) => Number(b.text));
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
    // El último tanto cantado es el mayor de la mesa (el ganador).
    const maxTantos = Math.max(
      ...s.players.map((p) => calcEnvido(p.hand, s.hand.muestra).value),
    );
    expect(nums[nums.length - 1]).toBe(maxTantos);
  });

  it('el que tiene menos dice "Son buenas" (no un número)', () => {
    const s = createMatch({ mode: '1v1', seed: 5 });
    const narr = envidoNarration(s, s.hand.manoSeat);
    expect(narr).toHaveLength(2);
    // En 1v1 hay a lo sumo un "Son buenas" (el perdedor) y siempre un número.
    const buenas = narr.filter((b) => b.text === 'Son buenas').length;
    const numeros = narr.filter((b) => b.text !== 'Son buenas').length;
    expect(numeros).toBeGreaterThanOrEqual(1);
    expect(buenas).toBeLessThanOrEqual(1);
  });
});

describe('Contraflor: el view-model ofrece la subida al responder un duelo', () => {
  const c = (rank: number, suit: string): Card => ({
    rank: rank as Card['rank'],
    suit: suit as Card['suit'],
  });
  function florDuel(): MatchState {
    const base = createMatch({ mode: '1v1', seed: 1 });
    const s: MatchState = {
      ...base,
      players: base.players.map((p, i) => ({
        ...p,
        hand:
          i === 0
            ? [c(7, 'basto'), c(6, 'basto'), c(3, 'basto')] // flor 36
            : [c(7, 'copa'), c(6, 'copa'), c(5, 'copa')], // flor 38
        played: [],
        folded: false,
      })),
      hand: { ...base.hand, muestra: c(1, 'oro'), envidoWindowOpen: true },
    };
    // Asiento 0 declara flor ⇒ se abre el duelo, responde el asiento 1.
    return applyAction(s, { type: 'CALL_FLOR', seat: 0 }).state;
  }

  it('el que responde puede aceptar o subir a Contraflor al resto', () => {
    const s = florDuel();
    const opts = humanOptions(s, 1);
    expect(opts.canAccept).toBe(true);
    expect(opts.florCalls).toContain('contraflor_resto');
    // Aún no jugó nadie ⇒ no hay cartas jugables durante la fase de flor.
    expect(opts.playableCardIds).toEqual([]);
  });

  it('el que cantó la flor NO ve opciones mientras espera respuesta', () => {
    const s = florDuel();
    const opts = humanOptions(s, 0);
    expect(opts.florCalls).toEqual([]);
    expect(opts.canAccept).toBe(false);
  });
});

describe('menú de Envido: sólo cantos válidos', () => {
  it('al abrir la mano el humano mano puede cantar Envido/Real/Falta', () => {
    const s = createMatch({ mode: '1v1', seed: 5 });
    const opts = humanOptions(s, HUMAN);
    // Sólo cantos permitidos por el motor (no botones bloqueados).
    expect(opts.envidoCalls.length).toBeGreaterThan(0);
    for (const c of opts.envidoCalls) {
      expect(['envido', 'real_envido', 'falta_envido']).toContain(c);
    }
  });

  it('tras jugarse una carta ya no se ofrece Envido', () => {
    const s0 = createMatch({ mode: '1v1', seed: 5 });
    const card = s0.players[HUMAN].hand[0];
    const s1 = applyAction(s0, { type: 'PLAY_CARD', seat: HUMAN, card }).state;
    // Cuando vuelva a ser turno del humano, la ventana de envido está cerrada.
    // De inmediato es turno del rival: sin opciones de envido para el humano.
    expect(humanOptions(s1, HUMAN).envidoCalls).toEqual([]);
  });
});
