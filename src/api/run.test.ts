import test from 'node:test';
import assert from 'node:assert/strict';
import { run, runMany } from './run.js';

test('run is exported and callable', () => {
  assert.equal(typeof run, 'function');
});

test('runMany is exported and callable', () => {
  assert.equal(typeof runMany, 'function');
});

test('runMany returns a Promise (smoke; no LLM call)', () => {
  // We catch the rejection because the function will fail without an
  // LLM API key in the test environment. The point is just that it
  // returns a Promise of the right shape, not that the LLM responds.
  const promise = runMany('test brief', { count: 2 }).catch(() => null);
  assert.ok(promise instanceof Promise, 'runMany returns a Promise');
});

test('runMany type-checks accept URL prompts', () => {
  // Compile-time only.
  const _ = (): Promise<unknown> => runMany(new URL('https://example.com'), { count: 2 });
  void _;
  assert.ok(true);
});
