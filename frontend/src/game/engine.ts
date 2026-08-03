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
import type { Action } from './actions';
import type { GameEvent, Applied } from './events';
import type { HandState, MatchState, Player, Trick } from './state';
import type { Card, Seat, TeamId } from './types';
import { sameCard } from './deck';
import { resolveTrick, resolveHand, type Play } from './tricks';
import {
  canCallTruco,
  callTruco,
  acceptTruco,
  declineTruco,
  trucoPointsAtStake,
} from './trucoBetting';
import {
  canCallEnvido,
  callEnvido,
  acceptEnvido,
  declineEnvido,
  envidoPointsAtStake,
} from './envidoBetting';
import { declareFlor } from './florBetting';
import { calcEnvido } from './envido';
import { calcFlor, FLOR_BASE_POINTS } from './flor';
import { addPoints, gameWinner } from './scoring';
import { dealHand, nextSeat, manoRank } from './setup';

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
export type PendingKind = 'truco' | 'envido';
export interface PendingInfo {
  kind: PendingKind;
  callerTeam: TeamId;
}

function pendingResponse(hand: HandState): PendingInfo | null {
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
  const seat = state.players.find(
    (p) => !p.folded && p.team !== pending.callerTeam,
  )?.seat;
  return seat ?? null;
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

  switch (action.type) {
    case 'PLAY_CARD':
      return playCard(state, action.seat, action.card);
    case 'CALL_TRUCO':
      return doCallTruco(state, action.seat, action.call);
    case 'CALL_ENVIDO':
      return doCallEnvido(state, action.seat, action.call);
    case 'CALL_FLOR':
      return doCallFlor(state, action.seat);
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

  const nextLead = result.winnerSeat ?? hand.manoSeat;
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

/** ¿Algún jugador tiene Flor? (anula el Envido). */
function anyFlorPresent(state: MatchState): boolean {
  if (!state.ruleset.withFlor) return false;
  return state.players.some(
    (p) => !p.folded && calcFlor(p.hand, state.hand.muestra).hasFlor,
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

function doCallFlor(state: MatchState, seat: Seat): Applied<MatchState> {
  const hand = state.hand;
  if (!state.ruleset.withFlor) throw new Error('Reglamento sin Flor');
  if (hand.flor.resolved) throw new Error('La Flor ya fue resuelta');
  const player = state.players[seat];
  if (player.folded) throw new Error('El jugador se fue al mazo');
  if (player.played.length > 0) {
    throw new Error('Ya jugaste: no podés cantar Flor');
  }
  if (!hand.envidoWindowOpen) throw new Error('La ventana de Flor está cerrada');
  if (!calcFlor(player.hand, hand.muestra).hasFlor) {
    throw new Error('El jugador no tiene Flor');
  }

  // Se canta la Flor. Como es obligatoria y se muestra, se resuelve al
  // instante comparando los valores reales de ambos bandos (el que canta
  // primero dispara la comparación; el ganador se define por el tanto de
  // flor más alto, no por quién cantó).
  const declared = declareFlor(hand.flor, player.team);
  const { winner, points } = resolveFlorShowdown(state);
  const flor = { ...declared, resolved: true, callerTeam: player.team };
  const score = addPoints(state.score, winner, points, state.ruleset);
  const events: GameEvent[] = [
    { type: 'FLOR_DECLARED', seat, team: player.team },
    { type: 'FLOR_RESOLVED', winner, points },
    { type: 'POINTS_AWARDED', team: winner, points, reason: 'flor' },
  ];
  return maybeGameOver({ ...state, score, hand: { ...hand, flor } }, events);
}

/**
 * Showdown de Flor: gana el bando con la flor más alta (empate ⇒ mano).
 * Una sola flor vale la base (3); si ambos bandos tienen flor, el ganador
 * se lleva 3 por la propia + 3 por la contra (6 en 1v1).
 */
function resolveFlorShowdown(state: MatchState): { winner: TeamId; points: number } {
  const muestra = state.hand.muestra;
  const best: Record<TeamId, number> = { A: -1, B: -1 };
  for (const p of state.players) {
    if (p.folded) continue;
    const f = calcFlor(p.hand, muestra);
    if (f.hasFlor && f.value > best[p.team]) best[p.team] = f.value;
  }
  const teams = (['A', 'B'] as TeamId[]).filter((t) => best[t] >= 0);
  const points = FLOR_BASE_POINTS * teams.length; // 3 una flor, 6 si hay dos
  if (teams.length === 1) return { winner: teams[0], points };
  if (best.A === best.B) return { winner: state.hand.manoTeam, points };
  return { winner: best.A > best.B ? 'A' : 'B', points };
}

// -------------------------------------------------------------
// ACCEPT / DECLINE
// -------------------------------------------------------------

function doAccept(state: MatchState, seat: Seat): Applied<MatchState> {
  const hand = state.hand;
  const team = state.players[seat].team;

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
  const n = state.players.length;
  const rotated: MatchState = { ...state, dealerSeat: nextSeat(state.dealerSeat, n) };
  return dealHand(rotated);
}
