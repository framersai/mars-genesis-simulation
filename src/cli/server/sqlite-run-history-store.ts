/**
 * SQLite-backed implementation of {@link RunHistoryStore}. Mirrors the
 * session-store pattern: better-sqlite3, WAL mode, prepared statements,
 * `:memory:` path support for clean test isolation.
 *
 * Single `runs` table with composite per-filter indexes. Run records are
 * tiny (~200 bytes); 100K rows fits in 20 MB. No retention cap; add
 * `PARACOSM_RUN_HISTORY_MAX_ROWS` env var if traffic ever warrants it.
 *
 * @module paracosm/cli/server/sqlite-run-history-store
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RunRecord } from './run-record.js';
import type { ListRunsFilters, RunHistoryStore } from './run-history-store.js';

export interface SqliteRunHistoryStoreOptions {
  dbPath: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(raw));
}

function clampOffset(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

interface RunRow {
  run_id: string;
  created_at: string;
  scenario_id: string;
  scenario_version: string;
  leader_config_hash: string;
  economics_profile: string;
  source_mode: string;
  created_by: string;
}

function rowToRecord(row: RunRow): RunRecord {
  return {
    runId: row.run_id,
    createdAt: row.created_at,
    scenarioId: row.scenario_id,
    scenarioVersion: row.scenario_version,
    leaderConfigHash: row.leader_config_hash,
    economicsProfile: row.economics_profile,
    sourceMode: row.source_mode as RunRecord['sourceMode'],
    createdBy: row.created_by as RunRecord['createdBy'],
  };
}

export function createSqliteRunHistoryStore(options: SqliteRunHistoryStoreOptions): RunHistoryStore {
  const { dbPath } = options;
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id              TEXT PRIMARY KEY NOT NULL,
      created_at          TEXT NOT NULL,
      scenario_id         TEXT NOT NULL,
      scenario_version    TEXT NOT NULL,
      leader_config_hash  TEXT NOT NULL,
      economics_profile   TEXT NOT NULL,
      source_mode         TEXT NOT NULL,
      created_by          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runs_created_at        ON runs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_scenario_created  ON runs (scenario_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_leader_created    ON runs (leader_config_hash, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_mode_created      ON runs (source_mode, created_at DESC);
  `);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO runs
      (run_id, created_at, scenario_id, scenario_version, leader_config_hash, economics_profile, source_mode, created_by)
    VALUES
      (@runId, @createdAt, @scenarioId, @scenarioVersion, @leaderConfigHash, @economicsProfile, @sourceMode, @createdBy)
  `);

  const getStmt = db.prepare<unknown[], RunRow>(`SELECT * FROM runs WHERE run_id = ?`);

  function buildWhere(filters: ListRunsFilters | undefined): { where: string; params: Record<string, string> } {
    const clauses: string[] = [];
    const params: Record<string, string> = {};
    if (filters?.mode) {
      clauses.push('source_mode = @mode');
      params.mode = filters.mode;
    }
    if (filters?.scenarioId) {
      clauses.push('scenario_id = @scenarioId');
      params.scenarioId = filters.scenarioId;
    }
    if (filters?.leaderConfigHash) {
      clauses.push('leader_config_hash = @leaderConfigHash');
      params.leaderConfigHash = filters.leaderConfigHash;
    }
    return {
      where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  return {
    async insertRun(run: RunRecord): Promise<void> {
      insertStmt.run(run);
    },

    async listRuns(filters?: ListRunsFilters): Promise<RunRecord[]> {
      const { where, params } = buildWhere(filters);
      const limit = clampLimit(filters?.limit);
      const offset = clampOffset(filters?.offset);
      const sql = `SELECT * FROM runs ${where} ORDER BY created_at DESC LIMIT @__limit OFFSET @__offset`;
      const rows = db
        .prepare<unknown[], RunRow>(sql)
        .all({ ...params, __limit: limit, __offset: offset });
      return rows.map(rowToRecord);
    },

    async getRun(runId: string): Promise<RunRecord | null> {
      const row = getStmt.get(runId);
      return row ? rowToRecord(row) : null;
    },

    async countRuns(filters?: Pick<ListRunsFilters, 'mode' | 'scenarioId' | 'leaderConfigHash'>): Promise<number> {
      const { where, params } = buildWhere(filters);
      const sql = `SELECT COUNT(*) AS n FROM runs ${where}`;
      const row = db.prepare<unknown[], { n: number }>(sql).get(params);
      return row?.n ?? 0;
    },
  };
}
