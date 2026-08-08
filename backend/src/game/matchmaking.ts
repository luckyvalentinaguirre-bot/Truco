/* =============================================================
 * Servidor online · Matchmaking por ELO (cola en memoria)
 * -------------------------------------------------------------
 * Empareja jugadores por MODO y los agrupa cuando se completa el cupo (2/4/6).
 * Para equilibrar, ordena por rating y arma equipos alternando; los asientos
 * quedan A (pares) / B (impares) como espera el motor. Al completar el cupo se
 * crea una partida RANKED (afecta ELO al terminar). El servidor decide asiento
 * y equipo; el cliente nunca los elige.
 * ============================================================= */
import type { GameMode } from '@truco/game-rules';
import { matchManager } from './match-manager.js';

const CAPACITY: Record<string, number> = { '1v1': 2, '2v2': 4, '3v3': 6 };

/**
 * Tolerancia de rating (rango de búsqueda) según el tiempo de espera: arranca
 * angosta y se ENSANCHA con el tiempo, para emparejar primero con ELO cercano
 * y, si tarda, ampliar el rango. El emparejamiento NO afecta cuántos puntos se
 * ganan/pierden: eso lo decide el ELO según el rating del rival.
 */
const TOLERANCE_TIERS: { untilMs: number; tol: number }[] = [
  { untilMs: 5 * 60_000, tol: 150 }, // < 5 min: rango cercano ±150
  { untilMs: 10 * 60_000, tol: 400 }, // 5–10 min: ±400
  { untilMs: 15 * 60_000, tol: 900 }, // 10–15 min: ±900
  { untilMs: Infinity, tol: Infinity }, // > 15 min: cualquiera
];

export function toleranceFor(waitMs: number): number {
  for (const t of TOLERANCE_TIERS) if (waitMs < t.untilMs) return t.tol;
  return Infinity;
}

interface Waiting {
  userId: string;
  rating: number;
  joinedAt: number;
}

export interface Assignment {
  matchId: string;
  seat: number;
  mode: GameMode;
}

export type JoinResult =
  | { status: 'queued'; mode: GameMode; inQueue: number; need: number }
  | ({ status: 'matched' } & Assignment);

export type StatusResult = { status: 'idle' } | { status: 'queued'; mode: GameMode } | ({ status: 'matched' } & Assignment);

/** Crea la partida ranked y devuelve su id (inyectable para tests). */
export type MatchFactory = (mode: GameMode, seatUsers: string[]) => string;

export class Matchmaking {
  private queues = new Map<string, Waiting[]>();
  private assignments = new Map<string, Assignment>();

  constructor(private createMatch: MatchFactory, private now: () => number = Date.now) {}

  private queue(mode: string): Waiting[] {
    let q = this.queues.get(mode);
    if (!q) this.queues.set(mode, (q = []));
    return q;
  }

  /** ¿En qué cola está el usuario, si en alguna? */
  private modeOf(userId: string): GameMode | null {
    for (const [mode, q] of this.queues) {
      if (q.some((w) => w.userId === userId)) return mode as GameMode;
    }
    return null;
  }

  join(userId: string, rating: number, mode: GameMode): JoinResult {
    // Ya emparejado: devolver su asignación.
    const asg = this.assignments.get(userId);
    if (asg) return { status: 'matched', ...asg };

    const cap = CAPACITY[mode];
    if (!cap) throw new Error('modo no clasificatorio');

    const q = this.queue(mode);
    if (!q.some((w) => w.userId === userId)) {
      q.push({ userId, rating, joinedAt: this.now() });
    }

    this.tryMatchAll(mode);

    const mine = this.assignments.get(userId);
    if (mine) return { status: 'matched', ...mine };
    return { status: 'queued', mode, inQueue: this.queue(mode).length, need: cap };
  }

  /**
   * Forma tantas partidas como se pueda en el modo. Para el jugador que MÁS
   * esperó, la tolerancia (rango de rating) se ensancha con el tiempo; se
   * agrupan los `cap` jugadores de rating más cercano dentro de ese rango.
   */
  private tryMatchAll(mode: GameMode): void {
    const cap = CAPACITY[mode];
    // Mientras se pueda formar un grupo, formarlo.
    for (;;) {
      const q = this.queue(mode);
      if (q.length < cap) return;

      // El que más esperó define el rango (le corresponde el más amplio).
      const oldest = [...q].sort((a, b) => a.joinedAt - b.joinedAt)[0]!;
      const tol = toleranceFor(this.now() - oldest.joinedAt);
      const inRange = q
        .filter((w) => Math.abs(w.rating - oldest.rating) <= tol)
        .sort((a, b) => Math.abs(a.rating - oldest.rating) - Math.abs(b.rating - oldest.rating));

      if (inRange.length < cap) return; // aún no hay suficientes en el rango
      const group = inRange.slice(0, cap); // los `cap` más cercanos (incluye al más viejo)

      // Sacar al grupo de la cola.
      const ids = new Set(group.map((g) => g.userId));
      this.queues.set(
        mode,
        q.filter((w) => !ids.has(w.userId)),
      );

      const seatUsers = this.assignSeats(group);
      const matchId = this.createMatch(mode, seatUsers);
      seatUsers.forEach((uid, seat) => this.assignments.set(uid, { matchId, seat, mode }));
    }
  }

  /**
   * Ordena por rating y reparte a equipos A/B alternando (equilibrio simple);
   * A va a asientos pares, B a impares. Devuelve userIds por asiento.
   */
  private assignSeats(group: Waiting[]): string[] {
    const sorted = [...group].sort((a, b) => b.rating - a.rating);
    const teamA: string[] = [];
    const teamB: string[] = [];
    sorted.forEach((w, i) => (i % 2 === 0 ? teamA : teamB).push(w.userId));
    const seats: string[] = new Array(group.length);
    teamA.forEach((uid, i) => (seats[i * 2] = uid)); // asientos pares = equipo A
    teamB.forEach((uid, i) => (seats[i * 2 + 1] = uid)); // impares = equipo B
    return seats;
  }

  status(userId: string): StatusResult {
    // Al consultar, se reintenta emparejar: así el paso del tiempo ensancha el
    // rango aunque no entren nuevos jugadores (el cliente hace polling).
    const mode = this.modeOf(userId);
    if (mode) this.tryMatchAll(mode);

    const asg = this.assignments.get(userId);
    if (asg) return { status: 'matched', ...asg };
    const stillQueued = this.modeOf(userId);
    if (stillQueued) return { status: 'queued', mode: stillQueued };
    return { status: 'idle' };
  }

  /** Sale de la cola (si no fue emparejado todavía). */
  leave(userId: string): void {
    for (const q of this.queues.values()) {
      const i = q.findIndex((w) => w.userId === userId);
      if (i >= 0) q.splice(i, 1);
    }
  }

  /** Limpia la asignación una vez que el cliente ya se conectó a la partida. */
  clearAssignment(userId: string): void {
    this.assignments.delete(userId);
  }
}

/** Instancia compartida: crea partidas RANKED reales vía el MatchManager. */
export const matchmaking = new Matchmaking(
  (mode, seatUsers) => matchManager.createMatch({ mode, ranked: true, seatUsers }).matchId,
);
