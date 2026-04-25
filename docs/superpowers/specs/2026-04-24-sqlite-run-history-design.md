---
date: 2026-04-24
status: design
related:
  - paracosm T4.3 (SQLite persistence adapter + indexed run storage)
  - paracosm T4.2 (POST /simulate one-shot HTTP endpoint, shipped earlier today)
---

# SQLite Run History Adapter

## Problem

`POST /simulate` and `POST /setup` create a `RunRecord` for every successful run, then call `runHistoryStore.insertRun(record)`. The default store is `createNoopRunHistoryStore()`. Every run record vanishes immediately. The `GET /api/v1/runs` route always returns an empty list. The roadmap's `?mode=&scenario=&leader=` query is unreachable.

T4.3 implements a SQLite-backed `RunHistoryStore` so run metadata survives process restarts, makes the `/runs` query route useful, and lets operators audit historical activity by scenario / leader / mode.

## Decision (per user, 2026-04-24)

Scope A from brainstorming with three refinements:

1. Single SQLite file at `${APP_DIR}/data/runs.db` (env override `PARACOSM_RUN_HISTORY_DB_PATH`), mirroring the existing session-store pattern.
2. Filters: `mode`, `scenarioId`, `leaderConfigHash`. Pagination: `limit` (default 50, max 500), `offset` (default 0). Sort: `createdAt DESC`.
3. No retention cap by default. Run records are tiny (~200 bytes); 100K rows = 20 MB. A future env var can add ring-buffer eviction if traffic warrants.

## Architecture

Single-table schema. Two new SQL methods on the existing `RunHistoryStore` interface (filters on `listRuns`, new `countRuns`). One new file (`sqlite-run-history-store.ts`). Zero changes to `RunRecord` shape. Wire format on `/api/v1/runs` extends to include pagination metadata.

## Schema

```sql
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

PRAGMA journal_mode = WAL;
```

Composite per-filter indexes serve every documented query path with a single index seek. `created_at DESC` as the trailing column matches the default sort.

## Interface change

```ts
// run-history-store.ts (extended)
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
```

`listRuns(filters?)` is backward-compatible with the four existing call sites (all pass no args). `countRuns` is optional so the noop store and existing tests do not break. New SQLite store implements both.

## Files

| File | Status | Purpose |
|---|---|---|
| `src/cli/server/run-history-store.ts` | Modify | Add `ListRunsFilters` interface, extend `listRuns` signature, add optional `countRuns` |
| `src/cli/server/sqlite-run-history-store.ts` | Create | `createSqliteRunHistoryStore({ dbPath })` factory + schema bootstrap + WAL mode + prepared statements for insert / list (with WHERE) / get / count |
| `tests/cli/sqlite-run-history-store.test.ts` | Create | Round-trip insert+list, getRun by id, filter combinations, limit/offset pagination, countRuns matches list length under filters, in-memory `:memory:` path support |
| `tests/cli/run-history-store.test.ts` | Modify | Existing noop test keeps passing (filters arg is ignored by noop) |
| `src/cli/server-app.ts` | Modify | Resolve store at startup: SQLite by default at `${APP_DIR}/data/runs.db` (env override), noop only when `PARACOSM_DISABLE_RUN_HISTORY=1` |
| `src/cli/server/routes/platform-api.ts` | Modify | `/api/v1/runs` reads `?mode=&scenario=&leader=&limit=&offset=` query params, returns `{ runs, total, hasMore }` |
| `tests/cli/platform-api.test.ts` | Create or extend | Filter combinations, pagination math, missing query params (defaults), invalid limit clamp |
| `docs/superpowers/plans/2026-04-23-paracosm-roadmap.md` | Modify | T4.3 row marked SHIPPED |

## Wire format change

`GET /api/v1/runs?mode=local_demo&scenario=mars-genesis&leader=leaders%3Aabc&limit=20&offset=40`

Response:

```json
{
  "runs": [
    { "runId": "run_...", "createdAt": "2026-04-24T15:32:11Z", "scenarioId": "mars-genesis", ... }
  ],
  "total": 138,
  "hasMore": true
}
```

`hasMore = offset + runs.length < total`. Useful for client-side "load more" without a HEAD request.

## Resolution + env

`server-app.ts` startup:

```ts
function resolveRunHistoryStore(env: NodeJS.ProcessEnv): RunHistoryStore {
  if (env.PARACOSM_DISABLE_RUN_HISTORY === '1') {
    return createNoopRunHistoryStore();
  }
  const dbPath = env.PARACOSM_RUN_HISTORY_DB_PATH
    ?? resolve(env.APP_DIR || '.', 'data', 'runs.db');
  return createSqliteRunHistoryStore({ dbPath });
}
```

Path resolution mirrors `sessionsDbPath` at server-app.ts:292. Directory is `mkdirSync({ recursive: true })`-ed in the SQLite store factory.

## Pagination + clamping

- `limit` default 50, max 500. Values above 500 clamp to 500. Negative or non-numeric values fall back to default.
- `offset` default 0. Negative or non-numeric values fall back to 0.
- Validated in the route handler before reaching the store, so the store can trust its inputs.

## Testing

TDD ordering. Each contract test runs against both the noop and SQLite implementations where applicable.

1. `insertRun` then `getRun(runId)` returns the same record.
2. `getRun(unknown)` returns null.
3. `listRuns()` with no filter returns all rows sorted by `createdAt DESC`.
4. `listRuns({ scenarioId: 'mars-genesis' })` filters correctly.
5. `listRuns({ mode: 'local_demo' })` filters correctly.
6. `listRuns({ leaderConfigHash: 'leaders:abc' })` filters correctly.
7. `listRuns({ limit: 5, offset: 0 })` returns the first 5 rows.
8. `listRuns({ limit: 5, offset: 5 })` returns the next 5 rows.
9. `countRuns({})` matches total inserted count.
10. `countRuns({ scenarioId: 'mars-genesis' })` matches filtered count.
11. SQLite store with `:memory:` path provides clean test isolation.
12. Inserting a duplicate `runId` is rejected (PK conflict throws or no-op; pick one and document).
13. `/api/v1/runs?mode=...&scenario=...&leader=...&limit=...&offset=...` returns the right `{ runs, total, hasMore }` shape.
14. Invalid query params (negative limit, NaN offset) clamp to defaults.

## Out of scope

- **Run-artifact storage** (the full `RunArtifact` JSON with per-turn events, decisions, fingerprints). T4.3 is metadata only. The session-store at `sessions.db` already captures full SSE event streams for replay; no need to duplicate.
- **Linking RunRecord to SessionMeta** (cross-table join between runs.db and sessions.db). Different concerns; separate spec if needed.
- **Ring-buffer retention**. 100K records is 20 MB on disk. Add `PARACOSM_RUN_HISTORY_MAX_ROWS` env var if traffic ever warrants. Skip implementing until then.
- **Auth on the `/runs` route**. Already gated to `mode === 'platform_api'`. Higher-level auth is the consumer's responsibility.
- **Migration runner**. `CREATE TABLE IF NOT EXISTS` handles fresh deployments. Schema version tracking can be added later if `RunRecord` grows.
- **Postgres adapter**. Per stored memory `paracosm uses SQLite (not Postgres)`.

## Migration

Single-commit ship in the paracosm submodule plus a monorepo pointer bump. No npm publish, no consumer dep changes, no schema migration of existing data (no existing data; the noop store kept nothing).

## Roadmap update

T4.3 row marked SHIPPED in the same commit.
