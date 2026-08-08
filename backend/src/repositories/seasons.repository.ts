/* =============================================================
 * Backend · Repository de temporadas (tabla `seasons`)
 * -------------------------------------------------------------
 * Queries parametrizadas. El estado (upcoming/active/finished) lo deriva el
 * dominio (competitive/season.ts) a partir de las fechas.
 * ============================================================= */
import type { QueryResultRow } from 'pg';
import { query, getPool, type Executor } from '../db/pool.js';

export interface SeasonRow {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}

interface Row extends QueryResultRow {
  id: string;
  name: string;
  starts_at: Date;
  ends_at: Date;
  created_at: Date;
}

const COLUMNS = 'id, name, starts_at, ends_at, created_at';

function map(r: Row): SeasonRow {
  return { id: r.id, name: r.name, startsAt: r.starts_at, endsAt: r.ends_at, createdAt: r.created_at };
}

export async function createSeason(
  input: { name: string; startsAt: Date; endsAt: Date },
  exec: Executor = getPool(),
): Promise<SeasonRow> {
  const res = await exec.query<Row>(
    `INSERT INTO seasons (name, starts_at, ends_at) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [input.name, input.startsAt, input.endsAt],
  );
  return map(res.rows[0]!);
}

/** Temporada vigente en `now` (starts_at <= now < ends_at). La más reciente. */
export async function getActiveSeason(now: Date = new Date()): Promise<SeasonRow | null> {
  const res = await query<Row>(
    `SELECT ${COLUMNS} FROM seasons
      WHERE starts_at <= $1 AND ends_at > $1
      ORDER BY starts_at DESC LIMIT 1`,
    [now],
  );
  return res.rows[0] ? map(res.rows[0]) : null;
}

export async function listSeasons(): Promise<SeasonRow[]> {
  const res = await query<Row>(`SELECT ${COLUMNS} FROM seasons ORDER BY starts_at DESC`);
  return res.rows.map(map);
}
