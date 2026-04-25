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
