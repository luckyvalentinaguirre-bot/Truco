/* =============================================================
 * TRUCO ENGINE · IA con evaluación y dificultad
 * -------------------------------------------------------------
 * REGLA DE ORO: la IA nunca inventa jugadas; elige SIEMPRE dentro
 * de `legalActions` del motor. Evalúa cartas (piezas, matas,
 * fuerza), envido y flor, y decide con umbrales según dificultad.
 * ============================================================= */
import type { Action } from './actions';
import type { MatchState } from './state';
import type { Card, Seat } from './types';
import { legalActions, getPending } from './engine';
import { rankCard } from './ranking';
import { calcEnvido } from './envido';
import { calcFlor } from './flor';

export type Difficulty = 'facil' | 'normal' | 'dificil';

interface Profile {
  /** Fuerza total mínima para querer el Truco. */
  trucoAccept: number;
  /** Fuerza para cantar Truco de movida. */
  trucoCall: number;
  /** Envido mínimo para querer. */
  envidoAccept: number;
  /** Envido mínimo para cantar. */
  envidoCall: number;
  /** Probabilidad de cometer un error (jugar subóptimo / decisión floja). */
  mistake: number;
}

const PROFILES: Record<Difficulty, Profile> = {
  facil: { trucoAccept: 140, trucoCall: 250, envidoAccept: 27, envidoCall: 30, mistake: 0.35 },
  normal: { trucoAccept: 120, trucoCall: 220, envidoAccept: 25, envidoCall: 27, mistake: 0.12 },
  dificil: { trucoAccept: 105, trucoCall: 190, envidoAccept: 23, envidoCall: 26, mistake: 0.02 },
};

function handStrength(hand: Card[], muestra: Card): number {
  return hand.reduce((s, c) => s + rankCard(c, muestra).strength, 0);
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export interface AiOptions {
  difficulty?: Difficulty;
}

/** Elige una acción legal para `seat`. `rng` inyectable para tests. */
export function chooseAiAction(
  state: MatchState,
  seat: Seat,
  rng: () => number = Math.random,
  opts: AiOptions = {},
): Action | null {
  const legal = legalActions(state, seat);
  if (legal.length === 0) return null;

  const prof = PROFILES[opts.difficulty ?? 'normal'];
  const hand = state.players[seat].hand;
  const muestra = state.hand.muestra;
  const strength = handStrength(hand, muestra);
  const envido = calcEnvido(hand, muestra).value;
  const hasFlor = calcFlor(hand, muestra).hasFlor;
  const pending = getPending(state);
  const mistake = rng() < prof.mistake;

  // -------- Responder a un canto pendiente --------
  if (pending) {
    const accept = legal.find((a) => a.type === 'ACCEPT');
    const decline = legal.find((a) => a.type === 'DECLINE');

    if (pending.kind === 'flor') {
      const florValue = calcFlor(hand, muestra).value;
      const resto = legal.find(
        (a) => a.type === 'CALL_FLOR' && a.call === 'contraflor_resto',
      );
      const conFlorEnvido = legal.find(
        (a) => a.type === 'CALL_FLOR' && a.call === 'contraflor_envido',
      );
      // Subir con flor alta: al resto con flor casi imbatible, si no Con Flor Envido.
      if (resto && florValue >= 42 && rng() < 0.4) return resto;
      if (conFlorEnvido && florValue >= 37 && rng() < 0.4) return conFlorEnvido;
      // Responder quiero/no quiero a una subida: aceptar sólo con flor decente.
      if (accept && decline) return florValue >= 33 ? accept : decline;
      // Flor simple: aceptar el duelo (mostrar y comparar).
      return accept ?? resto ?? conFlorEnvido ?? legal[0];
    }

    if (pending.kind === 'envido') {
      const raises = legal.filter((a) => a.type === 'CALL_ENVIDO');
      if (envido >= 31 && raises.length > 0 && rng() < 0.45) return pick(raises, rng);
      const wants = envido >= prof.envidoAccept;
      if (wants !== mistake && accept) return accept; // el error invierte la decisión
      return decline ?? accept ?? legal[0];
    }
    // Truco.
    const raises = legal.filter((a) => a.type === 'CALL_TRUCO');
    if (strength >= 230 && raises.length > 0 && rng() < 0.4) return pick(raises, rng);
    const wants = strength >= prof.trucoAccept;
    if (wants !== mistake && accept) return accept;
    return decline ?? accept ?? legal[0];
  }

  // -------- Turno propio --------
  // Flor: es obligatoria y da puntos seguros ⇒ cantarla siempre.
  const florAction = legal.find((a) => a.type === 'CALL_FLOR');
  if (florAction && hasFlor) return florAction;

  // Envido en la primera baza con buen tanto.
  const envidoCalls = legal.filter((a) => a.type === 'CALL_ENVIDO');
  if (envidoCalls.length > 0 && envido >= prof.envidoCall && rng() < 0.6) {
    return (
      envidoCalls.find((a) => a.type === 'CALL_ENVIDO' && a.call === 'envido') ??
      envidoCalls[0]
    );
  }

  // Truco con mano fuerte.
  const trucoCalls = legal.filter((a) => a.type === 'CALL_TRUCO');
  if (trucoCalls.length > 0 && strength >= prof.trucoCall && rng() < 0.5) {
    return (
      trucoCalls.find((a) => a.type === 'CALL_TRUCO' && a.call === 'truco') ??
      trucoCalls[0]
    );
  }

  // Elegir carta a jugar.
  const playable = legal.filter(
    (a): a is Extract<Action, { type: 'PLAY_CARD' }> => a.type === 'PLAY_CARD',
  );
  if (playable.length === 0) return legal[0];

  const sorted = [...playable].sort(
    (a, b) => rankCard(a.card, muestra).strength - rankCard(b.card, muestra).strength,
  );

  // Error: jugar una carta al azar en vez de la óptima.
  if (mistake) return pick(sorted, rng);

  const table = currentTablePlays(state);
  if (table.length > 0) {
    const highest = Math.max(...table.map((c) => rankCard(c, muestra).strength));
    // La carta más baja que gane la baza; si ninguna gana, la más baja (descarta).
    const winning = sorted.find((a) => rankCard(a.card, muestra).strength > highest);
    if (winning) return winning;
    return sorted[0];
  }

  // Mano de la baza: si tiene una carta muy fuerte, abrir con una media/baja
  // para no quemar la mata; heurística simple → jugar la más baja.
  return sorted[0];
}

function currentTablePlays(state: MatchState): Card[] {
  const tricks = state.hand.tricks;
  const current = tricks[tricks.length - 1];
  return current ? current.plays.map((p) => p.card) : [];
}
