/* =============================================================
 * Adaptador de vista: deriva de MatchState todo lo que la UI
 * necesita mostrar. Funciones PURAS (sin React), testeables.
 * La UI no implementa reglas: sólo lee este view-model.
 * ============================================================= */
import {
  actorNow,
  getPending,
  legalActions,
  calcEnvido,
  calcFlor,
  cardCategory,
  type Action,
  type EnvidoCall,
  type MatchState,
  type Seat,
  type TeamId,
  type TrucoCall,
  type GameEvent,
} from '@/game';

export const TRUCO_LABEL: Record<TrucoCall, string> = {
  truco: 'Truco',
  retruco: 'Retruco',
  vale4: 'Vale 4',
};

export const ENVIDO_LABEL: Record<EnvidoCall, string> = {
  envido: 'Envido',
  real_envido: 'Real Envido',
  falta_envido: 'Falta Envido',
};

/** Acciones legales del humano, agrupadas para la barra/overlay. */
export interface HumanOptions {
  playableCardIds: string[];
  trucoCalls: TrucoCall[];
  envidoCalls: EnvidoCall[];
  canFlor: boolean;
  canAccept: boolean;
  canDecline: boolean;
  canFold: boolean;
}

function cardKey(rank: number, suit: string): string {
  return `${rank}-${suit}`;
}

export function humanOptions(state: MatchState, seat: Seat): HumanOptions {
  const acts = actorNow(state) === seat ? legalActions(state, seat) : [];
  const trucoCalls: TrucoCall[] = [];
  const envidoCalls: EnvidoCall[] = [];
  const playableCardIds: string[] = [];
  let canFlor = false;
  let canAccept = false;
  let canDecline = false;
  let canFold = false;

  for (const a of acts) {
    switch (a.type) {
      case 'PLAY_CARD':
        playableCardIds.push(cardKey(a.card.rank, a.card.suit));
        break;
      case 'CALL_TRUCO':
        trucoCalls.push(a.call);
        break;
      case 'CALL_ENVIDO':
        envidoCalls.push(a.call);
        break;
      case 'CALL_FLOR':
        canFlor = true;
        break;
      case 'ACCEPT':
        canAccept = true;
        break;
      case 'DECLINE':
        canDecline = true;
        break;
      case 'FOLD':
        canFold = true;
        break;
    }
  }

  return {
    playableCardIds,
    trucoCalls,
    envidoCalls,
    canFlor,
    canAccept,
    canDecline,
    canFold,
  };
}

/** Claves de las cartas que son PIEZA (según el motor) en una mano. */
export function piezaCardKeys(
  state: MatchState,
  seat: Seat,
): Set<string> {
  const muestra = state.hand.muestra;
  const keys = state.players[seat].hand
    .filter((c) => cardCategory(c, muestra) === 'pieza')
    .map((c) => cardKey(c.rank, c.suit));
  return new Set(keys);
}

/** ¿El humano puede jugar esta carta ahora? */
export function isCardPlayable(
  opts: HumanOptions,
  rank: number,
  suit: string,
): boolean {
  return opts.playableCardIds.includes(cardKey(rank, suit));
}

/** Texto contextual de estado ("Tu turno", "El rival cantó Truco", …). */
export function statusText(state: MatchState, humanSeat: Seat): string {
  if (state.phase === 'finished') {
    return state.winner === state.players[humanSeat].team
      ? '¡Ganaste la partida!'
      : 'Perdiste la partida';
  }
  if (state.hand.finished) {
    const w = state.hand.winner;
    if (w === state.players[humanSeat].team) return 'Ganaste la mano';
    if (w) return 'El rival ganó la mano';
    return 'Fin de la mano';
  }

  const pending = getPending(state);
  const humanTeam = state.players[humanSeat].team;
  if (pending) {
    const label =
      pending.kind === 'truco'
        ? TRUCO_LABEL[state.hand.truco.level as TrucoCall] ?? 'Truco'
        : ENVIDO_LABEL[state.hand.envido.calls[state.hand.envido.calls.length - 1]] ??
          'Envido';
    if (pending.callerTeam === humanTeam) {
      return `Cantaste ${label} — esperá la respuesta`;
    }
    return `El rival cantó ${label} — ¿Querés?`;
  }

  const actor = actorNow(state);
  if (actor === humanSeat) return 'Tu turno — elegí una carta';
  return 'Turno del rival…';
}

export interface EnvidoReveal {
  seat: Seat;
  value: number;
  team: TeamId;
}

/** Tantos de cada jugador (solo para MOSTRAR; el motor ya resolvió). */
export function envidoReveals(state: MatchState): EnvidoReveal[] {
  return state.players
    .filter((p) => !p.folded)
    .map((p) => ({
      seat: p.seat,
      team: p.team,
      value: calcEnvido(p.hand, state.hand.muestra).value,
    }));
}

/** ¿El humano tiene Flor? (lo dice el motor, no React). */
export function humanHasFlor(state: MatchState, humanSeat: Seat): boolean {
  if (!state.ruleset.withFlor) return false;
  return calcFlor(state.players[humanSeat].hand, state.hand.muestra).hasFlor;
}

/** Mensaje transitorio (banner) a partir de los últimos eventos. */
export function bannerFromEvents(
  events: GameEvent[],
  state: MatchState,
  humanSeat: Seat,
): string | null {
  const humanTeam = state.players[humanSeat].team;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    // Los resultados de Envido/Flor los muestra el anuncio grande
    // (announcementFromEvents); acá sólo el resultado de la baza.
    if (e.type === 'TRICK_RESOLVED') {
      if (e.outcome === 'parda') return 'Parda';
      return e.outcome === humanTeam ? 'Ganaste la baza' : 'El rival ganó la baza';
    }
  }
  return null;
}

/** Anuncio grande y transitorio en la mesa (canto o resultado). */
export interface MatchAnnouncement {
  kind: 'canto' | 'result';
  /** 'Vos' | 'Rival' — quién originó el anuncio. */
  who?: string;
  subtitle?: string;
  title: string;
  rows?: { label: string; value: number; you: boolean }[];
  verdict?: string;
  tone: 'call' | 'win' | 'lose' | 'neutral';
}

function bestByTeam(state: MatchState, team: TeamId): number {
  let best = -1;
  for (const p of state.players) {
    if (p.folded || p.team !== team) continue;
    const v = calcEnvido(p.hand, state.hand.muestra).value;
    if (v > best) best = v;
  }
  return best;
}

/**
 * Deriva un anuncio de un lote de eventos. Prioriza resultados (envido/flor
 * resueltos) sobre cantos. Puro: sólo lee el estado; no cambia reglas.
 */
export function announcementFromEvents(
  events: GameEvent[],
  state: MatchState,
  humanSeat: Seat,
): MatchAnnouncement | null {
  const humanTeam = state.players[humanSeat].team;
  const rivalTeam: TeamId = humanTeam === 'A' ? 'B' : 'A';
  const whoOf = (seat: Seat) =>
    state.players[seat].team === humanTeam ? 'Vos' : 'Rival';

  // 1) Resultados (tienen prioridad visual).
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'ENVIDO_RESOLVED') {
      const you = bestByTeam(state, humanTeam);
      const rival = bestByTeam(state, rivalTeam);
      const win = e.winner === humanTeam;
      return {
        kind: 'result',
        title: 'Envido',
        rows: [
          { label: 'Vos', value: you, you: true },
          { label: 'Rival', value: rival, you: false },
        ],
        verdict: win ? `¡Es buena!  +${e.points}` : `Es del rival  +${e.points}`,
        tone: win ? 'win' : 'lose',
      };
    }
    if (e.type === 'FLOR_RESOLVED') {
      const win = e.winner === humanTeam;
      return {
        kind: 'result',
        title: 'Flor',
        verdict: win ? `¡Flor tuya!  +${e.points}` : `Flor del rival  +${e.points}`,
        tone: win ? 'win' : 'lose',
      };
    }
  }

  // 2) Cantos (último del lote).
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'TRUCO_CALLED') {
      return { kind: 'canto', who: whoOf(e.seat), subtitle: 'canta', title: TRUCO_LABEL[e.call], tone: 'call' };
    }
    if (e.type === 'ENVIDO_CALLED') {
      return { kind: 'canto', who: whoOf(e.seat), subtitle: 'canta', title: ENVIDO_LABEL[e.call], tone: 'call' };
    }
    if (e.type === 'FLOR_DECLARED') {
      return { kind: 'canto', who: whoOf(e.seat), subtitle: 'canta', title: 'Flor', tone: 'call' };
    }
  }
  return null;
}

/** Descriptor de una acción concreta para asociarla a un botón. */
export function trucoAction(seat: Seat, call: TrucoCall): Action {
  return { type: 'CALL_TRUCO', seat, call };
}
export function envidoAction(seat: Seat, call: EnvidoCall): Action {
  return { type: 'CALL_ENVIDO', seat, call };
}
