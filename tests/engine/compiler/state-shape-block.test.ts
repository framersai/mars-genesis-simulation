import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStateShapeBlock } from '../../../src/engine/compiler/state-shape-block.js';

test('buildStateShapeBlock lists scenario-declared metric keys under state.systems', () => {
  const block = buildStateShapeBlock({
    labels: { timeUnitNoun: 'quarter', timeUnitNounPlural: 'quarters' },
    world: {
      metrics: { revenue: { id: 'revenue' }, morale: { id: 'morale' } },
      capacities: {},
      politics: {},
    },
  });
  assert.ok(block.includes('state.systems'));
  assert.ok(block.includes('revenue'));
  assert.ok(block.includes('morale'));
  assert.ok(block.includes('quarter'));
  assert.ok(block.includes('quarters'));
});

test('buildStateShapeBlock merges world.capacities keys into state.systems', () => {
  const block = buildStateShapeBlock({
    world: {
      metrics: { metricA: { id: 'metricA' } },
      capacities: { capB: { id: 'capB' } },
      politics: {},
    },
  });
  // Both keys should appear in the state.systems key list because
  // capacities flatten into systems at runtime.
  assert.ok(block.includes('metricA'));
  assert.ok(block.includes('capB'));
});

test('buildStateShapeBlock explicitly denies capacities/statuses/environment at runtime', () => {
  const block = buildStateShapeBlock({
    world: { metrics: {}, capacities: {}, statuses: {}, politics: {}, environment: {} },
  });
  assert.ok(
    block.includes('DO NOT EXIST at runtime'),
    'prompt must tell the LLM that state.capacities/statuses/environment are declaration-only',
  );
});

test('buildStateShapeBlock falls back to tick when timeUnit not set', () => {
  const block = buildStateShapeBlock({
    world: { metrics: {}, capacities: {}, politics: {} },
  });
  assert.ok(block.includes('tick'));
  assert.ok(block.includes('ticks'));
});

test('buildStateShapeBlock renders "(none declared)" for empty bags', () => {
  const block = buildStateShapeBlock({
    world: { metrics: {}, capacities: {}, politics: {} },
  });
  assert.ok(block.includes('(none declared)'));
});

test('buildStateShapeBlock encourages defensive access via nullish-coalescing', () => {
  const block = buildStateShapeBlock({
    world: { metrics: { x: { id: 'x' } }, capacities: {}, politics: {} },
  });
  assert.ok(
    block.includes('?? 0') || block.includes('Defensive access'),
    'prompt should recommend defensive access pattern',
  );
});
