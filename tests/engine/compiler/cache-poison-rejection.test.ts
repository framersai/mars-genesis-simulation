/**
 * Locks in the cache-poisoning regression that crashed the sandbox at
 * simulate-time when a previous compile had cached `'// No-op: generation
 * failed'` as the source for a hook. The fix has two pieces:
 *
 *   1. Each generator's `parseResponse` now rejects unparseable sources
 *      via {@link isParseableArrowSource}, returning null so
 *      `restoreHookFromCache` falls through to a regenerate path
 *      instead of returning a closure that fails at sandbox parse.
 *
 *   2. The compiler skips disk-cache writes when
 *      `result.fromFallback === true`, so a failed compile no longer
 *      poisons the cache for future runs.
 *
 * @module tests/engine/compiler/cache-poison-rejection
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseResponse as parseProgression } from '../../../src/engine/compiler/generate-progression.js';
import { parseResponse as parsePolitics } from '../../../src/engine/compiler/generate-politics.js';
import { parseResponse as parsePrompts } from '../../../src/engine/compiler/generate-prompts.js';
import { parseResponse as parseFingerprint } from '../../../src/engine/compiler/generate-fingerprint.js';
import { parseResponse as parseReactions } from '../../../src/engine/compiler/generate-reactions.js';

describe('parseResponse rejects comment-only cached fallback strings', () => {
  // The exact strings that older builds wrote to disk cache.
  const POISONED_SOURCES = [
    '// No-op: generation failed',
    '// Fallback fingerprint',
    '// Fallback department prompts',
    '// Fallback reaction context',
    '/* fallback */',
    '',
    '   ',
  ];

  for (const src of POISONED_SOURCES) {
    it(`progression rejects ${JSON.stringify(src)}`, () => {
      assert.equal(parseProgression(src), null);
    });
    it(`politics rejects ${JSON.stringify(src)}`, () => {
      assert.equal(parsePolitics(src), null);
    });
    it(`prompts rejects ${JSON.stringify(src)}`, () => {
      assert.equal(parsePrompts(src), null);
    });
    it(`fingerprint rejects ${JSON.stringify(src)}`, () => {
      assert.equal(parseFingerprint(src), null);
    });
    it(`reactions rejects ${JSON.stringify(src)}`, () => {
      assert.equal(parseReactions(src), null);
    });
  }
});

describe('parseResponse accepts valid arrow sources', () => {
  it('progression accepts a no-op arrow', () => {
    const fn = parseProgression('(_ctx) => {}');
    assert.notEqual(fn, null);
  });

  it('politics accepts a null-returning arrow', () => {
    const fn = parsePolitics('(_category, _outcome) => null');
    assert.notEqual(fn, null);
  });

  it('prompts accepts an empty-array-returning arrow', () => {
    const fn = parsePrompts('(_ctx) => []');
    assert.notEqual(fn, null);
  });

  it('fingerprint accepts an object-returning arrow', () => {
    const fn = parseFingerprint(
      '(_fs, _log, _l, _t, _m) => ({ summary: "ok" })',
    );
    assert.notEqual(fn, null);
  });

  it('reactions accepts a string-returning arrow', () => {
    const fn = parseReactions('(_c, _ctx) => "ok"');
    assert.notEqual(fn, null);
  });
});

describe('parseResponse strips markdown fences before validation', () => {
  it('progression accepts an arrow wrapped in ```ts fences', () => {
    const fn = parseProgression('```ts\n(_ctx) => {}\n```');
    assert.notEqual(fn, null);
  });
});
