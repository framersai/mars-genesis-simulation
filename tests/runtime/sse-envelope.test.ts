import test from 'node:test';
import assert from 'node:assert/strict';
import { emitStreamEvent, mapLegacyEventType } from '../../src/runtime/sse-envelope.js';

test('mapLegacyEventType renames dept_start -> specialist_start', () => {
  assert.equal(mapLegacyEventType('dept_start'), 'specialist_start');
});

test('mapLegacyEventType renames dept_done -> specialist_done', () => {
  assert.equal(mapLegacyEventType('dept_done'), 'specialist_done');
});

test('mapLegacyEventType renames commander_deciding -> decision_pending', () => {
  assert.equal(mapLegacyEventType('commander_deciding'), 'decision_pending');
});

test('mapLegacyEventType renames commander_decided -> decision_made', () => {
  assert.equal(mapLegacyEventType('commander_decided'), 'decision_made');
});

test('mapLegacyEventType renames drift -> personality_drift', () => {
  assert.equal(mapLegacyEventType('drift'), 'personality_drift');
});

test('mapLegacyEventType passes unchanged types through', () => {
  assert.equal(mapLegacyEventType('turn_start'), 'turn_start');
  assert.equal(mapLegacyEventType('outcome'), 'outcome');
  assert.equal(mapLegacyEventType('provider_error'), 'provider_error');
});

test('emitStreamEvent passes validated payload through to underlying emitter', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const captured: unknown[] = [];
    emitStreamEvent((event) => captured.push(event), {
      type: 'turn_done',
      leader: 'Captain Reyes',
      turn: 3,
      time: 2038,
      data: { systems: { population: 130 }, toolsForged: 2 },
    });
    assert.equal(captured.length, 1);
    const evt = captured[0] as { type: string; data: { toolsForged: number } };
    assert.equal(evt.type, 'turn_done');
    assert.equal(evt.data.toolsForged, 2);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('emitStreamEvent surfaces validation errors in dev mode', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    assert.throws(
      () =>
        emitStreamEvent(() => {}, {
          // Missing required `leader`
          type: 'turn_done',
          data: { systems: {}, toolsForged: 0 },
        } as never),
      /leader|Invalid/,
    );
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('emitStreamEvent skips validation in production mode', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const captured: unknown[] = [];
    // Malformed payload — would throw in dev, should pass through raw in prod.
    emitStreamEvent((event) => captured.push(event), {
      type: 'turn_done',
      data: { systems: {}, toolsForged: 0 },
    } as never);
    assert.equal(captured.length, 1);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
