/* =============================================================
 * Backend · Migraciones PostgreSQL (runner mínimo, sin deps extra)
 * -------------------------------------------------------------
 * Aplica los archivos `migrations/NNN_*.sql` en orden, una sola vez
 * cada uno, registrando lo aplicado en la tabla `schema_migrations`.
 * Cada migración corre dentro de una TRANSACCIÓN: si falla, se revierte.
 * Uso:  npm run db:migrate
 * ============================================================= */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './pool.js';
import { safeDbSummary, loadEnv } from '../config/env.js';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/db (o dist/db)
// Las migraciones viven en backend/migrations, junto al package.
const migrationsDir = resolve(here, '..', '..', 'migrations');

/** Lista ordenada de archivos de migración (NNN_*.sql). */
function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort();
}

async function ensureMigrationsTable(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedSet(): Promise<Set<string>> {
  const res = await getPool().query<{ name: string }>(
    'SELECT name FROM schema_migrations',
  );
  return new Set(res.rows.map((r) => r.name));
}

export async function runMigrations(): Promise<void> {
  loadEnv();
  const pool = getPool();
  await ensureMigrationsTable();
  const already = await appliedSet();
  const files = migrationFiles();

  let applied = 0;
  for (const file of files) {
    if (already.has(file)) {
      console.log(`[migrate] = ya aplicada: ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied++;
      console.log(`[migrate] ✅ aplicada: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(
        `Falló la migración ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      client.release();
    }
  }
  console.log(
    `[migrate] listo (${applied} nueva(s), ${files.length} total) sobre ${safeDbSummary(
      loadEnv().databaseUrl,
    )}`,
  );
}

// Ejecutable directo: `npm run db:migrate`.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[migrate] ❌', err instanceof Error ? err.message : err);
      await closePool().catch(() => {});
      process.exit(1);
    });
}
