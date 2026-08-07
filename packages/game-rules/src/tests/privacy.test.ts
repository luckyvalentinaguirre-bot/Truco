/* =============================================================
 * §49 (OBLIGATORIO) · Seguridad de la información por asiento.
 * Verifica que el estado redactado para un jugador NUNCA contenga las
 * cartas privadas de otros, ni la muestra de un Pico a Pico ajeno.
 * ============================================================= */
import { describe, it, expect } from 'vitest';
import { createMatch } from '../setup.js';
import { redactStateFor } from '../privacy.js';
import type { Card } from '../types.js';

const key = (c: Card) => `${c.rank}-${c.suit}`;

describe('privacy · redactStateFor (§20, §21, §49)', () => {
  it('el jugador conserva SUS cartas y la cantidad de las ajenas', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    const view = redactStateFor(s, 0);
    // Sus propias cartas intactas.
    expect(view.players[0].hand).toEqual(s.players[0].hand);
    expect(view.players[0].handCount).toBe(3);
    // Las de los demás: vacías, sólo la cantidad.
    for (const seat of [1, 2, 3]) {
      expect(view.players[seat].hand).toEqual([]);
      expect(view.players[seat].handCount).toBe(3);
    }
  });

  it('NO transmite ninguna carta privada de los demás (2v2)', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    const view = redactStateFor(s, 1); // jugador B (asiento 1)
    // Todas las cartas privadas del resto, en claves.
    const forbidden = new Set<string>();
    for (const p of s.players) {
      if (p.seat !== 1) p.hand.forEach((c) => forbidden.add(key(c)));
    }
    // Serializamos el estado que recibiría el jugador 1 y comprobamos que
    // ninguna carta ajena aparece por ningún lado.
    const wire = JSON.stringify(view);
    for (const p of s.players) {
      if (p.seat === 1) continue;
      for (const c of p.hand) {
        // Cada carta ajena podría, por azar, coincidir con una propia; sólo
        // exigimos que las que NO son del jugador 1 no estén si son exclusivas.
        if (!s.players[1].hand.some((own) => key(own) === key(c))) {
          expect(wire).not.toContain(`"rank":${c.rank},"suit":"${c.suit}"`);
        }
      }
    }
    expect(forbidden.size).toBeGreaterThan(0);
  });

  it('3v3: un jugador no recibe las cartas de los otros cinco', () => {
    const s = createMatch({ mode: '3v3', seed: 5 });
    const view = redactStateFor(s, 2);
    for (const seat of [0, 1, 3, 4, 5]) {
      expect(view.players[seat].hand).toEqual([]);
    }
    expect(view.players[2].hand).toEqual(s.players[2].hand);
  });

  it('Pico a Pico: un ESPECTADOR no recibe la muestra del 1v1 ajeno', () => {
    const s = createMatch({ mode: '3v3', seed: 3, picoAPico: true });
    const spectator = s.players.find((p) => p.folded)!.seat;
    const duelist = s.players.find((p) => !p.folded)!.seat;
    const specView = redactStateFor(s, spectator);
    expect(specView.hand.muestraHidden).toBe(true);
    expect(specView.hand.muestra).not.toEqual(s.hand.muestra);
    // El duelista SÍ ve la muestra real.
    const duelView = redactStateFor(s, duelist);
    expect(duelView.hand.muestraHidden).toBeUndefined();
    expect(duelView.hand.muestra).toEqual(s.hand.muestra);
  });

  it('fuera de pico, la muestra es pública para todos', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    const view = redactStateFor(s, 3);
    expect(view.hand.muestra).toEqual(s.hand.muestra);
    expect(view.hand.muestraHidden).toBeUndefined();
  });

  it('no muta el estado original', () => {
    const s = createMatch({ mode: '2v2', seed: 1 });
    const before = JSON.stringify(s);
    redactStateFor(s, 0);
    expect(JSON.stringify(s)).toBe(before);
  });
});
