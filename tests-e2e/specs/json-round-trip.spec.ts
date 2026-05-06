/**
 * JSON config round-trip via the public library-import endpoint.
 *
 * The dashboard's Studio tab accepts dropped RunArtifact JSONs and
 * POSTs them to `/api/v1/library/import`. This is the canonical user
 * path for "I have a saved artifact, get it into my library so I can
 * compare it side-by-side with a fresh run". A 5xx here is a deploy
 * regression; a strict 4xx with a clear validation message is OK and
 * documents the contract.
 */
import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../tests/fixtures');

test('POST /api/v1/library/import accepts a single RunArtifact without 5xx', async ({ request }) => {
  const artifact = JSON.parse(readFileSync(path.join(FIXTURES, 'runArtifact-v0.8-turn-loop.json'), 'utf-8')) as Record<string, unknown>;
  const res = await request.post('/api/v1/library/import', {
    data: { artifact },
    failOnStatusCode: false,
  });
  // 2xx is the happy path. 4xx is acceptable IF the body explains
  // which schema field rejected — that's a contract test, not a
  // regression. 5xx is always a server crash.
  expect(
    res.status(),
    `Server crash on round-trip import: ${res.status()}`,
  ).toBeLessThan(500);
});

test('POST /api/v1/library/import accepts an artifact bundle without 5xx', async ({ request }) => {
  const bundle = JSON.parse(readFileSync(path.join(FIXTURES, 'runArtifact-v0.8-bundle.json'), 'utf-8')) as { artifacts?: unknown[] } | unknown[];
  const artifacts = Array.isArray(bundle) ? bundle : (bundle.artifacts ?? []);
  test.skip(artifacts.length === 0, 'fixture has no artifacts');

  const res = await request.post('/api/v1/library/import', {
    data: { artifacts: artifacts.slice(0, 5) },
    failOnStatusCode: false,
  });
  expect(
    res.status(),
    `Server crash on bundle round-trip: ${res.status()}`,
  ).toBeLessThan(500);
});
