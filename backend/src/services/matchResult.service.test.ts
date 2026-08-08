/* =============================================================
 * Integración · Registro del resultado competitivo (partida + ELO + historial).
 * Corre contra PostgreSQL real (DATABASE_URL); si no hay, se saltea.
 * ============================================================= */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { hasDatabase, prepareSchema, truncateAll } from '../repositories/testDb.js';
import { closePool } from '../db/pool.js';
import { createAccount } from './account.service.js';
import { createSeason } from '../repositories/seasons.repository.js';
import { getUserHistory } from '../repositories/matches.repository.js';
import { recordCompetitiveResult } from './matchResult.service.js';

const d = hasDatabase ? describe : describe.skip;
const day = 24 * 3600_000;

d('matchResult · registro competitivo', () => {
  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  async function makeUser(n: number) {
    const a = await createAccount({ email: `p${n}@mail.com`, password: 'clavefuerte9', username: `Player${n}` });
    return a.id;
  }
  async function activeSeason() {
    const now = Date.now();
    return createSeason({ name: 'T1', startsAt: new Date(now - day), endsAt: new Date(now + day) });
  }

  it('1v1: persiste partida, actualiza ELO (ganador sube, perdedor baja) e historial', async () => {
    await activeSeason();
    const a = await makeUser(1);
    const b = await makeUser(2);

    const out = await recordCompetitiveResult({
      mode: '1v1',
      winnerTeam: 0,
      players: [
        { userId: a, team: 0 },
        { userId: b, team: 1 },
      ],
    });
    expect(out.recorded).toBe(true);
    expect(out.matchId).toBeTruthy();

    // Verificamos por historial (independiente de la temporada exacta).
    const histA = await getUserHistory(a);
    const histB = await getUserHistory(b);
    expect(histA[0]!.won).toBe(true);
    expect(histA[0]!.ratingDelta!).toBeGreaterThan(0);
    expect(histB[0]!.won).toBe(false);
    expect(histB[0]!.ratingDelta!).toBeLessThan(0);
    // Suma cero en 1v1 simétrico desde 1000.
    expect(histA[0]!.ratingDelta! + histB[0]!.ratingDelta!).toBe(0);
  });

  it('no puntúa si no hay al menos 2 jugadores humanos (bots)', async () => {
    await activeSeason();
    const a = await makeUser(1);
    const out = await recordCompetitiveResult({
      mode: '1v1',
      winnerTeam: 0,
      players: [
        { userId: a, team: 0 },
        { userId: 'bot:1', team: 1 },
      ],
    });
    expect(out.recorded).toBe(false);
    expect(out.reason).toBe('no_ranked_players');
  });

  it('abandono en equipo: el que abandona pierde más; el compañero pierde poco', async () => {
    await activeSeason();
    const [a, b, c, e] = [await makeUser(1), await makeUser(2), await makeUser(3), await makeUser(4)];
    // Gana el equipo 0 (a,c). Pierde el equipo 1 (b,e); b ABANDONA.
    const out = await recordCompetitiveResult({
      mode: '2v2',
      winnerTeam: 0,
      players: [
        { userId: a, team: 0 },
        { userId: b, team: 1, abandoned: true },
        { userId: c, team: 0 },
        { userId: e, team: 1 },
      ],
    });
    const deltas = new Map(out.results!.map((r) => [r.userId, r.delta]));
    // El abandonador pierde MÁS que su compañero.
    expect(deltas.get(b)!).toBeLessThan(deltas.get(e)!);
    // El compañero pierde poco (pérdida fija chica).
    expect(deltas.get(e)).toBe(-5);
    // Los ganadores suman.
    expect(deltas.get(a)!).toBeGreaterThan(0);
  });

  it('2v2: reparte el mismo delta a cada integrante del equipo', async () => {
    await activeSeason();
    const [a, b, c, e] = [await makeUser(1), await makeUser(2), await makeUser(3), await makeUser(4)];
    const out = await recordCompetitiveResult({
      mode: '2v2',
      winnerTeam: 0,
      players: [
        { userId: a, team: 0 },
        { userId: b, team: 1 },
        { userId: c, team: 0 },
        { userId: e, team: 1 },
      ],
    });
    expect(out.recorded).toBe(true);
    const deltas = new Map(out.results!.map((r) => [r.userId, r.delta]));
    expect(deltas.get(a)).toBe(deltas.get(c)); // mismo equipo, mismo delta
    expect(deltas.get(b)).toBe(deltas.get(e));
    expect(deltas.get(a)!).toBeGreaterThan(0);
    expect(deltas.get(b)!).toBeLessThan(0);
  });
});
