import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'atlas.db');
const SCHEMA_PATH = path.join(process.cwd(), 'db', 'schema.sql');

const globalForDb = globalThis as unknown as { __atlasDb?: DatabaseSync };

function open(): DatabaseSync {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const isNew = !existsSync(DB_PATH);
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');

  if (isNew && existsSync(SCHEMA_PATH)) {
    db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  }
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__atlasDb) globalForDb.__atlasDb = open();
  return globalForDb.__atlasDb;
}

export type SqlParam = string | number | bigint | boolean | null | undefined;

function normalise(params: SqlParam[]): (string | number | bigint | null)[] {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

function toPlain<T>(row: unknown): T {
  return { ...(row as Record<string, unknown>) } as T;
}

export function query<T>(sql: string, ...params: SqlParam[]): T[] {
  const rows = getDb().prepare(sql).all(...normalise(params));
  return rows.map((r) => toPlain<T>(r));
}

export function get<T>(sql: string, ...params: SqlParam[]): T | undefined {
  const row = getDb().prepare(sql).get(...normalise(params));
  return row === undefined || row === null ? undefined : toPlain<T>(row);
}

export function run(
  sql: string,
  ...params: SqlParam[]
): { changes: number; lastInsertRowid: number } {
  const r = getDb().prepare(sql).run(...normalise(params));
  return {
    changes: Number(r.changes),
    lastInsertRowid: Number(r.lastInsertRowid),
  };
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
