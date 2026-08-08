/* =============================================================
 * Servidor online · MatchRuntime (AUTORIDAD de una partida activa)
 * -------------------------------------------------------------
 * Única autoridad sobre el estado real: reparto, muestra, turnos, cantos,
 * puntos, ganador, Pico a Pico y revelación. El motor validado
 * (packages/game-rules) es la fuente de verdad reglamentaria; este runtime
 * controla la EJECUCIÓN y la PRIVACIDAD (redactStateFor por asiento).
 *
 * Nunca confía en seat/team/userId del cliente: los resuelve desde el
 * binding sesión→asiento. Cada acción pasa por validación completa (§7).
 *
 * Pico a Pico (3v3) se ejecuta como fase interna con mazo congelado y
 * tantos ocultos hasta la revelación, reutilizando picoRound (no son tres
 * partidas separadas).
 * ============================================================= */
import {
  createMatch,
  applyAction,
  actorNow,
  chooseAiAction,
  startNextHand,
  redactStateFor,
  isLegal,
  gameWinner,
  addPoints,
  playerAt,
  canToca,
  canPeekTeammate,
  teammatePeekCards,
  startPicoRound,
  buildDuelState,
  finishDuel,
  revealTotals,
  redactPicoRoundFor,
  picoCycleContinues,
  pairSeats,
  type MatchState,
  type GameMode,
  type Ruleset,
  type Seat,
  type TeamId,
  type Card,
  type GameEvent,
  type PicoRound,
} from '@truco/game-rules';
import { OFFICIAL_40 } from '@truco/game-rules';
import { toEngineAction, type ClientAction } from './protocol.js';

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
export type RuntimePhase = 'normal' | 'pico';

/** Duración objetivo de un turno (autoridad del tiempo = servidor). */
export const TURN_MS = 30_000;

export interface SeatBinding {
  seat: Seat;
  team: TeamId;
  userId: string;
  status: ConnectionStatus;
}

export interface ApplyResult {
  ok: boolean;
  reason?: string;
  events?: GameEvent[];
}

/** Snapshot AUTORIZADO para un asiento (lo único que sale por la red). */
export interface Snapshot {
  matchId: string;
  mode: GameMode;
  viewerSeat: Seat | null; // null = espectador
  runtimePhase: RuntimePhase;
  picoPhase: string | null;
  currentDuel: number | null;
  deckPosition: number | null;
  score: { A: number; B: number };
  phase: 'playing' | 'finished';
  winner: TeamId | null;
  actorSeat: Seat | null;
  turnDeadline: number | null;
  seats: { seat: Seat; team: TeamId; status: ConnectionStatus }[];
  /** Estado de juego redactado (motor). En pico, es el duelo redactado. */
  game: MatchState;
  /** Sólo presente/parcial según privacidad del Pico a Pico. */
  pico: Partial<PicoRound> | null;
  /** Resultados revelados (sólo tras PICO_REVELACION). */
  revealedTotals: { A: number; B: number } | null;
}

export interface CreateRuntimeOptions {
  matchId: string;
  mode: GameMode;
  ruleset?: Ruleset;
  seed?: number;
  picoAPico?: boolean;
  /** userIds por asiento (índice = asiento). Longitud = jugadores del modo. */
  seatUsers: string[];
}

export class MatchRuntime {
  readonly matchId: string;
  readonly mode: GameMode;
  private readonly ruleset: Ruleset;
  private readonly seed: number;
  private readonly picoEnabled: boolean;
  private seats: SeatBinding[];

  private runtimePhase: RuntimePhase = 'normal';
  private state: MatchState; // estado 3v3/2v2/1v1 normal (autoridad del score público)
  private round: PicoRound | null = null; // ronda de pico en curso
  private duel: MatchState | null = null; // sub-estado del duelo en curso
  private picoRoundNumber = 0;
  private lastRevealTotals: { A: number; B: number } | null = null;

  private turnStartedAt: number;
  private turnDeadline: number;
  private now: () => number;

  constructor(opts: CreateRuntimeOptions, now: () => number = Date.now) {
    this.matchId = opts.matchId;
    this.mode = opts.mode;
    this.ruleset = opts.ruleset ?? OFFICIAL_40;
    this.seed = opts.seed ?? Math.floor(Math.random() * 0xffffffff);
    // El Pico a Pico lo administra el runtime (fase interna); el motor arranca
    // una partida 3v3 NORMAL, no el modelo viejo de duelos.
    this.picoEnabled = opts.mode === '3v3' && opts.picoAPico === true;
    this.now = now;

    this.state = createMatch({ mode: opts.mode, ruleset: this.ruleset, seed: this.seed });
    this.seats = this.state.players.map((p) => ({
      seat: p.seat,
      team: p.team,
      userId: opts.seatUsers[p.seat] ?? '',
      status: 'DISCONNECTED' as ConnectionStatus,
    }));
    this.turnStartedAt = this.now();
    this.turnDeadline = this.turnStartedAt + TURN_MS;
  }

  // ---- Binding sesión → asiento (el servidor decide, nunca el cliente) ----

  seatOfUser(userId: string): Seat | null {
    const b = this.seats.find((s) => s.userId === userId);
    return b ? b.seat : null;
  }

  hasUser(userId: string): boolean {
    return this.seats.some((s) => s.userId === userId);
  }

  setConnection(userId: string, status: ConnectionStatus): void {
    const b = this.seats.find((s) => s.userId === userId);
    if (b) b.status = status;
  }

  /** Reconexión: no reinicia la partida; devuelve el snapshot autorizado. */
  reconnect(userId: string): Snapshot | null {
    const seat = this.seatOfUser(userId);
    if (seat === null) return null;
    this.setConnection(userId, 'CONNECTED');
    return this.snapshotForSeat(seat);
  }

  // ---- Estado activo (motor) según la fase de runtime ----

  private activeState(): MatchState {
    return this.runtimePhase === 'pico' && this.duel ? this.duel : this.state;
  }

  private resetTurnClock(): void {
    this.turnStartedAt = this.now();
    this.turnDeadline = this.turnStartedAt + TURN_MS;
  }

  // ---- Aplicación de acciones (validación completa §7) ----

  applyClientAction(userId: string, action: ClientAction): ApplyResult {
    const seat = this.seatOfUser(userId);
    if (seat === null) return { ok: false, reason: 'not_in_match' };
    if (this.state.phase === 'finished') return { ok: false, reason: 'match_finished' };

    // Meta-acciones (no reglamentarias): TOCA, ver cartas de compañero.
    if (action.type === 'TOCA') {
      return canToca(this.activeState(), seat)
        ? { ok: true, events: [] }
        : { ok: false, reason: 'toca_not_allowed' };
    }
    if (action.type === 'SELECT_TEAMMATE') return { ok: true, events: [] };
    if (action.type === 'VIEW_TEAMMATE_CARDS') {
      return canPeekTeammate(this.activeState(), seat, action.seat)
        ? { ok: true, events: [] }
        : { ok: false, reason: 'peek_not_allowed' };
    }

    const gs = this.activeState();
    if (gs.hand.finished) return { ok: false, reason: 'hand_finished' };

    // Turno / autorización: sólo el actor puede actuar (responder o jugar).
    const actor = actorNow(gs);
    if (actor === null) return { ok: false, reason: 'no_actor' };
    if (actor !== seat) return { ok: false, reason: 'not_your_turn' };

    const myHand = playerAt(gs, seat).hand;
    const engineAction = toEngineAction(action, seat, myHand);
    if (!engineAction) return { ok: false, reason: 'invalid_action' };
    if (!isLegal(gs, engineAction)) return { ok: false, reason: 'illegal_action' };

    const applied = applyAction(gs, engineAction);
    this.commit(applied.state);
    this.resetTurnClock();
    return { ok: true, events: applied.events };
  }

  /**
   * Juega el turno del actor actual con la IA, sobre el estado REAL (autoridad
   * completa). Infraestructura para reemplazo por bot ante inactividad/abandono
   * (§24). Devuelve false si no hay actor. El servidor corre la IA internamente;
   * jamás depende de información redactada.
   */
  stepBot(rng: () => number = Math.random): boolean {
    const gs = this.activeState();
    const seat = gs.hand.finished || gs.phase === 'finished' ? null : actorNow(gs);
    if (seat === null) return false;
    const action = chooseAiAction(gs, seat, rng, { difficulty: 'normal' });
    if (!action) return false;
    const applied = applyAction(gs, action);
    this.commit(applied.state);
    this.resetTurnClock();
    return true;
  }

  /** Escribe el nuevo estado del motor y avanza el flujo (manos / pico). */
  private commit(next: MatchState): void {
    if (this.runtimePhase === 'pico') {
      this.duel = next;
      this.advancePicoIfNeeded();
    } else {
      this.state = next;
      this.advanceNormalIfNeeded();
    }
  }

  /** Fin de mano normal: pasa a la siguiente (o entra en Pico a Pico). */
  private advanceNormalIfNeeded(): void {
    if (this.state.phase === 'finished') return;
    if (!this.state.hand.finished) return;

    // 3v3 con Pico a Pico habilitado y ambos en malas ⇒ tras la mano normal,
    // rota el mazo y comienza la ronda de Pico a Pico (§2/§13/§29).
    if (this.picoEnabled && picoCycleContinues(this.state.score, this.ruleset)) {
      this.enterPicoRound();
      return;
    }
    this.state = startNextHand(this.state);
    this.resetTurnClock();
  }

  /** Comienza una ronda de Pico a Pico: reparto único, mazo congelado. */
  private enterPicoRound(): void {
    this.picoRoundNumber += 1;
    // "Rotación del mazo" + reparto único determinista de la ronda.
    this.round = startPicoRound(this.seed, 1000 + this.picoRoundNumber);
    this.duel = buildDuelState(this.round, 0, this.ruleset, this.seed);
    this.runtimePhase = 'pico';
    this.lastRevealTotals = null;
    this.resetTurnClock();
  }

  /** Fin de un duelo: registra oculto y avanza; tras el 3.º, revela. */
  private advancePicoIfNeeded(): void {
    if (!this.round || !this.duel) return;
    if (!this.duel.hand.finished) return;

    // Cerramos el duelo capturando su resultado OCULTO (deltas + detalle).
    const events = this.duelEventsFromScore(this.duel);
    this.round = finishDuel(this.round, this.duel, events);

    if (this.round.phase === 'PICO_REVELACION') {
      this.revealAndReturnToNormal();
      return;
    }
    // Siguiente duelo con las MISMAS cartas (mazo congelado).
    this.duel = buildDuelState(this.round, this.round.currentDuel, this.ruleset, this.seed);
    this.resetTurnClock();
  }

  /** Aplica los tantos ocultos al score real y vuelve a 3v3 normal (§20/§30). */
  private revealAndReturnToNormal(): void {
    if (!this.round) return;
    const totals = revealTotals(this.round);
    this.lastRevealTotals = totals;
    let score = this.state.score;
    if (totals.A > 0) score = addPoints(score, 'A', totals.A, this.ruleset);
    if (totals.B > 0) score = addPoints(score, 'B', totals.B, this.ruleset);

    const winner = gameWinner(score, this.ruleset);
    this.state = {
      ...this.state,
      score,
      ...(winner ? { phase: 'finished' as const, winner } : {}),
    };
    this.round = null;
    this.duel = null;
    this.runtimePhase = 'normal';

    // Si la partida sigue, preparamos la próxima mano normal de 3v3.
    if (this.state.phase !== 'finished') {
      // La mano actual quedó marcada como terminada por la última jugada normal
      // previa; forzamos una nueva mano normal.
      this.state = startNextHand({
        ...this.state,
        hand: { ...this.state.hand, finished: true, winner: this.state.hand.winner ?? 'A' },
      });
      this.resetTurnClock();
    }
  }

  /** Deriva los POINTS_AWARDED de un duelo a partir de su score final aislado. */
  private duelEventsFromScore(duel: MatchState): GameEvent[] {
    const evts: GameEvent[] = [];
    if (duel.score.A > 0) {
      evts.push({ type: 'POINTS_AWARDED', team: 'A', points: duel.score.A, reason: 'pico_duel' });
    }
    if (duel.score.B > 0) {
      evts.push({ type: 'POINTS_AWARDED', team: 'B', points: duel.score.B, reason: 'pico_duel' });
    }
    return evts;
  }

  // ---- Snapshots redactados por asiento (§9) ----

  snapshotForUser(userId: string): Snapshot {
    const seat = this.seatOfUser(userId);
    return this.snapshotForSeat(seat);
  }

  /** Snapshot público (espectador): sin cartas privadas ni tantos ocultos. */
  spectatorSnapshot(): Snapshot {
    return this.snapshotForSeat(null);
  }

  private snapshotForSeat(seat: Seat | null): Snapshot {
    const gs = this.activeState();
    // Vista redactada del estado del motor. Para espectador (seat null) usamos
    // un asiento imposible (-1) para que redactStateFor oculte TODAS las manos.
    const redacted = redactStateFor(gs, (seat ?? -1) as Seat);
    const inPico = this.runtimePhase === 'pico' && this.round;

    const picoView =
      inPico && this.round
        ? redactPicoRoundFor(this.round, (seat ?? -1) as Seat)
        : null;

    const actor = gs.hand.finished || gs.phase === 'finished' ? null : actorNow(gs);

    return {
      matchId: this.matchId,
      mode: this.mode,
      viewerSeat: seat,
      runtimePhase: this.runtimePhase,
      picoPhase: inPico && this.round ? this.round.phase : null,
      currentDuel: inPico && this.round ? this.round.currentDuel : null,
      deckPosition: inPico && this.round ? this.round.deckPosition : null,
      score: { A: this.state.score.A, B: this.state.score.B },
      phase: this.state.phase,
      winner: this.state.winner,
      actorSeat: actor,
      turnDeadline: this.turnDeadline,
      seats: this.seats.map((s) => ({ seat: s.seat, team: s.team, status: s.status })),
      game: redacted,
      pico: picoView,
      revealedTotals: this.lastRevealTotals,
    };
  }

  /** Cartas de un compañero autorizadas para `viewer` (peek de 5s, §10). */
  teammatePeek(userId: string, targetSeat: Seat): Card[] | null {
    const viewer = this.seatOfUser(userId);
    if (viewer === null) return null;
    const gs = this.activeState();
    if (!canPeekTeammate(gs, viewer, targetSeat)) return null;
    return teammatePeekCards(gs, viewer, targetSeat);
  }

  // ---- Introspección (para tests / persistencia) ----

  get publicScore(): { A: number; B: number } {
    return { A: this.state.score.A, B: this.state.score.B };
  }
  get isFinished(): boolean {
    return this.state.phase === 'finished';
  }
  get phaseName(): RuntimePhase {
    return this.runtimePhase;
  }
  get picoRound(): PicoRound | null {
    return this.round;
  }
  get currentActorSeat(): Seat | null {
    const gs = this.activeState();
    if (gs.hand.finished || gs.phase === 'finished') return null;
    return actorNow(gs);
  }
  /** userId del actor actual (para que el runner sepa a quién le toca). */
  get currentActorUser(): string | null {
    const seat = this.currentActorSeat;
    if (seat === null) return null;
    const b = this.seats.find((s) => s.seat === seat);
    return b ? b.userId : null;
  }
  duelParticipants(): { seatA: Seat; seatB: Seat } | null {
    if (this.runtimePhase !== 'pico' || !this.round) return null;
    return pairSeats(this.round.currentDuel);
  }
}
