/**
 * SQL-backed waitlist store. Mirrors `sqlite-run-history-store.ts`:
 * uses `@framers/sql-storage-adapter` so the same code works on
 * better-sqlite3 (default), sql.js (fallback), and Postgres (set
 * STORAGE_ADAPTER=postgres + DATABASE_URL). Email lookups are
 * case-insensitive (we lowercase on write).
 *
 * @module paracosm/cli/server/waitlist-store
 */
import { createDatabase, type StorageAdapter, type DatabaseOptions } from '@framers/sql-storage-adapter';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface WaitlistEntry {
  id: number;
  email: string;
  name: string | null;
  useCase: string | null;
  source: string | null;
  ip: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface InsertWaitlistInput {
  email: string;
  name?: string | null;
  useCase?: string | null;
  source?: string | null;
  ip?: string | null;
}

export interface InsertWaitlistResult {
  id: number;
  position: number;
  alreadyExisted: boolean;
}

export interface WaitlistStore {
  insertOrGetExisting(input: InsertWaitlistInput): Promise<InsertWaitlistResult>;
  count(): Promise<number>;
  findByEmail(email: string): Promise<WaitlistEntry | null>;
}

export interface CreateWaitlistStoreOptions {
  /** SQLite file path. Ignored when STORAGE_ADAPTER selects Postgres. */
  dbPath?: string;
  /** Direct override for `createDatabase`. Tests pass `{ file: ':memory:' }`. */
  databaseOptions?: DatabaseOptions;
}

interface WaitlistRow {
  id: number;
  email: string;
  name: string | null;
  use_case: string | null;
  source: string | null;
  ip: string | null;
  created_at: string;
  confirmed_at: string | null;
}

async function bootstrap(adapter: StorageAdapter): Promise<void> {
  await adapter.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      use_case TEXT,
      source TEXT,
      ip TEXT,
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    );
  `);
  await adapter.exec(`CREATE INDEX IF NOT EXISTS waitlist_created_idx ON waitlist(created_at);`);
}

function rowToEntry(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    useCase: row.use_case,
    source: row.source,
    ip: row.ip,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}

export function createWaitlistStore(options: CreateWaitlistStoreOptions): WaitlistStore {
  const { dbPath, databaseOptions } = options;
  if (dbPath && dbPath !== ':memory:' && !databaseOptions?.type) {
    try { mkdirSync(dirname(dbPath), { recursive: true }); } catch { /* exists */ }
  }

  let adapterPromise: Promise<StorageAdapter> | null = null;
  function getAdapter(): Promise<StorageAdapter> {
    if (!adapterPromise) {
      adapterPromise = (async () => {
        const adapter = await createDatabase(
          databaseOptions ?? { file: dbPath ?? ':memory:' },
        );
        await bootstrap(adapter);
        return adapter;
      })();
    }
    return adapterPromise;
  }

  return {
    async insertOrGetExisting(input) {
      const adapter = await getAdapter();
      const normalized = input.email.trim().toLowerCase();
      const existing = await adapter.get<WaitlistRow>(
        `SELECT * FROM waitlist WHERE email = ? LIMIT 1`,
        [normalized],
      );
      if (existing) {
        const positionRow = await adapter.get<{ n: number }>(
          `SELECT COUNT(*) AS n FROM waitlist WHERE id <= ?`,
          [existing.id],
        );
        return {
          id: existing.id,
          position: positionRow?.n ?? 0,
          alreadyExisted: true,
        };
      }
      const createdAt = new Date().toISOString();
      await adapter.run(
        `INSERT INTO waitlist (email, name, use_case, source, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          normalized,
          input.name ?? null,
          input.useCase ?? null,
          input.source ?? null,
          input.ip ?? null,
          createdAt,
        ],
      );
      const inserted = await adapter.get<WaitlistRow>(
        `SELECT * FROM waitlist WHERE email = ? LIMIT 1`,
        [normalized],
      );
      if (!inserted) throw new Error('Waitlist insert returned no row');
      const positionRow = await adapter.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM waitlist WHERE id <= ?`,
        [inserted.id],
      );
      return {
        id: inserted.id,
        position: positionRow?.n ?? 1,
        alreadyExisted: false,
      };
    },

    async count() {
      const adapter = await getAdapter();
      const row = await adapter.get<{ n: number }>(`SELECT COUNT(*) AS n FROM waitlist`);
      return row?.n ?? 0;
    },

    async findByEmail(email) {
      const adapter = await getAdapter();
      const row = await adapter.get<WaitlistRow>(
        `SELECT * FROM waitlist WHERE email = ? LIMIT 1`,
        [email.trim().toLowerCase()],
      );
      return row ? rowToEntry(row) : null;
    },
  };
}
