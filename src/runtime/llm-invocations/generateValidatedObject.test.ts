import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { generateValidatedObject } from './generateValidatedObject.js';

const TestSchema = z.object({ value: z.string() });

test('generateValidatedObject returns validated object on success', async () => {
  const mockGenerateObject = async () => ({
    object: { value: 'ok' },
    text: '{"value":"ok"}',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
    provider: 'mock',
    model: 'mock-model',
  });
  const result = await generateValidatedObject({
    provider: 'mock',
    model: 'mock-model',
    schema: TestSchema,
    prompt: 'test',
    _generateObjectImpl: mockGenerateObject as any,
  });
  assert.equal(result.object.value, 'ok');
  assert.equal(result.fromFallback, false);
});

test('generateValidatedObject returns fallback on ObjectGenerationError', async () => {
  const { ObjectGenerationError } = await import('@framers/agentos');
  const mockGenerateObject = async () => {
    throw new ObjectGenerationError('bad', 'raw text', undefined as any);
  };
  let errorSeen = false;
  const result = await generateValidatedObject({
    provider: 'mock',
    model: 'mock-model',
    schema: TestSchema,
    prompt: 'test',
    fallback: { value: 'default' },
    onProviderError: () => { errorSeen = true; },
    _generateObjectImpl: mockGenerateObject as any,
  });
  assert.equal(result.object.value, 'default');
  assert.equal(result.fromFallback, true);
  assert.equal(errorSeen, true);
});

test('generateValidatedObject re-throws when no fallback', async () => {
  const { ObjectGenerationError } = await import('@framers/agentos');
  const mockGenerateObject = async () => {
    throw new ObjectGenerationError('bad', 'raw text', undefined as any);
  };
  await assert.rejects(
    () => generateValidatedObject({
      provider: 'mock',
      model: 'mock-model',
      schema: TestSchema,
      prompt: 'test',
      _generateObjectImpl: mockGenerateObject as any,
    }),
    /bad/,
  );
});

test('generateValidatedObject calls onUsage on success', async () => {
  const mockGenerateObject = async () => ({
    object: { value: 'ok' },
    text: '{}',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUSD: 0.001 },
    finishReason: 'stop',
    provider: 'mock',
    model: 'mock-model',
  });
  let usageSeen: any = null;
  await generateValidatedObject({
    provider: 'mock',
    model: 'mock-model',
    schema: TestSchema,
    prompt: 'test',
    onUsage: (r) => { usageSeen = r.usage; },
    _generateObjectImpl: mockGenerateObject as any,
  });
  assert.equal(usageSeen.totalTokens, 15);
  assert.equal(usageSeen.costUSD, 0.001);
});
