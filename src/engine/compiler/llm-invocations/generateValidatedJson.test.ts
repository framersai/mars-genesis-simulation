import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { generateValidatedJson } from './generateValidatedJson.js';
import { createCompilerTelemetry } from '../telemetry.js';

const S = z.object({ name: z.string(), count: z.number().min(0) });

test('parses valid JSON on first try', async () => {
  const mock = async () => '{"name":"ok","count":5}';
  const r = await generateValidatedJson({
    hookName: 'test',
    systemCacheable: 'sys',
    prompt: 'go',
    schema: S,
    fallback: { name: 'fb', count: 0 },
    generateText: mock as any,
  });
  assert.equal(r.fromFallback, false);
  assert.equal(r.attempts, 1);
  assert.equal(r.object.count, 5);
});

test('strips code fences before parsing', async () => {
  const mock = async () => '```json\n{"name":"ok","count":2}\n```';
  const r = await generateValidatedJson({
    hookName: 'test',
    systemCacheable: 'sys',
    prompt: 'go',
    schema: S,
    fallback: { name: 'fb', count: 0 },
    generateText: mock as any,
  });
  assert.equal(r.fromFallback, false);
  assert.equal(r.object.count, 2);
});

test('retries with YOUR PRIOR OUTPUT when schema fails', async () => {
  let call = 0;
  const seen: string[] = [];
  const mock = async (p: string | { prompt: string }) => {
    call += 1;
    seen.push(typeof p === 'string' ? p : p.prompt);
    return call === 1 ? '{"name":"x","count":-1}' : '{"name":"x","count":3}';
  };
  const r = await generateValidatedJson({
    hookName: 'test',
    systemCacheable: 'sys',
    prompt: 'generate',
    schema: S,
    fallback: { name: 'fb', count: 0 },
    generateText: mock as any,
  });
  assert.equal(r.fromFallback, false);
  assert.equal(r.attempts, 2);
  assert.ok(seen[1].includes('YOUR PRIOR OUTPUT'));
  assert.ok(seen[1].includes('count'));
});

test('returns fallback and records telemetry on exhausted retries', async () => {
  const tele = createCompilerTelemetry();
  const mock = async () => 'no json here';
  const r = await generateValidatedJson({
    hookName: 'milestones',
    systemCacheable: 'sys',
    prompt: 'generate',
    schema: S,
    fallback: { name: 'fb', count: 0 },
    maxRetries: 2,
    generateText: mock as any,
    telemetry: tele,
  });
  assert.equal(r.fromFallback, true);
  assert.equal(r.attempts, 2);
  assert.equal(r.object.name, 'fb');
  const snap = tele.snapshot();
  assert.equal(snap.schemaRetries['compile:milestones'].fallbacks, 1);
});

test('passes cacheBreakpoint system block through generateText', async () => {
  let captured: unknown;
  const mock = async (p: string | { system?: unknown; prompt: string }) => {
    captured = p;
    return '{"name":"ok","count":1}';
  };
  await generateValidatedJson({
    hookName: 'test',
    systemCacheable: 'stable',
    prompt: 'go',
    schema: S,
    fallback: { name: 'fb', count: 0 },
    generateText: mock as any,
  });
  assert.ok(typeof captured === 'object');
  assert.deepEqual((captured as { system: unknown }).system, [{ text: 'stable', cacheBreakpoint: true }]);
});
