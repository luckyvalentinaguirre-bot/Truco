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

    if (q.length < cap) {
      return { status: 'queued', mode, inQueue: q.length, need: cap };
    }

    // Cupo completo: tomar los primeros `cap`, equilibrar y crear la partida.
    const group = q.splice(0, cap);
    const seatUsers = this.assignSeats(group);
    const matchId = this.createMatch(mode, seatUsers);
    seatUsers.forEach((uid, seat) => {
      this.assignments.set(uid, { matchId, seat, mode });
    });
    const mine = this.assignments.get(userId)!;
    return { status: 'matched', ...mine };
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
    const asg = this.assignments.get(userId);
    if (asg) return { status: 'matched', ...asg };
    const mode = this.modeOf(userId);
    if (mode) return { status: 'queued', mode };
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
