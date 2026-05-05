import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import * as React from 'react';

import { ActorBar } from './ActorBar.js';

test('ActorBar compact: MORALE displays as 0-100%, not double-scaled', () => {
  // Regression for the live SIM bug where the compact actor bar showed
  // MORALE 3200% / 2600%. moraleHistory is pre-scaled to 0-100 in
  // useGameState (Math.round(metrics.morale * 100)), so the renderer
  // must NOT multiply by 100 again.
  const html = renderToString(
    <ActorBar
      actorIndex={0}
      leader={{ name: 'Aria Chen', archetype: 'The Visionary', unit: 'Colony Alpha', hexaco: { openness: 0.95, conscientiousness: 0.35, extraversion: 0.85, agreeableness: 0.55, emotionality: 0.3, honestyHumility: 0.65 } }}
      popHistory={[100, 99, 98]}
      moraleHistory={[85, 80, 32]} // Final reading: 32 (already scaled)
      compact
    />,
  );
  assert.match(html, /MORALE (?:<!-- -->)?32(?:<!-- -->)?%/, 'expected MORALE 32%, got double-scaled');
  assert.ok(!html.includes('3200%'), 'morale must not double-scale to 3200%');
  assert.match(html, /POP (?:<!-- -->)?98/, 'POP renders the latest value');
});

test('ActorBar compact: morale of 100 renders as 100%, not 10000%', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={1}
      leader={{ name: 'Voss', archetype: 'The Engineer', unit: 'Colony Beta', hexaco: { openness: 0, conscientiousness: 1, extraversion: 0, agreeableness: 0, emotionality: 0, honestyHumility: 0 } }}
      popHistory={[50]}
      moraleHistory={[100]}
      compact
    />,
  );
  assert.match(html, /MORALE (?:<!-- -->)?100(?:<!-- -->)?%/);
});

test('ActorBar compact: empty moraleHistory hides the morale stat (no NaN%)', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={0}
      leader={null}
      popHistory={[]}
      moraleHistory={[]}
      compact
    />,
  );
  assert.ok(!html.includes('MORALE'), 'no morale chip when history is empty');
  assert.ok(!html.includes('NaN'));
});

test('ActorBar compact: surfaces archetype chip when leader has one', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={0}
      leader={{ name: 'Aria Chen', archetype: 'The Visionary', unit: 'Alpha', hexaco: {} }}
      popHistory={[100]}
      moraleHistory={[60]}
      compact
    />,
  );
  // "The Visionary" -> "VISIONARY" (strips leading "The ")
  assert.ok(html.includes('VISIONARY'), 'archetype chip rendered without "The" prefix');
});

test('ActorBar compact: low morale derives a "low" mood label', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={0}
      leader={{ name: 'Aria', archetype: 'X', unit: 'A', hexaco: {} }}
      popHistory={[10]}
      moraleHistory={[18]}
      compact
    />,
  );
  assert.ok(html.includes('low'), 'mood label "low" present when morale < 25');
});

test('ActorBar compact: high morale derives a "rising" mood label', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={0}
      leader={{ name: 'Aria', archetype: 'X', unit: 'A', hexaco: {} }}
      popHistory={[100]}
      moraleHistory={[88]}
      compact
    />,
  );
  assert.ok(html.includes('rising'), 'mood label "rising" present when morale >= 75');
});

test('ActorBar compact: surfaces active crisis title (truncated)', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={0}
      leader={{ name: 'Aria', archetype: 'X', unit: 'A', hexaco: {} }}
      popHistory={[100]}
      moraleHistory={[60]}
      event={{ turn: 3, title: 'Dust storm rolling in from the polar cap', category: 'environmental', emergent: false }}
      compact
    />,
  );
  assert.ok(/Dust storm rolling in from/.test(html), 'crisis title appears in compact bar');
});

test('ActorBar compact: pendingDecision renders DECIDING pulse chip', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={1}
      leader={{ name: 'Voss', archetype: 'X', unit: 'B', hexaco: {} }}
      popHistory={[100]}
      moraleHistory={[60]}
      pendingDecision="ration_oxygen"
      compact
    />,
  );
  assert.ok(html.includes('DECIDING'), 'DECIDING chip renders during decision phase');
});

test('ActorBar non-compact: dynamic row hidden when no event/status/morale', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={0}
      leader={null}
      popHistory={[]}
      moraleHistory={[]}
    />,
  );
  assert.ok(!/MOOD/.test(html), 'no MOOD label when there is no morale data');
  assert.ok(!/DECIDING/.test(html), 'no DECIDING chip without pendingDecision');
});

test('ActorBar non-compact: status chips render up to 2 entries', () => {
  const html = renderToString(
    <ActorBar
      actorIndex={0}
      leader={{ name: 'Aria', archetype: 'X', unit: 'A', hexaco: {} }}
      popHistory={[100]}
      moraleHistory={[60]}
      statuses={{
        morale_state: 'stable',
        oxygen_pressure: 'rationed',
        third_status: 'should_be_skipped',
        empty_status: '',
        false_status: false,
      }}
    />,
  );
  assert.ok(html.includes('MORALE_STATE') && html.includes('stable'), 'first status renders');
  assert.ok(html.includes('OXYGEN_PRESSURE') && html.includes('rationed'), 'second status renders');
  assert.ok(!html.includes('THIRD_STATUS'), 'third status truncated to top-2 limit');
  assert.ok(!html.includes('EMPTY_STATUS'), 'empty-string status skipped');
  assert.ok(!html.includes('FALSE_STATUS'), 'false-valued status skipped');
});
