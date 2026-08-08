/* =============================================================
 * TRUCO ENGINE · Reductor de la partida
 * -------------------------------------------------------------
 *   applyAction(state, action) -> { state, events }
 *
 * Única autoridad sobre qué jugadas son válidas. Determinista y
 * puro (no muta el estado de entrada). Diseñado para que el mismo
 * código corra en el cliente (previsualización) y en el servidor
 * (autoridad real) en la etapa de multiplayer.
 * ============================================================= */
import type { Action } from './actions.js';
import type { GameEvent, Applied } from './events.js';
import type { HandState, MatchState, Player, Trick } from './state.js';
import type { Card, FlorCall, Seat, TeamId } from './types.js';
import { sameCard } from './deck.js';
import { resolveTrick, resolveHand, type Play } from './tricks.js';
import {
  canCallTruco,
  callTruco,
  acceptTruco,
  declineTruco,
  trucoPointsAtStake,
} from './trucoBetting.js';
import {
  canCallEnvido,
  callEnvido,
  acceptEnvido,
  declineEnvido,
  envidoPointsAtStake,
} from './envidoBetting.js';
import {
  declareFlorSeat,
  openFlorDuel,
  canCallContraflor,
  callContraflor,
  canRespondFlor,
  FLOR_LEVEL_VALUE,
} from './florBetting.js';
import { calcEnvido, faltaEnvidoPoints } from './envido.js';
import { calcFlor, FLOR_BASE_POINTS } from './flor.js';
import { addPoints, gameWinner, initScore, type Score } from './scoring.js';
import { dealHand, nextSeat, manoRank } from './setup.js';
import {
  startPicoRound,
  buildDuelState,
  finishDuel,
  revealTotals,
  picoCycleContinues,
  type PicoRound,
} from './picoRound.js';
import type { PicoRoundData } from './state.js';

function otherTeam(t: TeamId): TeamId {
  return t === 'A' ? 'B' : 'A';
}

function currentTrick(hand: HandState): Trick {
  return hand.tricks[hand.tricks.length - 1];
}

function activeSeats(state: MatchState): Seat[] {
  return state.players
    .filter((p) => !p.folded)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}

/** ¿Hay algún canto esperando respuesta? */
export type PendingKind = 'truco' | 'envido' | 'flor';
export interface PendingInfo {
  kind: PendingKind;
  callerTeam: TeamId;
}

function pendingResponse(hand: HandState): PendingInfo | null {
  // La Flor tiene prioridad: su fase se resuelve antes que Envido/Truco.
  if (hand.flor.pendingCall) return { kind: 'flor', callerTeam: hand.flor.callerTeam! };
  if (hand.truco.pending) return { kind: 'truco', callerTeam: hand.truco.callerTeam! };
  if (hand.envido.pending) return { kind: 'envido', callerTeam: hand.envido.callerTeam! };
  return null;
}

/** Info del canto pendiente (para overlays de la UI). */
export function getPending(state: MatchState): PendingInfo | null {
  return pendingResponse(state.hand);
}

/** Siguiente asiento activo que debe jugar tras `seat`. */
function nextActiveSeat(state: MatchState, seat: Seat): Seat {
  const n = state.players.length;
  let s = nextSeat(seat, n);
  while (state.players[s].folded) s = nextSeat(s, n);
  return s;
}

// -------------------------------------------------------------
// Consulta de legalidad (para la UI y para blindar el servidor)
// -------------------------------------------------------------

export function isLegal(state: MatchState, action: Action): boolean {
  try {
    applyAction(state, action);
    return true;
  } catch {
    return false;
  }
}

/** Asiento del rival que debe responder al canto pendiente (o null). */
export function responderSeat(state: MatchState): Seat | null {
  const pending = pendingResponse(state.hand);
  if (!pending) return null;

  // Flor: responde el jugador CON FLOR del equipo rival más mano.
  if (pending.kind === 'flor') {
    const n = state.players.length;
    const holders = state.players.filter(
      (p) =>
        !p.folded &&
        p.team !== pending.callerTeam &&
        calcFlor(p.hand, state.hand.muestra).hasFlor,
    );
    if (holders.length === 0) return null;
    holders.sort(
      (a, b) =>
        manoRank(a.seat, state.hand.manoSeat, n) -
        manoRank(b.seat, state.hand.manoSeat, n),
    );
    return holders[0].seat;
  }

  // Truco / Envido: responde el PIE del equipo contrario (el ÚLTIMO en la ronda,
  // el de mayor rango de mano). Tiene la última palabra por su equipo: sólo él
  // dice quiero / no quiero.
  const n = state.players.length;
  const opp = state.players.filter(
    (p) => !p.folded && p.team !== pending.callerTeam,
  );
  if (opp.length === 0) return null;
  const pie = opp.reduce((last, p) =>
    manoRank(p.seat, state.hand.manoSeat, n) >
    manoRank(last.seat, state.hand.manoSeat, n)
      ? p
      : last,
  );
  return pie.seat;
}

/** ¿Quién debe actuar ahora? El que responde un canto, o el del turno. */
export function actorNow(state: MatchState): Seat | null {
  if (state.phase === 'finished' || state.hand.finished) return null;
  return responderSeat(state) ?? state.hand.turnSeat;
}

/**
 * Enumera TODAS las acciones legales para un asiento, filtrándolas con el
 * propio reductor (el motor es la autoridad). La usan la IA y la UI para
 * no ofrecer jamás una acción imposible.
 */
export function legalActions(state: MatchState, seat: Seat): Action[] {
  const player = state.players[seat];
  if (!player) return [];

  const candidates: Action[] = [
    ...player.hand.map((card) => ({ type: 'PLAY_CARD', seat, card }) as Action),
    { type: 'CALL_TRUCO', seat, call: 'truco' },
    { type: 'CALL_TRUCO', seat, call: 'retruco' },
    { type: 'CALL_TRUCO', seat, call: 'vale4' },
    { type: 'CALL_ENVIDO', seat, call: 'envido' },
    { type: 'CALL_ENVIDO', seat, call: 'real_envido' },
    { type: 'CALL_ENVIDO', seat, call: 'falta_envido' },
    { type: 'CALL_FLOR', seat },
    { type: 'CALL_FLOR', seat, call: 'contraflor_envido' },
    { type: 'CALL_FLOR', seat, call: 'contraflor_resto' },
    { type: 'ACCEPT', seat },
    { type: 'DECLINE', seat },
    { type: 'FOLD', seat },
  ];

  return candidates.filter((a) => isLegal(state, a));
}

// -------------------------------------------------------------
// Reductor principal
// -------------------------------------------------------------

export function applyAction(state: MatchState, action: Action): Applied<MatchState> {
  if (state.phase === 'finished') {
    throw new Error('La partida ya terminó');
  }
  if (state.hand.finished) {
    throw new Error('La mano ya terminó');
  }

  const applied = dispatchAction(state, action);
  // Dentro de un duelo de Pico a Pico, los puntos van a un marcador AISLADO y la
  // partida NO puede terminar por ese marcador: si el motor marcó fin de partida,
  // lo convertimos en fin de DUELO (se resolverá recién en la revelación).
  if (state.picoRound && applied.state.phase === 'finished') {
    const patched: MatchState = {
      ...applied.state,
      phase: 'playing',
      winner: null,
      hand: {
        ...applied.state.hand,
        finished: true,
        winner: applied.state.hand.winner ?? applied.state.winner,
      },
    };
    return {
      state: patched,
      events: applied.events.filter((e) => e.type !== 'GAME_OVER'),
    };
  }
  return applied;
}

function dispatchAction(state: MatchState, action: Action): Applied<MatchState> {
  switch (action.type) {
    case 'PLAY_CARD':
      return playCard(state, action.seat, action.card);
    case 'CALL_TRUCO':
      return doCallTruco(state, action.seat, action.call);
    case 'CALL_ENVIDO':
      return doCallEnvido(state, action.seat, action.call);
    case 'CALL_FLOR':
      return doCallFlor(state, action.seat, action.call ?? 'flor');
    case 'ACCEPT':
      return doAccept(state, action.seat);
    case 'DECLINE':
      return doDecline(state, action.seat);
    case 'FOLD':
      return doFold(state, action.seat);
    case 'DECLARE_PERROS':
      return doDeclarePerros(state, action.seat, action.response);
    default: {
      const _exhaustive: never = action;
      throw new Error(`Acción desconocida: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// -------------------------------------------------------------
// PLAY_CARD
// -------------------------------------------------------------

function playCard(state: MatchState, seat: Seat, card: Card): Applied<MatchState> {
  const hand = state.hand;
  if (pendingResponse(hand)) {
    throw new Error('Hay un canto pendiente: primero respondé (quiero / no quiero)');
  }
  if (seat !== hand.turnSeat) {
    throw new Error(`No es el turno del asiento ${seat}`);
  }
  const player = state.players[seat];
  if (player.folded) throw new Error('El jugador se fue al mazo');
  if (!player.hand.some((c) => sameCard(c, card))) {
    throw new Error('La carta no está en la mano del jugador');
  }

  const events: GameEvent[] = [];

  // Quitar la carta de la mano y registrarla en la baza.
  const players: Player[] = state.players.map((p) =>
    p.seat === seat
      ? {
          ...p,
          hand: p.hand.filter((c) => !sameCard(c, card)),
          played: [...p.played, card],
        }
      : p,
  );

  const trick = currentTrick(hand);
  const play: Play = { seat, team: player.team, card };
  const updatedTrick: Trick = { ...trick, plays: [...trick.plays, play] };
  const tricks = [...hand.tricks.slice(0, -1), updatedTrick];
  events.push({ type: 'CARD_PLAYED', seat, card });

  let nextHand: HandState = { ...hand, tricks };

  const active = activeSeats(state);
  const trickComplete = updatedTrick.plays.length === active.length;

  if (!trickComplete) {
    nextHand = { ...nextHand, turnSeat: nextActiveSeat(state, seat) };
    return { state: { ...state, players, hand: nextHand }, events };
  }

  // Resolver baza.
  const result = resolveTrick(updatedTrick.plays, hand.muestra);
  const resolvedTrick: Trick = {
    ...updatedTrick,
    outcome: result.outcome,
    winnerSeat: result.winnerSeat,
  };
  const resolvedTricks = [...tricks.slice(0, -1), resolvedTrick];
  nextHand = { ...nextHand, tricks: resolvedTricks, envidoWindowOpen: false };
  events.push({
    type: 'TRICK_RESOLVED',
    index: resolvedTricks.length - 1,
    outcome: result.outcome,
    winnerSeat: result.winnerSeat,
  });

  const outcomes = resolvedTricks.map((t) => t.outcome!).filter(Boolean);
  const handWinner = resolveHand(
    resolvedTricks.map((t) => t.outcome!),
    hand.manoTeam,
  );

  if (handWinner) {
    const points = trucoPointsAtStake(hand.truco);
    return finishHand(
      { ...state, players, hand: nextHand },
      handWinner,
      points,
      'truco',
      events,
    );
  }

  // Nueva baza: la abre el ganador; en parda, sigue abriendo el mano.
  if (resolvedTricks.length >= 3) {
    // Salvaguarda: no debería ocurrir (resolveHand cubre 3 bazas).
    return finishHand(
      { ...state, players, hand: nextHand },
      hand.manoTeam,
      trucoPointsAtStake(hand.truco),
      'truco',
      events,
    );
  }

  // El ganador de la baza abre la siguiente; en parda, sigue abriendo quien
  // abrió esta baza (que ya es el ganador de la baza previa, o el mano).
  const nextLead = result.winnerSeat ?? resolvedTrick.leadSeat;
  nextHand = {
    ...nextHand,
    tricks: [
      ...resolvedTricks,
      { plays: [], leadSeat: nextLead, outcome: null, winnerSeat: null },
    ],
    turnSeat: nextLead,
  };
  void outcomes;
  return { state: { ...state, players, hand: nextHand }, events };
}

// -------------------------------------------------------------
// TRUCO
// -------------------------------------------------------------

function doCallTruco(
  state: MatchState,
  seat: Seat,
  call: 'truco' | 'retruco' | 'vale4',
): Applied<MatchState> {
  const hand = state.hand;
  const team = state.players[seat].team;
  if (hand.flor.pendingCall) {
    throw new Error('Resolvé primero la Flor pendiente');
  }
  if (hand.envido.pending) {
    throw new Error('Resolvé primero el Envido pendiente');
  }
  if (!canCallTruco(hand.truco, team, call)) {
    throw new Error(`No se puede cantar ${call} ahora`);
  }
  const truco = callTruco(hand.truco, team, call);
  return {
    state: { ...state, hand: { ...hand, truco } },
    events: [{ type: 'TRUCO_CALLED', seat, call }],
  };
}

// -------------------------------------------------------------
// ENVIDO
// -------------------------------------------------------------

function doCallEnvido(
  state: MatchState,
  seat: Seat,
  call: 'envido' | 'real_envido' | 'falta_envido',
): Applied<MatchState> {
  const hand = state.hand;
  const team = state.players[seat].team;

  if (hand.flor.pendingCall) {
    throw new Error('Resolvé primero la Flor pendiente');
  }
  if (!hand.envidoWindowOpen && hand.envido.calls.length === 0) {
    throw new Error('La ventana de Envido está cerrada');
  }
  if (hand.truco.acceptedLevel !== 'none') {
    throw new Error('No se puede cantar Envido con el Truco ya aceptado');
  }
  if (hand.truco.pending) {
    // "Envido primero" (cantar envido sobre un truco pendiente) todavía no se
    // modela: se mantiene una sola cadena de canto pendiente por vez.
    throw new Error('Respondé primero el Truco pendiente');
  }
  if (anyFlorPresent(state)) {
    throw new Error('Hay Flor en juego: no se juega Envido');
  }
  if (!canCallEnvido(hand.envido, team, call)) {
    throw new Error(`No se puede cantar ${call} ahora`);
  }
  const envido = callEnvido(hand.envido, team, call);
  return {
    state: { ...state, hand: { ...hand, envido } },
    events: [{ type: 'ENVIDO_CALLED', seat, call }],
  };
}

/**
 * ¿Algún jugador tiene Flor esta mano? (anula el Envido). Usa las 3 cartas
 * ORIGINALES (jugadas + en mano) para que la Flor siga detectándose aunque ya
 * se haya jugado alguna carta: si hubo flor al repartir, no se juega Envido en
 * toda la mano.
 */
function anyFlorPresent(state: MatchState): boolean {
  if (!state.ruleset.withFlor) return false;
  return state.players.some(
    (p) =>
      !p.folded &&
      calcFlor([...p.played, ...p.hand], state.hand.muestra).hasFlor,
  );
}

/** Un participante del showdown de Envido: su tanto y su asiento. */
export interface EnvidoEntry {
  seat: Seat;
  team: TeamId;
  value: number;
}

/**
 * Decide el ganador del Envido a partir de los tantos de cada jugador:
 * gana el tanto más alto. En caso de EMPATE no se decide al azar: gana el
 * jugador con prioridad de mano (el más mano en el orden circular que arranca
 * en `manoSeat`) y el equipo ganador es el de ese jugador.
 *
 * La prioridad es individual e independiente del equipo, así que resuelve
 * igual los empates entre rivales y entre compañeros. Función pura y testeable.
 */
export function envidoWinnerFrom(
  entries: EnvidoEntry[],
  manoSeat: Seat,
  count: number,
): TeamId {
  let bestValue = -1;
  let bestRank = Number.POSITIVE_INFINITY;
  let winner: TeamId | null = null;
  for (const e of entries) {
    const rank = manoRank(e.seat, manoSeat, count);
    // Gana mayor tanto; a igual tanto, el de menor rango (más mano).
    if (e.value > bestValue || (e.value === bestValue && rank < bestRank)) {
      bestValue = e.value;
      bestRank = rank;
      winner = e.team;
    }
  }
  return winner ?? 'A';
}

/** Showdown de Envido usando el estado real (tantos calculados del motor). */
function resolveEnvidoShowdown(state: MatchState): { winner: TeamId } {
  const entries: EnvidoEntry[] = state.players
    .filter((p) => !p.folded)
    .map((p) => ({
      seat: p.seat,
      team: p.team,
      value: calcEnvido(p.hand, state.hand.muestra).value,
    }));
  return {
    winner: envidoWinnerFrom(entries, state.hand.manoSeat, state.players.length),
  };
}

// -------------------------------------------------------------
// FLOR
// -------------------------------------------------------------

/** Jugadores del equipo rival a `team` que TIENEN flor (para saber si hay duelo). */
function rivalFlorHolders(state: MatchState, team: TeamId): Player[] {
  return state.players.filter(
    (p) =>
      !p.folded &&
      p.team !== team &&
      calcFlor(p.hand, state.hand.muestra).hasFlor,
  );
}

function doCallFlor(
  state: MatchState,
  seat: Seat,
  call: FlorCall,
): Applied<MatchState> {
  const hand = state.hand;
  const player = state.players[seat];
  if (!state.ruleset.withFlor) throw new Error('Reglamento sin Flor');
  if (player.folded) throw new Error('El jugador se fue al mazo');
  // CADA jugador evalúa su propia mano: sólo puede cantar si él tiene Flor.
  if (!calcFlor(player.hand, hand.muestra).hasFlor) {
    throw new Error('El jugador no tiene Flor');
  }

  // ---- Subir a Contraflor (respuesta a una flor rival) ----
  if (call !== 'flor') {
    if (hand.flor.resolved) throw new Error('La Flor ya fue resuelta');
    if (!canCallContraflor(hand.flor, player.team, call)) {
      throw new Error('No se puede cantar Contraflor ahora');
    }
    const flor = callContraflor(hand.flor, player.team, call);
    return {
      state: { ...state, hand: { ...hand, flor } },
      events: [{ type: 'FLOR_CONTRA_CALLED', seat, call }],
    };
  }

  // ---- Anuncio de Flor de un jugador ----
  if (player.played.length > 0) {
    throw new Error('Ya jugaste: no podés cantar Flor');
  }
  if (!hand.envidoWindowOpen) throw new Error('La ventana de Flor está cerrada');
  if (hand.flor.declaredSeats.includes(seat)) {
    throw new Error('Ya cantaste tu Flor');
  }
  // La PRIMERA Flor de la mano la canta quien está de turno (en el orden de la
  // ronda). Los demás con Flor la anuncian después, ya sin restricción de turno.
  if (hand.flor.declaredSeats.length === 0 && seat !== hand.turnSeat) {
    throw new Error('La primera Flor se canta en tu turno');
  }

  const team = player.team;
  const teamAlreadyIn = hand.flor.declaredBy.includes(team);
  const flor1 = declareFlorSeat(hand.flor, seat, team);
  const announce = (): Applied<MatchState> => ({
    state: { ...state, hand: { ...hand, flor: flor1 } },
    events: [{ type: 'FLOR_DECLARED', seat, team }],
  });

  // Anuncio SECUNDARIO (sólo burbuja, no cambia la apuesta): el equipo ya tiene
  // su flor en juego (un COMPAÑERO ya cantó), o ya se resolvió, o el rival abrió
  // el duelo. Que un compañero haya cantado NO bloquea a este jugador.
  if (
    teamAlreadyIn ||
    hand.flor.resolved ||
    (hand.flor.pendingCall && hand.flor.callerTeam !== team)
  ) {
    return announce();
  }

  // PRIMERA flor de este equipo. Si el rival también tiene flor, se abre el
  // duelo; si no, se resuelve al instante como flor simple (+3).
  if (rivalFlorHolders(state, team).length > 0) {
    const flor = openFlorDuel(flor1, team);
    return {
      state: { ...state, hand: { ...hand, flor } },
      events: [{ type: 'FLOR_DECLARED', seat, team }],
    };
  }

  const { winner, points } = resolveFlorShowdown(state);
  const flor = { ...flor1, resolved: true, callerTeam: team };
  const score = addPoints(state.score, winner, points, state.ruleset);
  const events: GameEvent[] = [
    { type: 'FLOR_DECLARED', seat, team },
    { type: 'FLOR_RESOLVED', winner, points },
    { type: 'POINTS_AWARDED', team: winner, points, reason: 'flor' },
  ];
  return maybeGameOver({ ...state, score, hand: { ...hand, flor } }, events);
}

/**
 * Puntos de un nivel de flor: Flor=3, Con Flor Envido=5, Contraflor al resto=falta.
 * En el "al resto" QUERIDO, el que gana la flor gana la partida "de una": se
 * lleva lo que le falta A ÉL para llegar al objetivo. Para el "no querido" no hay
 * ganador de la flor todavía, así que se usa la falta clásica (sobre el líder).
 */
function florLevelPoints(
  state: MatchState,
  level: FlorCall,
  winner?: TeamId,
): number {
  if (level === 'contraflor_resto') {
    if (winner) {
      return Math.max(1, state.ruleset.targetPoints - state.score[winner]);
    }
    return faltaEnvidoPoints(state.score.A, state.score.B, state.ruleset.targetPoints);
  }
  // Flor base: 3 por CADA flor del equipo ganador (varias del mismo equipo suman).
  if (level === 'flor' && winner) return florBasePoints(state, winner);
  return FLOR_LEVEL_VALUE[level];
}

/** Resuelve el duelo de flores en el nivel aceptado (gana la flor más alta). */
function resolveFlorDuel(
  state: MatchState,
  acceptedLevel: FlorCall,
): Applied<MatchState> {
  const hand = state.hand;
  const { winner } = resolveFlorShowdown(state);
  const points = florLevelPoints(state, acceptedLevel, winner);
  const flor = { ...hand.flor, pendingCall: null, resolved: true };
  const score = addPoints(state.score, winner, points, state.ruleset);
  const events: GameEvent[] = [
    { type: 'FLOR_RESOLVED', winner, points },
    { type: 'POINTS_AWARDED', team: winner, points, reason: 'flor' },
  ];
  return maybeGameOver({ ...state, score, hand: { ...hand, flor } }, events);
}

/** Jugadores activos que TIENEN flor esta mano. */
function florHolders(state: MatchState): Player[] {
  const muestra = state.hand.muestra;
  return state.players.filter((p) => !p.folded && calcFlor(p.hand, muestra).hasFlor);
}

/**
 * Puntos de la FLOR base para un equipo GANADOR: 3 por CADA flor de ESE equipo.
 * Las flores del mismo equipo suman entre sí (no se cuentan las del rival):
 *   1 flor = 3 · 2 flores = 6 · 3 flores = 9.
 * En 1v1 disputado, el ganador tiene 1 flor ⇒ 3 (no se suma la del rival).
 */
function florBasePoints(state: MatchState, winner: TeamId): number {
  const own = florHolders(state).filter((p) => p.team === winner).length;
  return FLOR_BASE_POINTS * Math.max(1, own);
}

/**
 * Showdown de Flor: gana el bando con la flor más alta (empate ⇒ mano) y se
 * lleva 3 por CADA flor de SU equipo (ver florBasePoints).
 */
function resolveFlorShowdown(state: MatchState): { winner: TeamId; points: number } {
  const muestra = state.hand.muestra;
  const n = state.players.length;
  const holders = florHolders(state);

  // Gana la flor más alta; en empate, prioridad INDIVIDUAL de mano (el más
  // mano), igual que el envido. Reutiliza el mismo criterio determinista.
  const entries: EnvidoEntry[] = holders.map((p) => ({
    seat: p.seat,
    team: p.team,
    value: calcFlor(p.hand, muestra).value,
  }));
  const winner = envidoWinnerFrom(entries, state.hand.manoSeat, n);
  return { winner, points: florBasePoints(state, winner) };
}

// -------------------------------------------------------------
// ACCEPT / DECLINE
// -------------------------------------------------------------

function doAccept(state: MatchState, seat: Seat): Applied<MatchState> {
  const hand = state.hand;
  const team = state.players[seat].team;

  // Flor: aceptar el duelo de flores en el nivel pendiente (Flor=6, Resto=falta).
  if (hand.flor.pendingCall) {
    if (!canRespondFlor(hand.flor, team)) {
      throw new Error('No te toca responder la Flor');
    }
    const applied = resolveFlorDuel(state, hand.flor.pendingCall);
    return {
      state: applied.state,
      events: [{ type: 'CALL_ACCEPTED', seat }, ...applied.events],
    };
  }

  if (hand.envido.pending) {
    const envido = acceptEnvido(hand.envido, team);
    const withEnvido = { ...state, hand: { ...hand, envido } };
    const { winner } = resolveEnvidoShowdown(withEnvido);
    const points = envidoPointsAtStake(
      envido,
      { A: state.score.A, B: state.score.B },
      state.ruleset.targetPoints,
    );
    const score = addPoints(state.score, winner, points, state.ruleset);
    const events: GameEvent[] = [
      { type: 'CALL_ACCEPTED', seat },
      { type: 'ENVIDO_RESOLVED', winner, points },
      { type: 'POINTS_AWARDED', team: winner, points, reason: 'envido' },
    ];
    return maybeGameOver({ ...withEnvido, score }, events);
  }

  if (hand.truco.pending) {
    const truco = acceptTruco(hand.truco, team);
    return {
      state: { ...state, hand: { ...hand, truco } },
      events: [{ type: 'CALL_ACCEPTED', seat }],
    };
  }

  throw new Error('No hay ningún canto para aceptar');
}

function doDecline(state: MatchState, seat: Seat): Applied<MatchState> {
  const hand = state.hand;
  const team = state.players[seat].team;

  // Flor: sólo se rechaza una SUBIDA (Con Flor Envido / Contraflor al resto);
  // a la flor simple se la acepta o se sube. El que subió se lleva los puntos
  // del nivel que ya estaba en la mesa (Flor=3 o Con Flor Envido=5).
  if (hand.flor.pendingCall) {
    if (!canRespondFlor(hand.flor, team)) {
      throw new Error('No te toca responder la Flor');
    }
    if (hand.flor.pendingCall === 'flor') {
      throw new Error('No podés rechazar la Flor: aceptá o subí la apuesta');
    }
    const winner = hand.flor.callerTeam!;
    const points = florLevelPoints(state, hand.flor.call, winner);
    const flor = { ...hand.flor, pendingCall: null, resolved: true };
    const score = addPoints(state.score, winner, points, state.ruleset);
    const events: GameEvent[] = [
      { type: 'CALL_DECLINED', seat },
      { type: 'FLOR_RESOLVED', winner, points },
      { type: 'POINTS_AWARDED', team: winner, points, reason: 'flor_no_querido' },
    ];
    return maybeGameOver({ ...state, score, hand: { ...hand, flor } }, events);
  }

  if (hand.envido.pending) {
    const res = declineEnvido(
      hand.envido,
      team,
      { A: state.score.A, B: state.score.B },
      state.ruleset.targetPoints,
    );
    const score = addPoints(state.score, res.winner, res.points, state.ruleset);
    const events: GameEvent[] = [
      { type: 'CALL_DECLINED', seat },
      { type: 'POINTS_AWARDED', team: res.winner, points: res.points, reason: 'envido_no_querido' },
    ];
    return maybeGameOver(
      { ...state, score, hand: { ...hand, envido: res.state } },
      events,
    );
  }

  if (hand.truco.pending) {
    const res = declineTruco(hand.truco, team);
    const events: GameEvent[] = [{ type: 'CALL_DECLINED', seat }];
    return finishHand(
      { ...state, hand: { ...hand, truco: res.state } },
      res.winner,
      res.points,
      'truco_no_querido',
      events,
    );
  }

  throw new Error('No hay ningún canto para rechazar');
}

// -------------------------------------------------------------
// FOLD (irse al mazo)
// -------------------------------------------------------------

function doFold(state: MatchState, seat: Seat): Applied<MatchState> {
  const hand = state.hand;
  if (pendingResponse(hand)) {
    throw new Error('Hay un canto pendiente: respondé antes de irte al mazo');
  }
  const team = state.players[seat].team;
  const winner = otherTeam(team);
  // El rival cobra los puntos del Truco en su estado actual.
  const points = trucoPointsAtStake(hand.truco);
  const events: GameEvent[] = [{ type: 'PLAYER_FOLDED', seat }];
  return finishHand(state, winner, points, 'mazo', events);
}

// -------------------------------------------------------------
// ECHAR LOS PERROS (respuesta en ley / a punto)
// -------------------------------------------------------------

function doDeclarePerros(
  state: MatchState,
  seat: Seat,
  response: 'en_ley' | 'a_punto',
): Applied<MatchState> {
  void seat;
  const hand = state.hand;
  const flor = { ...hand.flor, perros: response };
  return { state: { ...state, hand: { ...hand, flor } }, events: [] };
}

// -------------------------------------------------------------
// Cierre de mano y de partida
// -------------------------------------------------------------

function finishHand(
  state: MatchState,
  winner: TeamId,
  points: number,
  reason: string,
  events: GameEvent[],
): Applied<MatchState> {
  const score = addPoints(state.score, winner, points, state.ruleset);
  const finishedHand: HandState = { ...state.hand, finished: true, winner };
  const evts: GameEvent[] = [
    ...events,
    { type: 'POINTS_AWARDED', team: winner, points, reason },
    { type: 'HAND_ENDED', winner },
  ];
  return maybeGameOver({ ...state, score, hand: finishedHand }, evts);
}

/** Detecta fin de partida; si no, deja la mano lista para repartir la próxima. */
function maybeGameOver(
  state: MatchState,
  events: GameEvent[],
): Applied<MatchState> {
  const winner = gameWinner(state.score, state.ruleset);
  if (winner) {
    return {
      state: { ...state, phase: 'finished', winner },
      events: [...events, { type: 'GAME_OVER', winner }],
    };
  }
  return { state, events };
}

/**
 * Reparte la siguiente mano (rota el reparto). Se llama tras `HAND_ENDED`
 * cuando la mano quedó `finished` y la partida sigue en juego.
 */
export function startNextHand(state: MatchState): MatchState {
  if (state.phase === 'finished') {
    throw new Error('La partida ya terminó');
  }
  if (!state.hand.finished) {
    throw new Error('La mano actual todavía no terminó');
  }

  // ---- Estamos DENTRO de una ronda de Pico a Pico: terminó un duelo. ----
  if (state.picoRound) {
    return advancePicoRound(state);
  }

  // ---- Modo NORMAL. En 3v3 con Pico a Pico y ambos en malas, tras la mano
  // normal se rota el mazo y COMIENZA la ronda de duelos (reparto único).
  const publicScore = picoPublicScore(state);
  if (
    state.picoAPico &&
    state.mode === '3v3' &&
    picoCycleContinues(publicScore, state.ruleset)
  ) {
    return enterPicoRound(state);
  }

  const n = state.players.length;
  return dealHand({ ...state, dealerSeat: nextSeat(state.dealerSeat, n) });
}

/** Marcador público real (durante una ronda de pico vive en picoPublic). */
function picoPublicScore(state: MatchState): Score {
  return state.picoPublic ?? state.score;
}

/** Injerta el duelo `duelIndex` de `round` sobre el estado (mazo congelado). */
function graftDuel(state: MatchState, round: PicoRound, duelIndex: number): MatchState {
  const duel = buildDuelState(round, duelIndex, state.ruleset, state.seed);
  return {
    ...state,
    players: duel.players,
    hand: duel.hand,
    score: initScore(), // marcador AISLADO del duelo (los tantos van ocultos)
    picoRound: round as unknown as PicoRoundData,
  };
}

/** Comienza una ronda de Pico a Pico: reparto único, mazo congelado, duelo 0. */
function enterPicoRound(state: MatchState): MatchState {
  const roundNumber = (state.picoRoundNumber ?? 0) + 1;
  const round = startPicoRound(state.seed, 1000 + roundNumber);
  const base: MatchState = {
    ...state,
    picoPublic: picoPublicScore(state),
    picoRoundNumber: roundNumber,
  };
  return graftDuel(base, round, 0);
}

/** Terminó un duelo: registra su resultado OCULTO y avanza (o revela). */
function advancePicoRound(state: MatchState): MatchState {
  const round = state.picoRound as unknown as PicoRound;
  // finishDuel lee el marcador AISLADO del duelo (state.score) como deltas ocultos.
  const events: GameEvent[] = [];
  if (state.score.A > 0) {
    events.push({ type: 'POINTS_AWARDED', team: 'A', points: state.score.A, reason: 'pico_duel' });
  }
  if (state.score.B > 0) {
    events.push({ type: 'POINTS_AWARDED', team: 'B', points: state.score.B, reason: 'pico_duel' });
  }
  const advanced = finishDuel(round, state, events);

  if (advanced.phase === 'PICO_REVELACION') {
    return revealAndReturnToNormal(state, advanced);
  }
  // Siguiente duelo con las MISMAS cartas repartidas (el mazo NO se mueve).
  return graftDuel(state, advanced, advanced.currentDuel);
}

/** Revela los tantos ocultos, los suma al marcador público y vuelve a 3v3. */
function revealAndReturnToNormal(state: MatchState, round: PicoRound): MatchState {
  const totals = revealTotals(round);
  let publicScore = picoPublicScore(state);
  if (totals.A > 0) publicScore = addPoints(publicScore, 'A', totals.A, state.ruleset);
  if (totals.B > 0) publicScore = addPoints(publicScore, 'B', totals.B, state.ruleset);

  const winner = gameWinner(publicScore, state.ruleset);
  const cleared: MatchState = {
    ...state,
    score: publicScore,
    picoPublic: undefined,
    picoRound: undefined,
  };

  if (winner) {
    return {
      ...cleared,
      phase: 'finished',
      winner,
      hand: { ...state.hand, finished: true, winner },
    };
  }
  // La partida sigue: se reparte una mano NORMAL de 3v3 (rota el mazo).
  const n = state.players.length;
  return dealHand({ ...cleared, dealerSeat: nextSeat(state.dealerSeat, n) });
}
