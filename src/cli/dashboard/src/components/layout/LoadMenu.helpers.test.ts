import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatExplicit,
  shouldShowCacheRow,
  cacheExpandedBody,
  buildReplayHref,
} from './LoadMenu.helpers.js';

test('formatExplicit renders MMM D · HH:mm in local TZ', () => {
  const ts = new Date(2026, 3, 18, 14, 32, 0).getTime();
  const out = formatExplicit(ts);
  assert.match(out, /^[A-Z][a-z]{2} \d{1,2} · \d{2}:\d{2}$/);
});

test('shouldShowCacheRow returns true for every status so the user gets a hint on error/unavailable', () => {
  assert.equal(shouldShowCacheRow('loading'), true);
  assert.equal(shouldShowCacheRow('ready'), true);
  assert.equal(shouldShowCacheRow('unavailable'), true);
  assert.equal(shouldShowCacheRow('error'), true);
});

test('cacheExpandedBody picks the right branch per state', () => {
  assert.equal(cacheExpandedBody('loading', []), 'loading');
  assert.equal(cacheExpandedBody('ready', []), 'empty');
  assert.equal(
    cacheExpandedBody('ready', [{ id: 'a', createdAt: 0, eventCount: 0 }]),
    'cards',
  );
});

test('buildReplayHref appends ?replay=<id> and preserves host', () => {
  const href = buildReplayHref('https://paracosm.example/sim?foo=1', 'abc');
  const url = new URL(href);
  assert.equal(url.searchParams.get('replay'), 'abc');
  assert.equal(url.searchParams.get('foo'), '1');
});
