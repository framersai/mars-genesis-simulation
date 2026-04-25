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
  assert.equal(loaded?.createdAt, '2026-04-24T10:00:00Z');
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
