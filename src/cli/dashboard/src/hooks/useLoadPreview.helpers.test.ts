/**
 * Pure-logic tests for useLoadPreview's helpers. The hook is React-only;
 * helpers live in a sibling file so they can run under node:test without
 * a DOM shim, matching the dashboard's established pattern (see
 * LoadMenu.helpers.test.ts, useGameState.test.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPreviewMetadata,
  formatFileSize,
  reducePreviewState,
  type PreviewState,
  type PreviewAction,
  type PreviewMetadata,
} from './useLoadPreview.helpers.js';

const sampleMetadata: PreviewMetadata = {
  scenarioName: 'Mars Genesis',
  schemaVersion: 2,
  leaderNames: ['Aria Chen', 'Vik Voss'],
  turnCount: 6,
  eventCount: 83,
  startedAt: '2026-04-21T14:32:00.000Z',
  hasVerdict: true,
  fileName: 'mars-83events.json',
  fileSize: '142 KB',
};

const sampleData: unknown = { events: [], schemaVersion: 2 };

const canonicalFixture = {
  config: null,
  schemaVersion: 2,
  startedAt: '2026-04-21T14:32:00.000Z',
  completedAt: '2026-04-21T14:55:00.000Z',
  verdict: {
    winner: 'A',
    winnerName: 'Aria Chen',
    headline: 'Bold expansion outpaced cautious engineering',
  },
  scenario: {
    id: 'mars-genesis',
    version: '1.0.0',
    shortName: 'mars',
  },
  events: [
    {
      type: 'turn_start',
      leader: 'Aria Chen',
      turn: 1,
      data: {
        turn: 1,
        year: 2035,
        scenario: { name: 'Mars Genesis', id: 'mars-genesis' },
        systems: { population: 30, morale: 0.8 },
      },
    },
    {
      type: 'turn_done',
      leader: 'Aria Chen',
      turn: 1,
      data: { turn: 1, year: 2035 },
    },
    {
      type: 'turn_start',
      leader: 'Vik Voss',
      turn: 1,
      data: { turn: 1, year: 2035 },
    },
    {
      type: 'turn_done',
      leader: 'Vik Voss',
      turn: 6,
      data: { turn: 6, year: 2067 },
    },
  ],
  results: [],
};

const legacyFixture = {
  config: null,
  startedAt: '2026-04-18T10:00:00.000Z',
  completedAt: null,
  events: [
    {
      type: 'turn_start',
      leader: 'Alice',
      turn: 1,
      data: { turn: 1, year: 2030 },
    },
    {
      type: 'turn_done',
      leader: 'Alice',
      turn: 3,
      data: { turn: 3, year: 2038 },
    },
  ],
  results: [],
};

test('extractPreviewMetadata: canonical fixture populates every field', () => {
  const meta = extractPreviewMetadata(canonicalFixture, {
    name: 'mars-4events.json',
    size: 142 * 1024,
  });
  assert.ok(meta, 'returns metadata');
  assert.equal(meta!.scenarioName, 'Mars Genesis');
  assert.equal(meta!.schemaVersion, 2);
  assert.deepEqual(meta!.leaderNames, ['Aria Chen', 'Vik Voss']);
  assert.equal(meta!.turnCount, 6);
  assert.equal(meta!.eventCount, 4);
  assert.equal(meta!.hasVerdict, true);
  assert.equal(meta!.fileName, 'mars-4events.json');
  assert.equal(meta!.fileSize, '142 KB');
  assert.ok(meta!.startedAt, 'startedAt present');
});

test('extractPreviewMetadata: legacy fixture (no schemaVersion) reports legacy + infers scenario from events', () => {
  const meta = extractPreviewMetadata(legacyFixture, {
    name: 'legacy.json',
    size: 4096,
  });
  assert.ok(meta, 'returns metadata');
  assert.equal(meta!.schemaVersion, 'legacy');
  assert.equal(meta!.hasVerdict, false);
  assert.deepEqual(meta!.leaderNames, ['Alice']);
  assert.equal(meta!.turnCount, 3);
  assert.equal(meta!.eventCount, 2);
});

test('extractPreviewMetadata: empty events returns null', () => {
  const meta = extractPreviewMetadata({ events: [] });
  assert.equal(meta, null);
});

test('extractPreviewMetadata: missing events field returns null', () => {
  const meta = extractPreviewMetadata({ config: null });
  assert.equal(meta, null);
});

test('extractPreviewMetadata: non-object input returns null', () => {
  assert.equal(extractPreviewMetadata(null), null);
  assert.equal(extractPreviewMetadata(undefined), null);
  assert.equal(extractPreviewMetadata('string'), null);
  assert.equal(extractPreviewMetadata(42), null);
});

test('extractPreviewMetadata: single-leader fixture produces 1-element leaderNames', () => {
  const meta = extractPreviewMetadata(legacyFixture);
  assert.equal(meta!.leaderNames.length, 1);
  assert.equal(meta!.leaderNames[0], 'Alice');
});

test('extractPreviewMetadata: deduplicates leader names across many events', () => {
  const fixture = {
    events: [
      { type: 'turn_start', leader: 'Alice', turn: 1, data: { turn: 1 } },
      { type: 'turn_start', leader: 'Alice', turn: 2, data: { turn: 2 } },
      { type: 'turn_start', leader: 'Bob', turn: 1, data: { turn: 1 } },
      { type: 'turn_start', leader: 'Alice', turn: 3, data: { turn: 3 } },
    ],
  };
  const meta = extractPreviewMetadata(fixture);
  assert.deepEqual(meta!.leaderNames, ['Alice', 'Bob']);
});

test('extractPreviewMetadata: skips events without a leader field when aggregating', () => {
  const fixture = {
    events: [
      { type: 'sim_start', data: { turn: 0 } },
      { type: 'turn_start', leader: 'Alice', turn: 1, data: { turn: 1 } },
      { type: 'replay_done', data: {} },
    ],
  };
  const meta = extractPreviewMetadata(fixture);
  assert.deepEqual(meta!.leaderNames, ['Alice']);
});

test('extractPreviewMetadata: verdict=null reports hasVerdict false', () => {
  const meta = extractPreviewMetadata({
    ...canonicalFixture,
    verdict: null,
  });
  assert.equal(meta!.hasVerdict, false);
});

test('extractPreviewMetadata: no file argument still returns metadata with empty fileName/Size', () => {
  const meta = extractPreviewMetadata(canonicalFixture);
  assert.ok(meta);
  assert.equal(meta!.fileName, '');
  assert.equal(meta!.fileSize, '');
});

test('extractPreviewMetadata: scenarioName falls back to scenario.shortName when events lack the field', () => {
  const fixture = {
    schemaVersion: 2,
    scenario: { id: 'submarine', version: '1.0.0', shortName: 'Submarine' },
    events: [
      { type: 'turn_start', leader: 'Nemo', turn: 1, data: { turn: 1 } },
    ],
  };
  const meta = extractPreviewMetadata(fixture);
  assert.equal(meta!.scenarioName, 'Submarine');
});

test('extractPreviewMetadata: unknown scenario falls back to the literal "unknown"', () => {
  const fixture = {
    events: [
      { type: 'turn_start', leader: 'Alice', turn: 1, data: { turn: 1 } },
    ],
  };
  const meta = extractPreviewMetadata(fixture);
  assert.equal(meta!.scenarioName, 'unknown');
});

test('formatFileSize: 0 bytes', () => {
  assert.equal(formatFileSize(0), '0 B');
});

test('formatFileSize: sub-KB reports bytes', () => {
  assert.equal(formatFileSize(500), '500 B');
});

test('formatFileSize: exactly 1 KB', () => {
  assert.equal(formatFileSize(1024), '1 KB');
});

test('formatFileSize: 142 KB', () => {
  assert.equal(formatFileSize(142 * 1024), '142 KB');
});

test('formatFileSize: fractional MB rounds to one decimal', () => {
  assert.equal(formatFileSize(1.5 * 1024 * 1024), '1.5 MB');
});

test('formatFileSize: large files report MB', () => {
  assert.equal(formatFileSize(50 * 1024 * 1024), '50 MB');
});

// -- reducePreviewState ----------------------------------------------------

test('reducePreviewState: idle + open-started -> parsing', () => {
  const next = reducePreviewState(
    { kind: 'idle' },
    { type: 'open-started' },
  );
  assert.equal(next.kind, 'parsing');
});

test('reducePreviewState: parsing + open-succeeded -> preview with metadata + data', () => {
  const next = reducePreviewState(
    { kind: 'parsing' },
    { type: 'open-succeeded', metadata: sampleMetadata, data: sampleData },
  );
  assert.equal(next.kind, 'preview');
  if (next.kind === 'preview') {
    assert.equal(next.metadata.scenarioName, 'Mars Genesis');
    assert.equal(next.data, sampleData);
  }
});

test('reducePreviewState: parsing + open-failed -> idle', () => {
  const next = reducePreviewState(
    { kind: 'parsing' },
    { type: 'open-failed' },
  );
  assert.equal(next.kind, 'idle');
});

test('reducePreviewState: preview + cancel -> idle', () => {
  const previewState: PreviewState = {
    kind: 'preview',
    metadata: sampleMetadata,
    data: sampleData,
  };
  const next = reducePreviewState(previewState, { type: 'cancel' });
  assert.equal(next.kind, 'idle');
});

test('reducePreviewState: preview + confirm -> dispatching carrying data', () => {
  const previewState: PreviewState = {
    kind: 'preview',
    metadata: sampleMetadata,
    data: sampleData,
  };
  const next = reducePreviewState(previewState, { type: 'confirm' });
  assert.equal(next.kind, 'dispatching');
  if (next.kind === 'dispatching') {
    assert.equal(next.data, sampleData);
  }
});

test('reducePreviewState: dispatching + confirm-complete -> idle', () => {
  const next = reducePreviewState(
    { kind: 'dispatching', data: sampleData },
    { type: 'confirm-complete' },
  );
  assert.equal(next.kind, 'idle');
});

test('reducePreviewState: open-started while in preview is rejected (no-op to idle transition)', () => {
  const previewState: PreviewState = {
    kind: 'preview',
    metadata: sampleMetadata,
    data: sampleData,
  };
  const next = reducePreviewState(previewState, { type: 'open-started' });
  assert.equal(next.kind, 'preview', 'state unchanged');
  assert.equal(next, previewState, 'same reference preserved');
});

test('reducePreviewState: confirm while idle is a no-op', () => {
  const idle: PreviewState = { kind: 'idle' };
  const next = reducePreviewState(idle, { type: 'confirm' });
  assert.equal(next, idle);
});

test('reducePreviewState: cancel while idle is a no-op', () => {
  const idle: PreviewState = { kind: 'idle' };
  const next = reducePreviewState(idle, { type: 'cancel' });
  assert.equal(next, idle);
});

// Silence unused-type warnings when PreviewAction isn't instantiated at runtime.
const _actionShape: PreviewAction = { type: 'cancel' };
void _actionShape;
