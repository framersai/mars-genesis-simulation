/**
 * Tests for {@link isParseableArrowSource} — the guard each compile
 * hook's parseResponse uses to reject comment-only or otherwise
 * unparseable LLM output before it reaches the sandbox runner.
 *
 * The bug this guards against (cached fallback `'// No-op: generation
 * failed'` deserializing to a closure that crashed the sandbox at
 * parse-time) is locked in by the cache-poison-rejection cases below.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isParseableArrowSource } from '../../../src/engine/compiler/source-validation.js';

describe('isParseableArrowSource', () => {
  it('accepts a basic arrow function', () => {
    assert.equal(isParseableArrowSource('(ctx) => { return 1; }'), true);
  });

  it('accepts an async arrow function', () => {
    assert.equal(isParseableArrowSource('async (ctx) => 42'), true);
  });

  it('accepts a parenthesized object-returning arrow', () => {
    assert.equal(isParseableArrowSource('(a, b) => ({ x: a + b })'), true);
  });

  it('accepts a function expression', () => {
    assert.equal(isParseableArrowSource('function (ctx) { return ctx.turn; }'), true);
  });

  it('accepts the realistic progression fallback literal', () => {
    assert.equal(isParseableArrowSource('(_ctx) => {}'), true);
  });

  it('accepts the realistic fingerprint fallback literal', () => {
    const src =
      '(_finalState, _outcomeLog, _leader, _toolRegs, _maxTurns) => ({ summary: "fallback" })';
    assert.equal(isParseableArrowSource(src), true);
  });

  it('rejects empty string', () => {
    assert.equal(isParseableArrowSource(''), false);
  });

  it('rejects whitespace-only', () => {
    assert.equal(isParseableArrowSource('   \n  \t  '), false);
  });

  it('rejects single-line comment (the original poisoned cache shape)', () => {
    assert.equal(isParseableArrowSource('// No-op: generation failed'), false);
  });

  it('rejects multi-line comment block', () => {
    assert.equal(isParseableArrowSource('/* fallback */'), false);
  });

  it('rejects a bare statement (const declaration is not an expression)', () => {
    assert.equal(isParseableArrowSource('const x = 1'), false);
  });

  it('rejects markdown prose', () => {
    const prose =
      'You are the Event Director agent for a simulation engine. Your job is to...';
    assert.equal(isParseableArrowSource(prose), false);
  });

  it('rejects truncated arrow (parse error)', () => {
    assert.equal(isParseableArrowSource('(ctx) => {'), false);
  });

  it('rejects a return statement (illegal at expression position)', () => {
    assert.equal(isParseableArrowSource('return null'), false);
  });
});
