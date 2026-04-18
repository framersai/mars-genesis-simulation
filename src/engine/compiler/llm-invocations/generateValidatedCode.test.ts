import test from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatedCode } from './generateValidatedCode.js';
import { createCompilerTelemetry } from '../telemetry.js';

type TestFn = (x: number) => number;
const parseAsFn = (text: string): TestFn | null => {
  const cleaned = text.trim().replace(/^```(?:typescript|ts|javascript|js)?\n?/i, '').replace(/\n?```$/i, '');
  try {
    const fn = new Function('return ' + cleaned)();
    return typeof fn === 'function' ? fn : null;
  } catch {
    return null;
  }
};
const smokeTest = (fn: TestFn) => {
  const out = fn(3);
  if (typeof out !== 'number') throw new Error('must return number');
};
const fallback: TestFn = () => 0;

test('returns parsed fn on first try', async () => {
  const calls: string[] = [];
  const mock = async (p: string | { prompt: string }) => {
    calls.push(typeof p === 'string' ? p : p.prompt);
    return '(x) => x * 2';
  };
  const result = await generateValidatedCode({
    hookName: 'test',
    systemCacheable: 'sys',
    prompt: 'write a doubler',
    parse: parseAsFn,
    smokeTest,
    fallback,
    fallbackSource: 'fallback',
    generateText: mock as any,
  });
  assert.equal(result.fromFallback, false);
  assert.equal(result.attempts, 1);
  assert.equal(result.hook(5), 10);
  assert.equal(calls.length, 1);
});

test('retries with YOUR PRIOR OUTPUT when parse fails, then succeeds', async () => {
  let call = 0;
  const seen: string[] = [];
  const mock = async (p: string | { prompt: string }) => {
    call += 1;
    seen.push(typeof p === 'string' ? p : p.prompt);
    return call === 1 ? 'this is not code' : '(x) => x + 1';
  };
  const result = await generateValidatedCode({
    hookName: 'test',
    systemCacheable: 'sys',
    prompt: 'write an incrementer',
    parse: parseAsFn,
    smokeTest,
    fallback,
    fallbackSource: 'fallback',
    generateText: mock as any,
  });
  assert.equal(result.fromFallback, false);
  assert.equal(result.attempts, 2);
  assert.equal(result.hook(4), 5);
  assert.ok(seen[1].includes('YOUR PRIOR OUTPUT'), 'retry prompt missing prior-output block');
  assert.ok(seen[1].includes('this is not code'), 'retry prompt missing actual prior text');
});

test('retries when smokeTest throws and exposes error in retry prompt', async () => {
  let call = 0;
  const seen: string[] = [];
  const mock = async (p: string | { prompt: string }) => {
    call += 1;
    seen.push(typeof p === 'string' ? p : p.prompt);
    return call === 1 ? '(x) => "not a number"' : '(x) => x';
  };
  const result = await generateValidatedCode({
    hookName: 'test',
    systemCacheable: 'sys',
    prompt: 'write identity',
    parse: parseAsFn,
    smokeTest,
    fallback,
    fallbackSource: 'fallback',
    generateText: mock as any,
  });
  assert.equal(result.fromFallback, false);
  assert.equal(result.attempts, 2);
  assert.ok(seen[1].includes('must return number'));
});

test('returns fallback + records telemetry after exhausting retries', async () => {
  const tele = createCompilerTelemetry();
  const mock = async () => 'still not code';
  const result = await generateValidatedCode({
    hookName: 'progression',
    systemCacheable: 'sys',
    prompt: 'write code',
    parse: parseAsFn,
    smokeTest,
    fallback,
    fallbackSource: 'fallback',
    maxRetries: 2,
    generateText: mock as any,
    telemetry: tele,
  });
  assert.equal(result.fromFallback, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.hook, fallback);
  const snap = tele.snapshot();
  assert.ok(snap.schemaRetries['compile:progression']);
  assert.equal(snap.schemaRetries['compile:progression'].fallbacks, 1);
  assert.equal(snap.fallbacks.length, 1);
  assert.equal(snap.fallbacks[0].hookName, 'progression');
  assert.ok(snap.fallbacks[0].rawText.includes('still not code'));
});

test('passes system block with cacheBreakpoint to generateText', async () => {
  let capturedCall: unknown;
  const mock = async (p: string | { system?: unknown; prompt: string }) => {
    capturedCall = p;
    return '(x) => x';
  };
  await generateValidatedCode({
    hookName: 'test',
    systemCacheable: 'stable',
    prompt: 'identity',
    parse: parseAsFn,
    smokeTest,
    fallback,
    fallbackSource: 'fallback',
    generateText: mock as any,
  });
  assert.ok(typeof capturedCall === 'object', 'should call with options form');
  assert.deepEqual((capturedCall as { system: unknown }).system, [{ text: 'stable', cacheBreakpoint: true }]);
});
