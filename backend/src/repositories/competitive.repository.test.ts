/* =============================================================
 * Integración · Persistencia competitiva (seasons + ratings + subscriptions).
 * Corre contra PostgreSQL real (DATABASE_URL); si no hay, se saltea.
 * ============================================================= */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { hasDatabase, prepareSchema, truncateAll } from './testDb.js';
import { closePool } from '../db/pool.js';
import { createAccount } from '../services/account.service.js';
import { createSeason, getActiveSeason } from './seasons.repository.js';
import { ensureRating, applyMatchResult, leaderboard, getRating } from './ratings.repository.js';
import { upsertSubscription, getSubscription } from './subscriptions.repository.js';
import { resolveMatchRatings } from '../competitive/elo.js';
import { getCompetitiveStatus, getRanking } from '../services/competitive.service.js';

const d = hasDatabase ? describe : describe.skip;

const day = 24 * 3600_000;

d('competitivo · persistencia', () => {
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
    const a = await createAccount({
      email: `u${n}@mail.com`,
      password: 'clavefuerte9',
      username: `User${n}`,
    });
    return a.id;
  }

  it('temporada activa se detecta por fechas', async () => {
    const now = new Date();
    await createSeason({ name: 'T1', startsAt: new Date(now.getTime() - day), endsAt: new Date(now.getTime() + day) });
    const active = await getActiveSeason();
    expect(active?.name).toBe('T1');
  });

  it('applyMatchResult persiste ELO, wins/losses y actualiza el ranking', async () => {
    const now = new Date();
    const season = await createSeason({
      name: 'T1', startsAt: new Date(now.getTime() - day), endsAt: new Date(now.getTime() + day),
    });
    const a = await makeUser(1);
    const b = await makeUser(2);
    await ensureRating(a, season.id);
    await ensureRating(b, season.id);

    // A (1000) gana a B (1000): el dominio calcula el delta, el repo lo persiste.
    const res = resolveMatchRatings(
      { members: [{ userId: a, rating: 1000 }] },
      { members: [{ userId: b, rating: 1000 }] },
    );
    await applyMatchResult(season.id, [
      { userId: a, newRating: res.winners[0]!.after, won: true },
      { userId: b, newRating: res.losers[0]!.after, won: false },
    ]);

    const ra = await getRating(a, season.id);
    const rb = await getRating(b, season.id);
    expect(ra!.rating).toBeGreaterThan(1000);
    expect(ra!.wins).toBe(1);
    expect(rb!.rating).toBeLessThan(1000);
    expect(rb!.losses).toBe(1);

    const board = await getRanking(50);
    expect(board.rows[0]!.username).toBe('User1'); // el ganador arriba
    expect(board.rows[0]!.position).toBe(1);
  });

  it('suscripción: upsert y acceso derivado en el estado', async () => {
    const now = new Date();
    await createSeason({ name: 'T1', startsAt: new Date(now.getTime() - day), endsAt: new Date(now.getTime() + day) });
    const a = await makeUser(1);

    // Sin suscripción ⇒ bloqueado.
    let status = await getCompetitiveStatus(a);
    expect(status.eligibility.allowed).toBe(false);

    // Activa y vigente ⇒ permitido.
    await upsertSubscription({
      userId: a,
      status: 'active',
      currentPeriodEnd: new Date(now.getTime() + 30 * day),
    });
    status = await getCompetitiveStatus(a);
    expect(status.eligibility.allowed).toBe(true);
    expect(status.subscription?.status).toBe('active');
    const sub = await getSubscription(a);
    expect(sub?.status).toBe('active');
  });

  it('leaderboard ordena por rating desc', async () => {
    const now = new Date();
    const season = await createSeason({ name: 'T1', startsAt: new Date(now.getTime() - day), endsAt: new Date(now.getTime() + day) });
    const a = await makeUser(1);
    const b = await makeUser(2);
    await ensureRating(a, season.id);
    await ensureRating(b, season.id);
    await applyMatchResult(season.id, [{ userId: b, newRating: 1500, won: true }]);
    const rows = await leaderboard(season.id);
    expect(rows[0]!.username).toBe('User2');
    expect(rows[0]!.rating).toBe(1500);
  });
});
