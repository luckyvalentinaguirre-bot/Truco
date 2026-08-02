/* =============================================================
 * TRUCO ENGINE · IA básica
 * -------------------------------------------------------------
 * Heurísticas simples. REGLA DE ORO: la IA nunca inventa jugadas;
 * elige SIEMPRE dentro de `legalActions` del motor. Así es
 * imposible que realice una acción ilegal.
 * ============================================================= */
import type { Action } from './actions';
import type { MatchState } from './state';
import type { Card, Seat } from './types';
import { legalActions, getPending } from './engine';
import { rankCard } from './ranking';
import { calcEnvido } from './envido';

/** Fuerza total de la mano (para decidir aceptar/cantar Truco). */
function handStrength(hand: Card[], muestra: Card): number {
  return hand.reduce((s, c) => s + rankCard(c, muestra).strength, 0);
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Elige una acción legal para `seat`. `rng` inyectable para tests
 * deterministas.
 */
export function chooseAiAction(
  state: MatchState,
  seat: Seat,
  rng: () => number = Math.random,
): Action | null {
  const legal = legalActions(state, seat);
  if (legal.length === 0) return null;

  const hand = state.players[seat].hand;
  const muestra = state.hand.muestra;
  const strength = handStrength(hand, muestra);
  const envido = calcEnvido(hand, muestra).value;
  const pending = getPending(state);

  // -------- Responder a un canto pendiente --------
  if (pending) {
    const accept = legal.find((a) => a.type === 'ACCEPT');
    const decline = legal.find((a) => a.type === 'DECLINE');

    if (pending.kind === 'envido') {
      // Acepta con buen envido; con envido alto a veces sube.
      const raises = legal.filter((a) => a.type === 'CALL_ENVIDO');
      if (envido >= 30 && raises.length > 0 && rng() < 0.4) return pick(raises, rng);
      if (envido >= 25 && accept) return accept;
      return decline ?? accept ?? legal[0];
    }
    // Truco: acepta con mano decente; a veces contra-canta.
    const raises = legal.filter((a) => a.type === 'CALL_TRUCO');
    if (strength >= 200 && raises.length > 0 && rng() < 0.35) return pick(raises, rng);
    if (strength >= 120 && accept) return accept;
    return decline ?? accept ?? legal[0];
  }

  // -------- Turno propio (jugar o cantar) --------
  const canFlor = legal.find((a) => a.type === 'CALL_FLOR');
  if (canFlor && rng() < 0.8) return canFlor;

  const canEnvido = legal.filter((a) => a.type === 'CALL_ENVIDO');
  if (canEnvido.length > 0 && envido >= 27 && rng() < 0.5) {
    return canEnvido.find((a) => a.type === 'CALL_ENVIDO' && a.call === 'envido') ?? canEnvido[0];
  }

  const canTruco = legal.filter((a) => a.type === 'CALL_TRUCO');
  if (canTruco.length > 0 && strength >= 220 && rng() < 0.4) {
    return canTruco.find((a) => a.type === 'CALL_TRUCO' && a.call === 'truco') ?? canTruco[0];
  }

  // Jugar una carta: la más baja que gane la baza si puede; si no, la más baja.
  const playable = legal.filter(
    (a): a is Extract<Action, { type: 'PLAY_CARD' }> => a.type === 'PLAY_CARD',
  );
  if (playable.length === 0) {
    // Sin cartas jugables (raro): elige cualquier acción legal.
    return legal[0];
  }

  const sorted = [...playable].sort(
    (a, b) => rankCard(a.card, muestra).strength - rankCard(b.card, muestra).strength,
  );

  const table = currentTablePlays(state);
  if (table.length > 0) {
    const highest = Math.max(...table.map((c) => rankCard(c, muestra).strength));
    const winning = sorted.find((a) => rankCard(a.card, muestra).strength > highest);
    if (winning) return winning; // la más baja que gana
  }
  return sorted[0]; // la más baja
}

/** Cartas ya jugadas en la baza en curso. */
function currentTablePlays(state: MatchState): Card[] {
  const tricks = state.hand.tricks;
  const current = tricks[tricks.length - 1];
  return current ? current.plays.map((p) => p.card) : [];
}
