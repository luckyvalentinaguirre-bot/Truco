/* =============================================================
 * Backend · Utilidades de test para la base de datos
 * -------------------------------------------------------------
 * Los tests de repositorios corren contra una base PostgreSQL REAL
 * (la de DATABASE_URL). Si no hay DATABASE_URL, se saltan.
 * ============================================================= */
import { runMigrations } from '../db/migrate.js';
import { query } from '../db/pool.js';

/** ¿Hay una base configurada para correr los tests de integración? */
export const hasDatabase = Boolean(process.env.DATABASE_URL);

/** Aplica las migraciones (idempotente) antes de la suite. */
export async function prepareSchema(): Promise<void> {
  await runMigrations();
}

/** Deja las tablas vacías entre tests. `users` cascada a profiles/sessions/
 * subscriptions/ratings/match_players/friendships; `seasons` a ratings/matches. */
export async function truncateAll(): Promise<void> {
  await query('TRUNCATE users, seasons RESTART IDENTITY CASCADE');
}
