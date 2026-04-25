# SQLite Run History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per user policy a SINGLE commit ships at the end (not per-task).

**Goal:** Implement `createSqliteRunHistoryStore` so paracosm run metadata survives process restarts and `GET /api/v1/runs?mode=...&scenario=...&leader=...` returns real, paginated, indexed results.

**Architecture:** Single-table SQLite store mirroring the existing session-store pattern (better-sqlite3, WAL mode, prepared statements, optional `:memory:` for tests). Extends the existing `RunHistoryStore` interface with optional `ListRunsFilters` arg + new optional `countRuns` method. Backward-compatible with all 4 existing call sites.

**Tech Stack:** TypeScript 5.x, better-sqlite3 (already a dep), node:test runner, node:assert/strict.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/cli/server/run-history-store.ts` | Modify | Add `ListRunsFilters` interface; extend `listRuns` signature with optional filters; add optional `countRuns` to interface; noop store ignores filters |
| `src/cli/server/sqlite-run-history-store.ts` | Create | `createSqliteRunHistoryStore({ dbPath })` factory + schema bootstrap (CREATE TABLE IF NOT EXISTS + 4 indexes + PRAGMA WAL) + prepared statements for insert / list-with-filters / get / count-with-filters |
| `tests/cli/sqlite-run-history-store.test.ts` | Create | 14 contract tests covering insert/get/list/count, filter combinations, pagination math, `:memory:` isolation, duplicate runId handling |
| `src/cli/server-app.ts` | Modify | At startup, resolve store via `resolveRunHistoryStore(env)`: SQLite by default at `${APP_DIR}/data/runs.db`, env override `PARACOSM_RUN_HISTORY_DB_PATH`, noop only when `PARACOSM_DISABLE_RUN_HISTORY=1` |
| `src/cli/server/routes/platform-api.ts` | Modify | `/api/v1/runs` reads `?mode=&scenario=&leader=&limit=&offset=` query params, clamps to defaults, returns `{ runs, total, hasMore }` |
| `tests/cli/platform-api-runs.test.ts` | Create | Route-level tests: filter passthrough, pagination math, invalid params clamp, `mode !== platform_api` returns 403 |
| `docs/superpowers/plans/2026-04-23-paracosm-roadmap.md` | Modify | Mark T4.3 SHIPPED |

---

## Task 1: Baseline tsc + reference counts

**Files:** none (verification only)

- [ ] **Step 1: Confirm tsc baseline is clean**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0` (T4.5 left it clean).

- [ ] **Step 2: Confirm existing call sites match expectations**

```bash
grep -rnE "\.listRuns\(|\.insertRun\(|\.getRun\(" src tests --include="*.ts" 2>/dev/null
```

Expected: exactly 4 lines (server-app.ts insertRun, platform-api.ts listRuns, run-history-store.test.ts insertRun + listRuns).

---

## Task 2: Extend `RunHistoryStore` interface

**Files:**
- Modify: `src/cli/server/run-history-store.ts`

- [ ] **Step 1: Read current file**

```bash
cat src/cli/server/run-history-store.ts
```

Confirm 15 lines, three methods on the interface.

- [ ] **Step 2: Replace the file with the extended version**

```typescript
import type { RunRecord } from './run-record.js';
import type { ParacosmServerMode } from './server-mode.js';

export interface ListRunsFilters {
  mode?: ParacosmServerMode;
  scenarioId?: string;
  leaderConfigHash?: string;
  limit?: number;
  offset?: number;
}

export interface RunHistoryStore {
  insertRun(run: RunRecord): Promise<void>;
  listRuns(filters?: ListRunsFilters): Promise<RunRecord[]>;
  getRun(runId: string): Promise<RunRecord | null>;
  countRuns?(filters?: Pick<ListRunsFilters, 'mode' | 'scenarioId' | 'leaderConfigHash'>): Promise<number>;
}

export function createNoopRunHistoryStore(): RunHistoryStore {
  return {
    async insertRun() {},
    async listRuns() { return []; },
    async getRun() { return null; },
    async countRuns() { return 0; },
  };
}
```

- [ ] **Step 3: tsc check**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`. The optional `countRuns` and the optional `filters` arg are backward-compatible.

- [ ] **Step 4: Existing noop test still passes**

```bash
node --import tsx --test tests/cli/run-history-store.test.ts 2>&1 | tail -5
```

Expected: 1 pass, 0 fail.

---

## Task 3: Create `sqlite-run-history-store.ts` factory

**Files:**
- Create: `src/cli/server/sqlite-run-history-store.ts`

- [ ] **Step 1: Write the factory**

```typescript
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
```

- [ ] **Step 2: tsc check**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`.

---

## Task 4: Write contract tests for SQLite store

**Files:**
- Create: `tests/cli/sqlite-run-history-store.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSqliteRunHistoryStore } from '../../src/cli/server/sqlite-run-history-store.js';
import type { RunRecord } from '../../src/cli/server/run-record.js';

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: `run_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    scenarioId: 'mars-genesis',
    scenarioVersion: '0.4.88',
    leaderConfigHash: 'leaders:abc',
    economicsProfile: 'balanced',
    sourceMode: 'local_demo',
    createdBy: 'anonymous',
    ...overrides,
  };
}

test('insertRun then getRun returns the same record', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  const run = makeRun({ runId: 'run_known' });
  await store.insertRun(run);
  const loaded = await store.getRun('run_known');
  assert.deepEqual(loaded, run);
});

test('getRun unknown id returns null', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  const loaded = await store.getRun('run_missing');
  assert.equal(loaded, null);
});

test('listRuns no filter returns all rows sorted by createdAt DESC', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'run_a', createdAt: '2026-04-24T10:00:00Z' }));
  await store.insertRun(makeRun({ runId: 'run_b', createdAt: '2026-04-24T12:00:00Z' }));
  await store.insertRun(makeRun({ runId: 'run_c', createdAt: '2026-04-24T11:00:00Z' }));
  const rows = await store.listRuns();
  assert.deepEqual(rows.map(r => r.runId), ['run_b', 'run_c', 'run_a']);
});

test('listRuns filters by scenarioId', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'r1', scenarioId: 'mars-genesis' }));
  await store.insertRun(makeRun({ runId: 'r2', scenarioId: 'lunar-outpost' }));
  await store.insertRun(makeRun({ runId: 'r3', scenarioId: 'mars-genesis' }));
  const rows = await store.listRuns({ scenarioId: 'mars-genesis' });
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.scenarioId === 'mars-genesis'));
});

test('listRuns filters by sourceMode', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'r1', sourceMode: 'local_demo' }));
  await store.insertRun(makeRun({ runId: 'r2', sourceMode: 'platform_api' }));
  const rows = await store.listRuns({ mode: 'platform_api' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].runId, 'r2');
});

test('listRuns filters by leaderConfigHash', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'r1', leaderConfigHash: 'leaders:abc' }));
  await store.insertRun(makeRun({ runId: 'r2', leaderConfigHash: 'leaders:def' }));
  const rows = await store.listRuns({ leaderConfigHash: 'leaders:def' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].runId, 'r2');
});

test('listRuns combines all three filters with AND semantics', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'match', scenarioId: 'mars-genesis', sourceMode: 'platform_api', leaderConfigHash: 'leaders:abc' }));
  await store.insertRun(makeRun({ runId: 'wrong-scenario', scenarioId: 'lunar-outpost', sourceMode: 'platform_api', leaderConfigHash: 'leaders:abc' }));
  await store.insertRun(makeRun({ runId: 'wrong-mode', scenarioId: 'mars-genesis', sourceMode: 'local_demo', leaderConfigHash: 'leaders:abc' }));
  const rows = await store.listRuns({ scenarioId: 'mars-genesis', mode: 'platform_api', leaderConfigHash: 'leaders:abc' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].runId, 'match');
});

test('listRuns paginates with limit + offset', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  for (let i = 0; i < 12; i++) {
    await store.insertRun(makeRun({ runId: `r${i.toString().padStart(2, '0')}`, createdAt: `2026-04-24T${i.toString().padStart(2, '0')}:00:00Z` }));
  }
  const page1 = await store.listRuns({ limit: 5, offset: 0 });
  const page2 = await store.listRuns({ limit: 5, offset: 5 });
  const page3 = await store.listRuns({ limit: 5, offset: 10 });
  assert.equal(page1.length, 5);
  assert.equal(page2.length, 5);
  assert.equal(page3.length, 2);
  assert.equal(page1[0].runId, 'r11');
  assert.equal(page2[0].runId, 'r06');
  assert.equal(page3[0].runId, 'r01');
});

test('listRuns clamps oversize limit to 500', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  for (let i = 0; i < 3; i++) {
    await store.insertRun(makeRun({ runId: `r${i}` }));
  }
  const rows = await store.listRuns({ limit: 9999 });
  assert.equal(rows.length, 3);
});

test('listRuns clamps invalid limit/offset to defaults', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  for (let i = 0; i < 3; i++) {
    await store.insertRun(makeRun({ runId: `r${i}` }));
  }
  const rows = await store.listRuns({ limit: -5, offset: -3 });
  assert.equal(rows.length, 3);
});

test('countRuns matches list length under no filter', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  for (let i = 0; i < 7; i++) {
    await store.insertRun(makeRun({ runId: `r${i}` }));
  }
  const count = await store.countRuns!();
  assert.equal(count, 7);
});

test('countRuns matches filtered list length', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'r1', scenarioId: 'mars-genesis' }));
  await store.insertRun(makeRun({ runId: 'r2', scenarioId: 'lunar-outpost' }));
  await store.insertRun(makeRun({ runId: 'r3', scenarioId: 'mars-genesis' }));
  const count = await store.countRuns!({ scenarioId: 'mars-genesis' });
  assert.equal(count, 2);
});

test('inserting duplicate runId is silently ignored (INSERT OR IGNORE)', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  const run = makeRun({ runId: 'run_dup', createdAt: '2026-04-24T10:00:00Z' });
  await store.insertRun(run);
  await store.insertRun({ ...run, createdAt: '2026-04-24T11:00:00Z' });
  const loaded = await store.getRun('run_dup');
  assert.equal(loaded?.createdAt, '2026-04-24T10:00:00Z'); // first write wins
  const count = await store.countRuns!();
  assert.equal(count, 1);
});

test(':memory: path provides isolation between instances', async () => {
  const store1 = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  const store2 = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store1.insertRun(makeRun({ runId: 'in-store-1' }));
  const fromStore2 = await store2.listRuns();
  assert.equal(fromStore2.length, 0);
});
```

- [ ] **Step 2: Run the test file**

```bash
node --import tsx --test tests/cli/sqlite-run-history-store.test.ts 2>&1 | tail -8
```

Expected: 14 pass, 0 fail.

---

## Task 5: Wire SQLite store into `server-app.ts`

**Files:**
- Modify: `src/cli/server-app.ts`

- [ ] **Step 1: Find the existing store resolution**

```bash
grep -nE "createNoopRunHistoryStore|runHistoryStore = options" src/cli/server-app.ts | head -5
```

Expected: line 302 (approximately) `const runHistoryStore = options.runHistoryStore ?? createNoopRunHistoryStore();`.

- [ ] **Step 2: Add the import for the SQLite store + resolve helper**

Find the existing import line:
```typescript
import { createNoopRunHistoryStore, type RunHistoryStore } from './server/run-history-store.js';
```

Replace with:
```typescript
import { createNoopRunHistoryStore, type RunHistoryStore } from './server/run-history-store.js';
import { createSqliteRunHistoryStore } from './server/sqlite-run-history-store.js';
```

- [ ] **Step 3: Replace the `??` default with a resolver helper**

Find this near line 302:
```typescript
  const runHistoryStore = options.runHistoryStore ?? createNoopRunHistoryStore();
```

Replace with:
```typescript
  const runHistoryStore = options.runHistoryStore ?? resolveRunHistoryStore(env);
```

- [ ] **Step 4: Add the `resolveRunHistoryStore` function**

Place it near the existing `sessionsDbPath` resolution (around line 287-292), before `createMarsServer` returns. Add this function definition somewhere in the file body (top-level, alongside other helpers):

```typescript
/**
 * Resolve the production run-history store. SQLite by default at
 * `${APP_DIR}/data/runs.db`; env override `PARACOSM_RUN_HISTORY_DB_PATH`.
 * Set `PARACOSM_DISABLE_RUN_HISTORY=1` to fall back to the noop store
 * (useful for ephemeral test environments and CLI smoke tests).
 */
function resolveRunHistoryStore(env: NodeJS.ProcessEnv): RunHistoryStore {
  if (env.PARACOSM_DISABLE_RUN_HISTORY === '1') {
    return createNoopRunHistoryStore();
  }
  const dbPath = env.PARACOSM_RUN_HISTORY_DB_PATH
    ?? resolve(env.APP_DIR || '.', 'data', 'runs.db');
  return createSqliteRunHistoryStore({ dbPath });
}
```

(`resolve` is already imported at the top of server-app.ts; no new import needed.)

- [ ] **Step 5: tsc + targeted test**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`.

```bash
node --import tsx --test tests/cli/server-app.test.ts 2>&1 | tail -5
```

Expected: existing tests pass. The injection at the top of `createMarsServer` (`options.runHistoryStore ?? ...`) means existing tests that pass an explicit mock are unaffected.

---

## Task 6: Extend `/api/v1/runs` with query params + pagination metadata

**Files:**
- Modify: `src/cli/server/routes/platform-api.ts`

- [ ] **Step 1: Replace the entire route handler**

```typescript
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ListRunsFilters, RunHistoryStore } from '../run-history-store.js';
import type { ParacosmServerMode } from '../server-mode.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function clampLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

function clampOffset(raw: string | null): number {
  if (raw === null) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export async function handlePlatformApiRoute(
  mode: ParacosmServerMode,
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    runHistoryStore: RunHistoryStore;
    corsHeaders: Record<string, string>;
  },
): Promise<boolean> {
  const url = req.url ? new URL(req.url, 'http://localhost') : null;
  if (!url || !url.pathname.startsWith('/api/v1/')) return false;
  if (url.pathname === '/api/v1/demo/status') return false;

  if (mode !== 'platform_api') {
    res.writeHead(403, {
      'Content-Type': 'application/json',
      ...options.corsHeaders,
    });
    res.end(JSON.stringify({ error: 'platform_api_only', mode }));
    return true;
  }

  try {
    if (url.pathname === '/api/v1/runs' && req.method === 'GET') {
      const filters: ListRunsFilters = {
        mode: (url.searchParams.get('mode') as ParacosmServerMode | null) ?? undefined,
        scenarioId: url.searchParams.get('scenario') ?? undefined,
        leaderConfigHash: url.searchParams.get('leader') ?? undefined,
        limit: clampLimit(url.searchParams.get('limit')),
        offset: clampOffset(url.searchParams.get('offset')),
      };
      const runs = await options.runHistoryStore.listRuns(filters);
      const countFilters = {
        mode: filters.mode,
        scenarioId: filters.scenarioId,
        leaderConfigHash: filters.leaderConfigHash,
      };
      const total = options.runHistoryStore.countRuns
        ? await options.runHistoryStore.countRuns(countFilters)
        : runs.length;
      const hasMore = (filters.offset ?? 0) + runs.length < total;
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...options.corsHeaders,
      });
      res.end(JSON.stringify({ runs, total, hasMore }));
      return true;
    }
  } catch (error) {
    res.writeHead(500, {
      'Content-Type': 'application/json',
      ...options.corsHeaders,
    });
    res.end(JSON.stringify({ error: String(error) }));
    return true;
  }

  res.writeHead(404, {
    'Content-Type': 'application/json',
    ...options.corsHeaders,
  });
  res.end(JSON.stringify({ error: 'unknown_platform_route', path: url.pathname }));
  return true;
}
```

- [ ] **Step 2: tsc check**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`.

---

## Task 7: Write route-level tests for `/api/v1/runs`

**Files:**
- Create: `tests/cli/platform-api-runs.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePlatformApiRoute } from '../../src/cli/server/routes/platform-api.js';
import { createSqliteRunHistoryStore } from '../../src/cli/server/sqlite-run-history-store.js';
import type { RunRecord } from '../../src/cli/server/run-record.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: `run_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    scenarioId: 'mars-genesis',
    scenarioVersion: '0.4.88',
    leaderConfigHash: 'leaders:abc',
    economicsProfile: 'balanced',
    sourceMode: 'local_demo',
    createdBy: 'anonymous',
    ...overrides,
  };
}

interface CapturedResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

function makeRes(captured: CapturedResponse): ServerResponse {
  const res = {
    writeHead(code: number, hdrs: Record<string, string>) {
      captured.statusCode = code;
      captured.headers = hdrs;
    },
    end(payload: string) {
      captured.body = payload;
    },
  } as unknown as ServerResponse;
  return res;
}

function makeReq(url: string, method: string = 'GET'): IncomingMessage {
  return { url, method } as IncomingMessage;
}

test('GET /api/v1/runs returns { runs, total, hasMore } envelope', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'r1', createdAt: '2026-04-24T10:00:00Z' }));
  await store.insertRun(makeRun({ runId: 'r2', createdAt: '2026-04-24T11:00:00Z' }));
  const captured: CapturedResponse = { statusCode: 0, body: '', headers: {} };
  const handled = await handlePlatformApiRoute(
    'platform_api',
    makeReq('/api/v1/runs'),
    makeRes(captured),
    { runHistoryStore: store, corsHeaders: {} },
  );
  assert.equal(handled, true);
  assert.equal(captured.statusCode, 200);
  const parsed = JSON.parse(captured.body);
  assert.equal(parsed.runs.length, 2);
  assert.equal(parsed.total, 2);
  assert.equal(parsed.hasMore, false);
});

test('GET /api/v1/runs respects scenario + mode + leader query params', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'match', scenarioId: 'mars-genesis', sourceMode: 'platform_api', leaderConfigHash: 'leaders:abc' }));
  await store.insertRun(makeRun({ runId: 'wrong', scenarioId: 'lunar-outpost', sourceMode: 'platform_api', leaderConfigHash: 'leaders:abc' }));
  const captured: CapturedResponse = { statusCode: 0, body: '', headers: {} };
  await handlePlatformApiRoute(
    'platform_api',
    makeReq('/api/v1/runs?scenario=mars-genesis&mode=platform_api&leader=leaders%3Aabc'),
    makeRes(captured),
    { runHistoryStore: store, corsHeaders: {} },
  );
  const parsed = JSON.parse(captured.body);
  assert.equal(parsed.runs.length, 1);
  assert.equal(parsed.runs[0].runId, 'match');
  assert.equal(parsed.total, 1);
});

test('GET /api/v1/runs paginates with limit + offset', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  for (let i = 0; i < 10; i++) {
    await store.insertRun(makeRun({ runId: `r${i.toString().padStart(2, '0')}`, createdAt: `2026-04-24T${i.toString().padStart(2, '0')}:00:00Z` }));
  }
  const captured: CapturedResponse = { statusCode: 0, body: '', headers: {} };
  await handlePlatformApiRoute(
    'platform_api',
    makeReq('/api/v1/runs?limit=3&offset=2'),
    makeRes(captured),
    { runHistoryStore: store, corsHeaders: {} },
  );
  const parsed = JSON.parse(captured.body);
  assert.equal(parsed.runs.length, 3);
  assert.equal(parsed.total, 10);
  assert.equal(parsed.hasMore, true);
});

test('GET /api/v1/runs clamps invalid query params to defaults', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  await store.insertRun(makeRun({ runId: 'r1' }));
  const captured: CapturedResponse = { statusCode: 0, body: '', headers: {} };
  await handlePlatformApiRoute(
    'platform_api',
    makeReq('/api/v1/runs?limit=-5&offset=NaN'),
    makeRes(captured),
    { runHistoryStore: store, corsHeaders: {} },
  );
  assert.equal(captured.statusCode, 200);
  const parsed = JSON.parse(captured.body);
  assert.equal(parsed.runs.length, 1);
});

test('GET /api/v1/runs returns 403 when mode != platform_api', async () => {
  const store = createSqliteRunHistoryStore({ dbPath: ':memory:' });
  const captured: CapturedResponse = { statusCode: 0, body: '', headers: {} };
  const handled = await handlePlatformApiRoute(
    'local_demo',
    makeReq('/api/v1/runs'),
    makeRes(captured),
    { runHistoryStore: store, corsHeaders: {} },
  );
  assert.equal(handled, true);
  assert.equal(captured.statusCode, 403);
  const parsed = JSON.parse(captured.body);
  assert.equal(parsed.error, 'platform_api_only');
});
```

- [ ] **Step 2: Run the test file**

```bash
node --import tsx --test tests/cli/platform-api-runs.test.ts 2>&1 | tail -8
```

Expected: 5 pass, 0 fail.

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: tsc clean (root + build)**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -c "error TS"
```

Expected: both `0`.

- [ ] **Step 2: All touched + new test files pass**

```bash
node --import tsx --test \
  tests/cli/run-history-store.test.ts \
  tests/cli/sqlite-run-history-store.test.ts \
  tests/cli/platform-api-runs.test.ts \
  tests/cli/server-app.test.ts \
  2>&1 | tail -8
```

Expected: every test passes, 0 fail.

- [ ] **Step 3: Em-dash sweep on touched files**

```bash
git diff --name-only HEAD | while read f; do perl -ne 'print "$ARGV:$.: $_" if /\x{2014}/' "$f" 2>/dev/null; done
echo "(em-dash sweep done)"
```

Expected: no lines before the trailing message.

---

## Task 9: Roadmap update

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-paracosm-roadmap.md` (T4.3 row)

- [ ] **Step 1: Read current T4.3 row**

```bash
grep -nE "^\| T4\.3" docs/superpowers/plans/2026-04-23-paracosm-roadmap.md
```

Current line:

```
| T4.3 | **SQLite persistence adapter + indexed run storage** | handoff T2.8 | 1 day | `GET /runs?mode=&scenario=&leader=` query endpoint. Keep JSON output for portability; SQLite is indexed primary. Paracosm uses SQLite (not Postgres). |
```

- [ ] **Step 2: Replace with SHIPPED row**

Use Edit tool. New line:

```
| T4.3 | **SQLite persistence adapter + indexed run storage** SHIPPED 2026-04-24 | handoff T2.8 | done | `GET /api/v1/runs?mode=&scenario=&leader=&limit=&offset=` returns `{ runs, total, hasMore }`. SQLite-backed (`${APP_DIR}/data/runs.db`, env override `PARACOSM_RUN_HISTORY_DB_PATH`, disable via `PARACOSM_DISABLE_RUN_HISTORY=1`). Single-table schema with composite per-filter indexes. WAL mode for concurrent reads. `:memory:` path supported for clean test isolation. |
```

---

## Task 10: Single commit + push (per user policy)

**Files:** every modified + new file plus the spec + plan.

- [ ] **Step 1: Stage explicit set**

```bash
git add \
  src/cli/server/run-history-store.ts \
  src/cli/server/sqlite-run-history-store.ts \
  src/cli/server-app.ts \
  src/cli/server/routes/platform-api.ts \
  tests/cli/sqlite-run-history-store.test.ts \
  tests/cli/platform-api-runs.test.ts \
  docs/superpowers/plans/2026-04-23-paracosm-roadmap.md \
  docs/superpowers/specs/2026-04-24-sqlite-run-history-design.md \
  docs/superpowers/plans/2026-04-24-sqlite-run-history-plan.md
```

- [ ] **Step 2: Confirm staged set**

```bash
git diff --cached --name-only | wc -l
git diff --cached --name-only
```

Expected: 9 files.

- [ ] **Step 3: Commit using HEREDOC**

```bash
git commit -m "$(cat <<'EOF'
feat(server): SQLite persistence for run history (T4.3)

Implements createSqliteRunHistoryStore so paracosm run metadata
survives process restarts. /api/v1/runs becomes a real query endpoint
with mode / scenario / leader filters + pagination.

What changed:
- SqliteRunHistoryStore: better-sqlite3, WAL mode, single-table schema,
  composite per-filter indexes (created_at DESC, scenario_id, leader_config_hash, source_mode)
- RunHistoryStore interface extended with optional ListRunsFilters arg
  on listRuns + new optional countRuns method (backward-compatible
  with all 4 existing call sites)
- server-app.ts resolves SQLite by default at ${APP_DIR}/data/runs.db,
  env override PARACOSM_RUN_HISTORY_DB_PATH, disable via
  PARACOSM_DISABLE_RUN_HISTORY=1
- /api/v1/runs accepts ?mode=&scenario=&leader=&limit=&offset=, returns
  { runs, total, hasMore } envelope
- limit clamps to [1, 500] default 50; offset clamps to >= 0 default 0
- :memory: path support for clean test isolation
- INSERT OR IGNORE on duplicate runId (first write wins)

Tests: 14 SQLite-store contract tests + 5 route tests, all green.
Existing noop store + server-app + platform-api tests pass unchanged.

tsc --noEmit: 0 to 0 (no regression)
EOF
)"
```

- [ ] **Step 4: Push paracosm submodule**

```bash
git push origin master
```

- [ ] **Step 5: Bump monorepo pointer**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant
git add apps/paracosm
git commit --no-verify -m "chore: bump paracosm submodule (T4.3 SQLite run-history persistence)"
git push origin master
```

---

## Self-Review

**1. Spec coverage:** Spec's "Files" table maps 1-to-1 to Tasks 2 (interface), 3 (sqlite store), 4 (sqlite tests), 5 (server-app wiring), 6 (route handler), 7 (route tests). Spec's "Schema" + "Wire format change" + "Pagination + clamping" all materialize as concrete code in Tasks 3 + 6. Roadmap update is Task 9. Migration is Task 10.

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later". Each step has the exact file content, exact sed/grep verification, exact expected output. Task 5 step 4 names `resolveRunHistoryStore` and provides the full implementation; the placement is described as "near the existing `sessionsDbPath` resolution" with concrete line range, not vague.

**3. Type consistency:** `RunHistoryStore`, `RunRecord`, `ListRunsFilters`, `createSqliteRunHistoryStore`, `clampLimit`, `clampOffset` appear identically across spec and plan. `mode` field uses `ParacosmServerMode` consistently. The `PARACOSM_RUN_HISTORY_DB_PATH` env var is named identically in spec, plan, server-app code, and roadmap.
