/* =============================================================
 * Servidor online · MatchManager (partidas activas en memoria)
 * -------------------------------------------------------------
 * Registro de runtimes en curso: Map<matchId, MatchRuntime>. Provee el
 * ciclo de vida mínimo (§4/§27/§28). El matchmaking avanzado con ELO es una
 * etapa posterior; acá sólo la infraestructura para crear/unir/recuperar.
 * ============================================================= */
import { randomUUID } from 'node:crypto';
import { MatchRuntime, type CreateRuntimeOptions } from './match-runtime.js';

export class MatchManager {
  private matches = new Map<string, MatchRuntime>();

  /** Crea una partida con un id único (el servidor decide el id, no el cliente). */
  createMatch(opts: Omit<CreateRuntimeOptions, 'matchId'> & { matchId?: string }): MatchRuntime {
    const matchId = opts.matchId ?? randomUUID();
    if (this.matches.has(matchId)) throw new Error('matchId ya existe');
    const rt = new MatchRuntime({ ...opts, matchId });
    this.matches.set(matchId, rt);
    return rt;
  }

  getMatch(matchId: string): MatchRuntime | null {
    return this.matches.get(matchId) ?? null;
  }

  /** Encuentra la partida a la que pertenece un usuario (para reconexión). */
  matchOfUser(userId: string): MatchRuntime | null {
    for (const rt of this.matches.values()) {
      if (rt.hasUser(userId)) return rt;
    }
    return null;
  }

  removeMatch(matchId: string): boolean {
    return this.matches.delete(matchId);
  }

  /** Limpia partidas terminadas (evita partidas huérfanas, §27). */
  sweepFinished(): number {
    let removed = 0;
    for (const [id, rt] of this.matches) {
      if (rt.isFinished) {
        this.matches.delete(id);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.matches.size;
  }

  /** Todas las partidas activas (para el scheduler de timeouts). */
  all(): MatchRuntime[] {
    return [...this.matches.values()];
  }
}

/** Instancia compartida del proceso. */
export const matchManager = new MatchManager();
