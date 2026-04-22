/**
 * Migration-chain unit tests. Pure-function scope so the chain can be
 * exercised without FileReader / DOM. Lives under hooks/ because the
 * chain is called by useGamePersistence.parseFile.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
  runMigrationChain,
  SchemaVersionTooNewError,
  SchemaVersionGapError,
  migrations,
} from './schemaMigration.js';

const canonical = {
  schemaVersion: 2,
  events: [
    { type: 'turn_start', leader: 'A', turn: 1, data: { turn: 1 } },
  ],
  results: [],
  startedAt: '2026-04-21T14:32:00.000Z',
  completedAt: '2026-04-21T14:55:00.000Z',
};

test('CURRENT_SCHEMA_VERSION is 2 today', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, 2);
});

test('runMigrationChain: current-version data passes through as identity', () => {
  const out = runMigrationChain(canonical as never);
  assert.equal(out.schemaVersion, 2);
  assert.equal(out.events.length, 1);
});

test('runMigrationChain: missing schemaVersion treated as v1, migrated to 2', () => {
  const legacy = {
    events: [
      {
        type: 'colony_snapshot',
        leader: 'A',
        data: { colony: { population: 30 }, colonyDeltas: { morale: 0.1 } },
      },
    ],
    results: [{ leader: { colony: 'Alpha' } }],
  };
  const out = runMigrationChain(legacy as never);
  assert.equal(out.schemaVersion, 2);
  // Legacy migration should have fired; event type rewritten.
  assert.equal(out.events[0].type, 'systems_snapshot');
});

test('runMigrationChain: schemaVersion > current throws SchemaVersionTooNewError', () => {
  const future = {
    schemaVersion: 99,
    events: [{ type: 'turn_start', leader: 'A', data: { turn: 1 } }],
  };
  assert.throws(
    () => runMigrationChain(future as never),
    (err: unknown) => {
      if (!(err instanceof SchemaVersionTooNewError)) return false;
      return err.fileVersion === 99 && err.dashboardVersion === CURRENT_SCHEMA_VERSION;
    },
  );
});

test('runMigrationChain: idempotent — running twice returns equivalent shape', () => {
  const once = runMigrationChain(canonical as never);
  const twice = runMigrationChain(once as never);
  assert.equal(twice.schemaVersion, once.schemaVersion);
  assert.equal(twice.events.length, once.events.length);
});

test('migrations table exposes the v1 -> v2 step for future migrations to chain onto', () => {
  assert.equal(typeof migrations[1], 'function');
});

test('SchemaVersionGapError is exported but should never fire on a valid chain', () => {
  // Construct directly to assert shape. Real chain won't throw it on
  // current inputs; this test is a shape guard so future migrations
  // can rely on the exception type existing.
  const err = new SchemaVersionGapError(5);
  assert.equal(err.missingFromVersion, 5);
  assert.ok(err instanceof Error);
});
