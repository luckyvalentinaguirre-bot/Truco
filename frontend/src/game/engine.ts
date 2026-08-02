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
import { calcFlor } from './flor';
import { addPoints, gameWinner } from './scoring';
import { dealHand, nextSeat } from './setup';

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
function pendingResponse(hand: HandState): { callerTeam: TeamId } | null {
  if (hand.truco.pending) return { callerTeam: hand.truco.callerTeam! };
  if (hand.envido.pending) return { callerTeam: hand.envido.callerTeam! };
  return null;
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

/** Showdown de Envido: gana el tanto más alto; empate ⇒ mano. */
function resolveEnvidoShowdown(state: MatchState): {
  winner: TeamId;
} {
  const best: Record<TeamId, number> = { A: -1, B: -1 };
  for (const p of state.players) {
    if (p.folded) continue;
    const v = calcEnvido(p.hand, state.hand.muestra).value;
    if (v > best[p.team]) best[p.team] = v;
  }
  if (best.A === best.B) return { winner: state.hand.manoTeam };
  return { winner: best.A > best.B ? 'A' : 'B' };
}

// -------------------------------------------------------------
// FLOR
// -------------------------------------------------------------

function doCallFlor(state: MatchState, seat: Seat): Applied<MatchState> {
  const hand = state.hand;
  if (!state.ruleset.withFlor) throw new Error('Reglamento sin Flor');
  const player = state.players[seat];
  if (!calcFlor(player.hand, hand.muestra).hasFlor) {
    throw new Error('El jugador no tiene Flor');
  }
  const flor = declareFlor(hand.flor, player.team);
  return {
    state: { ...state, hand: { ...hand, flor } },
    events: [{ type: 'FLOR_DECLARED', seat, team: player.team }],
  };
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
