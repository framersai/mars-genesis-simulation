# Reports Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the top of the paracosm Reports tab so a user can understand a run in under a minute: hero scoreboard, horizontal run strip, six metric sparklines, divergent-turn visual weight, and a sticky side-nav. All existing features preserved.

**Architecture:** Five new client-only components under `src/cli/dashboard/src/components/reports/`, one shared helper module with pure-logic tests, and a rewiring of `ReportView.tsx` to compose them. No SSE, no server, no data-model changes.

**Tech Stack:** TypeScript, React 18, inline SVG (reuses the pattern from the existing `CommanderTrajectoryCard`), `node:test` for the helper unit tests, Vite for build.

**Spec:** [docs/superpowers/specs/2026-04-19-reports-revamp-design.md](../specs/2026-04-19-reports-revamp-design.md)

---

## File structure

**Created (all in `src/cli/dashboard/src/components/reports/`):**

- `reports-shared.ts`: `outcomeColor`, `classifyTurn`, `collectMetricSeries`, `collectRunStripData` helpers + types.
- `reports-shared.test.ts`: node:test coverage for all four helpers.
- `HeroScoreboard.tsx`: winner band + scoreboard + "view full verdict" anchor.
- `RunStrip.tsx`: horizontal turn timeline with per-side outcome badges.
- `MetricSparklines.tsx`: six SVG sparklines overlaying A vs B.
- `ReportSideNav.tsx`: right rail on desktop, horizontal sticky strip on narrower widths. IntersectionObserver drives the active highlight.

**Modified:**

- `ReportView.tsx`: imports the new components, replaces the meta-pill opening with the hero, adds run-strip + sparklines between hero and the existing VerdictPanel position, adds `id=` anchors on each section, gives divergent turns the rust left-border + tinted background, demotes the meta-pill section to a collapsible footer block.

---

### Task 1: Shared helpers + tests

**Files:**
- Create: `apps/paracosm/src/cli/dashboard/src/components/reports/reports-shared.ts`
- Create: `apps/paracosm/src/cli/dashboard/src/components/reports/reports-shared.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/paracosm/src/cli/dashboard/src/components/reports/reports-shared.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  outcomeColor,
  classifyTurn,
  collectMetricSeries,
  collectRunStripData,
} from './reports-shared.js';
import type { GameState } from '../../hooks/useGameState';

test('outcomeColor maps known outcome keys to the right CSS variable', () => {
  assert.equal(outcomeColor('conservative_success'), 'var(--green)');
  assert.equal(outcomeColor('risky_success'), 'var(--amber)');
  assert.equal(outcomeColor('conservative_failure'), 'var(--rust-dim, var(--rust))');
  assert.equal(outcomeColor('risky_failure'), 'var(--rust)');
  assert.equal(outcomeColor(undefined), 'var(--text-3)');
  assert.equal(outcomeColor('mystery'), 'var(--text-3)');
});

test('classifyTurn returns shared when both titles match, divergent otherwise', () => {
  assert.equal(classifyTurn('Landfall', 'Landfall'), 'shared');
  assert.equal(classifyTurn('Water crisis', 'Solar storm'), 'divergent');
  assert.equal(classifyTurn(undefined, 'Landfall'), 'divergent');
  assert.equal(classifyTurn('Landfall', undefined), 'divergent');
  assert.equal(classifyTurn(undefined, undefined), 'divergent');
});

test('collectMetricSeries extracts six metrics per side from turn_done events', () => {
  const state = {
    a: {
      events: [
        { id: '1', type: 'turn_done', turn: 1, data: { colony: { population: 30, morale: 0.8, foodMonthsReserve: 100, powerKw: 500, infrastructureModules: 5, scienceOutput: 10 } } },
        { id: '2', type: 'turn_done', turn: 2, data: { colony: { population: 28, morale: 0.7, foodMonthsReserve: 95, powerKw: 480, infrastructureModules: 6, scienceOutput: 15 } } },
      ],
    },
    b: {
      events: [
        { id: '3', type: 'turn_done', turn: 1, data: { colony: { population: 29, morale: 0.75, foodMonthsReserve: 90, powerKw: 450, infrastructureModules: 5, scienceOutput: 12 } } },
      ],
    },
  } as unknown as GameState;

  const metrics = collectMetricSeries(state);
  assert.equal(metrics.length, 6);
  const pop = metrics.find(m => m.id === 'population');
  assert.ok(pop);
  assert.deepEqual(pop!.a, [{ turn: 1, value: 30 }, { turn: 2, value: 28 }]);
  assert.deepEqual(pop!.b, [{ turn: 1, value: 29 }]);
  const morale = metrics.find(m => m.id === 'morale');
  assert.ok(morale);
  assert.deepEqual(morale!.a, [{ turn: 1, value: 0.8 }, { turn: 2, value: 0.7 }]);
});

test('collectMetricSeries drops events without a colony payload', () => {
  const state = {
    a: {
      events: [
        { id: '1', type: 'turn_start', turn: 1, data: {} },
        { id: '2', type: 'turn_done', turn: 1, data: { colony: { population: 30, morale: 0.8, foodMonthsReserve: 100, powerKw: 500, infrastructureModules: 5, scienceOutput: 10 } } },
        { id: '3', type: 'agent_reactions', turn: 1, data: {} },
      ],
    },
    b: { events: [] },
  } as unknown as GameState;

  const metrics = collectMetricSeries(state);
  const pop = metrics.find(m => m.id === 'population');
  assert.deepEqual(pop!.a, [{ turn: 1, value: 30 }]);
});

test('collectRunStripData builds a cell per turn with per-side outcome + diverged flag', () => {
  const turns: Array<[number, {
    a: { year?: number; events: Map<number, { title?: string; outcome?: string; category?: string }> };
    b: { year?: number; events: Map<number, { title?: string; outcome?: string; category?: string }> };
  }]> = [
    [1, {
      a: { year: 2035, events: new Map([[0, { title: 'Landfall', outcome: 'risky_success', category: 'infrastructure' }]]) },
      b: { year: 2035, events: new Map([[0, { title: 'Landfall', outcome: 'conservative_success', category: 'infrastructure' }]]) },
    }],
    [2, {
      a: { year: 2043, events: new Map([[0, { title: 'Perchlorate', outcome: 'conservative_failure', category: 'resource' }]]) },
      b: { year: 2043, events: new Map([[0, { title: 'Solar storm', outcome: 'conservative_failure', category: 'environmental' }]]) },
    }],
  ];

  const cells = collectRunStripData(turns);
  assert.equal(cells.length, 2);
  assert.equal(cells[0].turn, 1);
  assert.equal(cells[0].year, 2035);
  assert.equal(cells[0].diverged, false);
  assert.equal(cells[0].a.outcome, 'risky_success');
  assert.equal(cells[0].b.outcome, 'conservative_success');
  assert.equal(cells[1].diverged, true);
  assert.equal(cells[1].a.title, 'Perchlorate');
  assert.equal(cells[1].b.title, 'Solar storm');
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd apps/paracosm && node --import tsx --test src/cli/dashboard/src/components/reports/reports-shared.test.ts`

Expected: FAIL. Cannot resolve `./reports-shared.js`.

- [ ] **Step 3: Implement the helpers**

Create `apps/paracosm/src/cli/dashboard/src/components/reports/reports-shared.ts`:

```ts
/**
 * Pure helpers used by the Reports tab components. Kept React-free and
 * DOM-free so they can be exercised under node:test without a browser.
 *
 * @module paracosm/dashboard/reports/shared
 */
import type { GameState } from '../../hooks/useGameState';

export type OutcomeKey =
  | 'conservative_success'
  | 'conservative_failure'
  | 'risky_success'
  | 'risky_failure';

/** Four known outcome keys map to matching Badge colors; unknown falls back. */
export function outcomeColor(outcome: string | undefined): string {
  switch (outcome) {
    case 'conservative_success': return 'var(--green)';
    case 'risky_success':        return 'var(--amber)';
    case 'conservative_failure': return 'var(--rust-dim, var(--rust))';
    case 'risky_failure':        return 'var(--rust)';
    default:                     return 'var(--text-3)';
  }
}

/** Shared when both sides ran the same first event title, divergent otherwise. */
export function classifyTurn(
  aFirstTitle: string | undefined,
  bFirstTitle: string | undefined,
): 'shared' | 'divergent' {
  if (!aFirstTitle || !bFirstTitle) return 'divergent';
  return aFirstTitle === bFirstTitle ? 'shared' : 'divergent';
}

/** Series shape consumed by MetricSparklines. */
export interface MetricSeries {
  id: 'population' | 'morale' | 'foodMonthsReserve' | 'powerKw' | 'infrastructureModules' | 'scienceOutput';
  label: string;
  unit?: string;
  a: Array<{ turn: number; value: number }>;
  b: Array<{ turn: number; value: number }>;
}

const METRIC_DEFS: Array<{ id: MetricSeries['id']; label: string; unit?: string }> = [
  { id: 'population',             label: 'Population' },
  { id: 'morale',                 label: 'Morale' },
  { id: 'foodMonthsReserve',      label: 'Food',    unit: 'mo' },
  { id: 'powerKw',                label: 'Power',   unit: 'kW' },
  { id: 'infrastructureModules',  label: 'Modules' },
  { id: 'scienceOutput',          label: 'Science' },
];

/** Walk events for one side, pulling (turn, value) pairs for one metric. */
function seriesForSide(
  events: Array<{ turn?: number; data: Record<string, unknown> }>,
  metricId: MetricSeries['id'],
): Array<{ turn: number; value: number }> {
  const out: Array<{ turn: number; value: number }> = [];
  const seenTurn = new Set<number>();
  for (const ev of events) {
    const colony = ev.data?.colony as Record<string, number> | undefined;
    if (!colony || typeof ev.turn !== 'number') continue;
    const value = colony[metricId];
    if (typeof value !== 'number') continue;
    if (seenTurn.has(ev.turn)) {
      // Latest snapshot for the turn wins (turn_done overwrites turn_start).
      const idx = out.findIndex(p => p.turn === ev.turn);
      if (idx >= 0) out[idx] = { turn: ev.turn, value };
      continue;
    }
    seenTurn.add(ev.turn);
    out.push({ turn: ev.turn, value });
  }
  return out;
}

/** Build the six-metric series for both sides from the game state. */
export function collectMetricSeries(state: GameState): MetricSeries[] {
  const aEvents = state.a.events as Array<{ turn?: number; data: Record<string, unknown> }>;
  const bEvents = state.b.events as Array<{ turn?: number; data: Record<string, unknown> }>;
  return METRIC_DEFS.map(def => ({
    id: def.id,
    label: def.label,
    unit: def.unit,
    a: seriesForSide(aEvents, def.id),
    b: seriesForSide(bEvents, def.id),
  }));
}

export interface RunStripCell {
  turn: number;
  year?: number;
  diverged: boolean;
  a: { title?: string; outcome?: string; category?: string };
  b: { title?: string; outcome?: string; category?: string };
}

/** Build a cell per turn from the existing `turns` map ReportView already derives. */
export function collectRunStripData(
  turns: Array<[number, {
    a: { year?: number; events: Map<number, { title?: string; outcome?: string; category?: string }> };
    b: { year?: number; events: Map<number, { title?: string; outcome?: string; category?: string }> };
  }]>,
): RunStripCell[] {
  return turns.map(([turnNum, sides]) => {
    const aFirst = sides.a.events.get(0);
    const bFirst = sides.b.events.get(0);
    return {
      turn: turnNum,
      year: sides.a.year ?? sides.b.year,
      diverged: classifyTurn(aFirst?.title, bFirst?.title) === 'divergent',
      a: { title: aFirst?.title, outcome: aFirst?.outcome, category: aFirst?.category },
      b: { title: bFirst?.title, outcome: bFirst?.outcome, category: bFirst?.category },
    };
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd apps/paracosm && node --import tsx --test src/cli/dashboard/src/components/reports/reports-shared.test.ts`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd apps/paracosm
git add src/cli/dashboard/src/components/reports/reports-shared.ts src/cli/dashboard/src/components/reports/reports-shared.test.ts
git commit -m "feat(reports): shared helpers + tests for outcome color, turn classify, metric + strip series"
```

---

### Task 2: HeroScoreboard component

**Files:**
- Create: `apps/paracosm/src/cli/dashboard/src/components/reports/HeroScoreboard.tsx`

- [ ] **Step 1: Write the component**

Create `apps/paracosm/src/cli/dashboard/src/components/reports/HeroScoreboard.tsx`:

```tsx
/**
 * Top-of-report scoreboard. Shows winner + one-sentence divergence +
 * seven-stat A-vs-B comparison bars. Sources from verdict.finalStats
 * so the numbers match the existing VerdictPanel exactly.
 *
 * When verdict is absent (sim still in progress) the stats block hides
 * and a one-line "simulation in progress" message takes its place. The
 * hero itself stays so the first fold is still a real summary.
 *
 * @module paracosm/dashboard/reports/HeroScoreboard
 */

export interface HeroScoreboardProps {
  /** Raw verdict payload emitted by the orchestrator. Shape mirrors
   *  VerdictData in ../sim/VerdictCard.tsx. */
  verdict: Record<string, unknown> | null | undefined;
  leaderAName: string;
  leaderBName: string;
  /** Default scrolls #verdict into view. Override for tests / custom nav. */
  onViewFullVerdict?: () => void;
}

interface FinalStats {
  population: number;
  morale: number;
  food: number;
  power: number;
  modules: number;
  science: number;
  tools: number;
}

interface StatRowDef {
  key: keyof FinalStats;
  label: string;
  format: 'int' | 'percent' | 'decimal';
}

const STAT_ROWS: StatRowDef[] = [
  { key: 'population', label: 'Population', format: 'int' },
  { key: 'morale',     label: 'Morale',     format: 'percent' },
  { key: 'food',       label: 'Food (mo)',  format: 'decimal' },
  { key: 'power',      label: 'Power (kW)', format: 'decimal' },
  { key: 'modules',    label: 'Modules',    format: 'decimal' },
  { key: 'science',    label: 'Science',    format: 'int' },
  { key: 'tools',      label: 'Tools Forged', format: 'int' },
];

function fmt(value: number, format: StatRowDef['format']): string {
  if (format === 'percent') return `${Math.round(value * 100)}%`;
  if (format === 'decimal') return value.toFixed(1);
  return String(Math.round(value));
}

function StatBar({ a, b, winner }: { a: number; b: number; winner: 'a' | 'b' | 'tie' }) {
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  const aPct = Math.max(0, (a / max) * 100);
  const bPct = Math.max(0, (b / max) * 100);
  const aFill = winner === 'a' ? 'var(--vis)' : 'var(--border-hl)';
  const bFill = winner === 'b' ? 'var(--eng)' : 'var(--border-hl)';
  return (
    <div style={{ display: 'flex', gap: 2, height: 6 }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: `${aPct}%`, height: '100%', background: aFill, borderRadius: '3px 0 0 3px' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ width: `${bPct}%`, height: '100%', background: bFill, borderRadius: '0 3px 3px 0' }} />
      </div>
    </div>
  );
}

export function HeroScoreboard(props: HeroScoreboardProps) {
  const v = props.verdict as {
    winnerName?: string;
    winner?: 'A' | 'B' | 'tie';
    headline?: string;
    summary?: string;
    keyDivergence?: string;
    finalStats?: { a?: Partial<FinalStats>; b?: Partial<FinalStats> };
  } | null | undefined;
  const winnerName = v?.winnerName || '';
  const headline = v?.headline || v?.summary || '';
  const keyDivergence = v?.keyDivergence || '';
  const finalA = v?.finalStats?.a;
  const finalB = v?.finalStats?.b;

  const scroll = props.onViewFullVerdict ?? (() => {
    if (typeof document !== 'undefined') {
      document.getElementById('verdict')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  return (
    <section
      aria-label="Run summary"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 16,
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div style={{
        padding: '12px 18px',
        background: 'linear-gradient(90deg, rgba(232,180,74,0.18), rgba(232,180,74,0.04))',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber)', fontFamily: 'var(--mono)' }}>
          Run Summary
        </div>
        {winnerName && (
          <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>
            {winnerName} wins
          </div>
        )}
        {headline && (
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {headline}
          </div>
        )}
        {keyDivergence && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.5 }}>
            {keyDivergence}
          </div>
        )}
      </div>

      {finalA && finalB ? (
        <div style={{ padding: '14px 18px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 10,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: 'var(--text-3)', fontFamily: 'var(--mono)',
          }}>
            <span style={{ color: 'var(--vis)' }}>{props.leaderAName}</span>
            <span>Final stats</span>
            <span style={{ color: 'var(--eng)' }}>{props.leaderBName}</span>
          </div>
          {STAT_ROWS.map(row => {
            const a = Number(finalA[row.key] ?? 0);
            const b = Number(finalB[row.key] ?? 0);
            const winner: 'a' | 'b' | 'tie' = a > b ? 'a' : b > a ? 'b' : 'tie';
            return (
              <div key={row.key} style={{ marginBottom: 8 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  fontSize: 11, fontFamily: 'var(--mono)', marginBottom: 2,
                }}>
                  <span style={{ color: winner === 'a' ? 'var(--vis)' : 'var(--text-2)', fontWeight: winner === 'a' ? 700 : 500 }}>
                    {fmt(a, row.format)}
                  </span>
                  <span style={{ color: 'var(--text-3)' }}>{row.label}</span>
                  <span style={{ color: winner === 'b' ? 'var(--eng)' : 'var(--text-2)', fontWeight: winner === 'b' ? 700 : 500 }}>
                    {fmt(b, row.format)}
                  </span>
                </div>
                <StatBar a={a} b={b} winner={winner} />
              </div>
            );
          })}
          <div style={{ textAlign: 'right', marginTop: 10 }}>
            <button
              type="button"
              onClick={scroll}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                color: 'var(--amber)', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}
            >
              View full verdict ›
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '14px 18px', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          Simulation in progress. Scoreboard will populate when the verdict arrives.
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/paracosm/src/cli/dashboard && npx vite build`

Expected: clean build, no errors in HeroScoreboard.tsx. Pre-existing errors in unrelated files (TopBar, SimView, DrilldownPanel, viz-layout.test) may still show; ignore those.

- [ ] **Step 3: Commit**

```bash
cd apps/paracosm
git add src/cli/dashboard/src/components/reports/HeroScoreboard.tsx
git commit -m "feat(reports): HeroScoreboard top-of-page summary"
```

---

### Task 3: RunStrip component

**Files:**
- Create: `apps/paracosm/src/cli/dashboard/src/components/reports/RunStrip.tsx`

- [ ] **Step 1: Write the component**

Create `apps/paracosm/src/cli/dashboard/src/components/reports/RunStrip.tsx`:

```tsx
/**
 * Horizontal 1-row timeline. One cell per turn with per-side outcome
 * badges stacked. Clicking a cell scrolls #turn-<n> into view.
 *
 * @module paracosm/dashboard/reports/RunStrip
 */
import type { RunStripCell } from './reports-shared';
import { outcomeColor } from './reports-shared';

export interface RunStripProps {
  turns: RunStripCell[];
  leaderAName: string;
  leaderBName: string;
  onJumpToTurn?: (turn: number) => void;
}

const OUTCOME_LABEL: Record<string, string> = {
  conservative_success: 'SAFE WIN',
  risky_success:        'RISKY WIN',
  conservative_failure: 'SAFE LOSS',
  risky_failure:        'RISKY LOSS',
};

function outcomeShort(outcome: string | undefined): string {
  if (!outcome) return '·';
  return OUTCOME_LABEL[outcome] ?? outcome.replace(/_/g, ' ').toUpperCase();
}

function Badge({ outcome, sideColor }: { outcome: string | undefined; sideColor: string }) {
  const color = outcomeColor(outcome);
  return (
    <div style={{
      fontSize: 9, fontWeight: 800, fontFamily: 'var(--mono)',
      color, letterSpacing: '0.04em', lineHeight: 1.2,
      padding: '2px 4px',
      borderLeft: `2px solid ${sideColor}`,
      whiteSpace: 'nowrap',
    }}>
      {outcomeShort(outcome)}
    </div>
  );
}

export function RunStrip(props: RunStripProps) {
  const { turns, leaderAName, leaderBName, onJumpToTurn } = props;
  if (turns.length === 0) return null;

  const handleClick = (turn: number) => {
    if (onJumpToTurn) { onJumpToTurn(turn); return; }
    if (typeof document !== 'undefined') {
      document.getElementById(`turn-${turn}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      aria-label="Run timeline strip"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 16,
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--amber)', fontFamily: 'var(--mono)', marginBottom: 8,
      }}>
        Run Strip
      </div>
      <div
        role="list"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${turns.length}, minmax(0, 1fr))`,
          gap: 6,
        }}
      >
        {turns.map(cell => (
          <button
            key={cell.turn}
            type="button"
            role="listitem"
            onClick={() => handleClick(cell.turn)}
            aria-label={`Jump to turn ${cell.turn}${cell.year ? ', year ' + cell.year : ''}${cell.diverged ? ', divergent' : ''}`}
            style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '6px 8px',
              background: cell.diverged ? 'color-mix(in srgb, var(--bg-canvas) 88%, var(--rust) 12%)' : 'var(--bg-canvas)',
              border: `1px solid ${cell.diverged ? 'var(--rust-dim, var(--rust))' : 'var(--border)'}`,
              borderRadius: 4, cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--mono)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)' }}>
              <span style={{ fontWeight: 700 }}>T{cell.turn}</span>
              {cell.year && <span>Y{cell.year}</span>}
            </div>
            <Badge outcome={cell.a.outcome} sideColor="var(--vis)" />
            <Badge outcome={cell.b.outcome} sideColor="var(--eng)" />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
        <span>{leaderAName}</span>
        <span>{leaderBName}</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/paracosm/src/cli/dashboard && npx vite build`

Expected: clean build, no new errors.

- [ ] **Step 3: Commit**

```bash
cd apps/paracosm
git add src/cli/dashboard/src/components/reports/RunStrip.tsx
git commit -m "feat(reports): RunStrip horizontal timeline with outcome badges"
```

---

### Task 4: MetricSparklines component

**Files:**
- Create: `apps/paracosm/src/cli/dashboard/src/components/reports/MetricSparklines.tsx`

- [ ] **Step 1: Write the component**

Create `apps/paracosm/src/cli/dashboard/src/components/reports/MetricSparklines.tsx`:

```tsx
/**
 * Six compact SVG sparklines, one per ColonyState metric, overlaying
 * A and B so the user sees where the curves cross across the run.
 * No chart library; same inline-SVG pattern as CommanderTrajectoryCard.
 *
 * @module paracosm/dashboard/reports/MetricSparklines
 */
import type { MetricSeries } from './reports-shared';

export interface MetricSparklinesProps {
  metrics: MetricSeries[];
  leaderAName: string;
  leaderBName: string;
  sideAColor?: string;
  sideBColor?: string;
}

function formatValue(v: number, unit?: string): string {
  if (unit === 'mo' || unit === 'kW') return `${v.toFixed(1)}${unit ? ' ' + unit : ''}`;
  if (v > 0 && v < 1) return `${Math.round(v * 100)}%`;
  return `${Math.round(v)}${unit ? ' ' + unit : ''}`;
}

interface CardProps {
  metric: MetricSeries;
  sideAColor: string;
  sideBColor: string;
}

function SparkCard({ metric, sideAColor, sideBColor }: CardProps) {
  const W = 200;
  const H = 50;
  const padX = 4;
  const padY = 6;

  const all = [...metric.a, ...metric.b];
  if (all.length === 0) return null;

  const minTurn = Math.min(...all.map(p => p.turn));
  const maxTurn = Math.max(...all.map(p => p.turn));
  const minVal = Math.min(...all.map(p => p.value));
  const maxVal = Math.max(...all.map(p => p.value));
  const valRange = Math.max(1e-6, maxVal - minVal);
  const turnRange = Math.max(1, maxTurn - minTurn);

  const xFor = (turn: number) => padX + (W - padX * 2) * ((turn - minTurn) / turnRange);
  const yFor = (value: number) => padY + (H - padY * 2) * (1 - (value - minVal) / valRange);

  const aPoints = metric.a.map(p => `${xFor(p.turn)},${yFor(p.value)}`).join(' ');
  const bPoints = metric.b.map(p => `${xFor(p.turn)},${yFor(p.value)}`).join(' ');

  const aLast = metric.a[metric.a.length - 1]?.value;
  const bLast = metric.b[metric.b.length - 1]?.value;

  return (
    <div
      aria-label={`${metric.label} sparkline`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '8px 10px',
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'var(--text-2)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{metric.label}</span>
        <span style={{ color: 'var(--text-3)' }}>T{minTurn} → T{maxTurn}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img">
        <line x1={padX} y1={H / 2} x2={W - padX} y2={H / 2} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,3" />
        {aPoints && (
          <polyline points={aPoints} fill="none" stroke={sideAColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
        )}
        {bPoints && (
          <polyline points={bPoints} fill="none" stroke={sideBColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10 }}>
        <span style={{ color: sideAColor, fontWeight: 700 }}>
          {aLast != null ? formatValue(aLast, metric.unit) : '·'}
        </span>
        <span style={{ color: sideBColor, fontWeight: 700 }}>
          {bLast != null ? formatValue(bLast, metric.unit) : '·'}
        </span>
      </div>
    </div>
  );
}

export function MetricSparklines(props: MetricSparklinesProps) {
  const { metrics, leaderAName, leaderBName } = props;
  const sideAColor = props.sideAColor ?? 'var(--vis)';
  const sideBColor = props.sideBColor ?? 'var(--eng)';
  const populated = metrics.filter(m => m.a.length > 0 || m.b.length > 0);
  if (populated.length === 0) return null;

  return (
    <section
      aria-label="Metric sparklines"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 16,
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--amber)', fontFamily: 'var(--mono)',
        }}>
          Metric Trajectories
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
          <span style={{ color: sideAColor, fontWeight: 700 }}>{leaderAName}</span>
          {' · '}
          <span style={{ color: sideBColor, fontWeight: 700 }}>{leaderBName}</span>
        </span>
      </div>
      <div
        className="responsive-grid-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        {populated.map(m => (
          <SparkCard key={m.id} metric={m} sideAColor={sideAColor} sideBColor={sideBColor} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/paracosm/src/cli/dashboard && npx vite build`

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd apps/paracosm
git add src/cli/dashboard/src/components/reports/MetricSparklines.tsx
git commit -m "feat(reports): MetricSparklines six-metric trajectory grid"
```

---

### Task 5: ReportSideNav component

**Files:**
- Create: `apps/paracosm/src/cli/dashboard/src/components/reports/ReportSideNav.tsx`

- [ ] **Step 1: Write the component**

Create `apps/paracosm/src/cli/dashboard/src/components/reports/ReportSideNav.tsx`:

```tsx
/**
 * Right-rail sticky nav for the Reports tab. Collapses to a horizontal
 * sticky strip on widths below 1024px. IntersectionObserver drives the
 * active-item highlight based on which `<section id="...">` is most
 * visible in the scroll viewport.
 *
 * @module paracosm/dashboard/reports/ReportSideNav
 */
import { useEffect, useMemo, useState } from 'react';

export interface SideNavItem {
  id: string;
  label: string;
}

export interface ReportSideNavProps {
  items: SideNavItem[];
  /** Scroll container element whose scroll position drives the active id.
   *  When undefined, falls back to the window viewport. */
  scrollRoot?: HTMLElement | null;
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

export function ReportSideNav(props: ReportSideNavProps) {
  const { items, scrollRoot } = props;
  const [activeId, setActiveId] = useState<string | undefined>(items[0]?.id);
  const desktop = useIsDesktop();

  useEffect(() => {
    if (typeof window === 'undefined' || items.length === 0) return;
    const elements = items
      .map(i => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el != null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { root: scrollRoot ?? null, rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [items, scrollRoot]);

  const linkStyle = useMemo((): React.CSSProperties => ({
    display: 'block', padding: '4px 10px', fontSize: 11, fontFamily: 'var(--mono)',
    fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: 'var(--text-3)', textDecoration: 'none', borderRadius: 3,
  }), []);

  if (items.length === 0) return null;

  if (desktop) {
    return (
      <nav
        aria-label="Report sections"
        style={{
          position: 'sticky',
          top: 12,
          alignSelf: 'flex-start',
          width: 160,
          marginLeft: 12,
          padding: '10px 6px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
        }}
      >
        {items.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            style={{
              ...linkStyle,
              color: activeId === item.id ? 'var(--amber)' : 'var(--text-3)',
              background: activeId === item.id ? 'color-mix(in srgb, var(--bg-canvas) 80%, var(--amber) 20%)' : 'transparent',
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Report sections"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        padding: '6px 8px',
        marginBottom: 12,
        overflowX: 'auto',
        display: 'flex',
        gap: 4,
      }}
    >
      {items.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          style={{
            ...linkStyle,
            flexShrink: 0,
            color: activeId === item.id ? 'var(--amber)' : 'var(--text-3)',
            borderBottom: activeId === item.id ? '2px solid var(--amber)' : '2px solid transparent',
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/paracosm/src/cli/dashboard && npx vite build`

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd apps/paracosm
git add src/cli/dashboard/src/components/reports/ReportSideNav.tsx
git commit -m "feat(reports): ReportSideNav sticky jump-nav with IntersectionObserver active highlight"
```

---

### Task 6: Rewire ReportView

**Files:**
- Modify: `apps/paracosm/src/cli/dashboard/src/components/reports/ReportView.tsx`

This task rewires the top of the render tree, adds the five new pieces, gives divergent turns visual weight, and demotes the meta-pill section. The existing per-turn body, toolbox, references, verdict panel, and trajectory cards stay unchanged in position.

- [ ] **Step 1: Add imports at the top of ReportView.tsx**

Find the existing import block at [ReportView.tsx:1-17](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L1-L17). Add below the existing imports:

```ts
import { HeroScoreboard } from './HeroScoreboard';
import { RunStrip } from './RunStrip';
import { MetricSparklines } from './MetricSparklines';
import { ReportSideNav, type SideNavItem } from './ReportSideNav';
import { collectMetricSeries, collectRunStripData } from './reports-shared';
```

- [ ] **Step 2: Compute the hero + strip + sparkline data inside the component**

Find the block right after `const reportPlan = useMemo(...)` ends around [ReportView.tsx:197-207](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L197-L207). Add three memoized derivations directly below:

```ts
  const stripCells = useMemo(() => collectRunStripData(turns), [turns]);
  const metricSeries = useMemo(() => collectMetricSeries(state), [state]);
  const sideNavItems = useMemo<SideNavItem[]>(() => {
    const items: SideNavItem[] = [
      { id: 'hero', label: 'Summary' },
    ];
    if (verdict) items.push({ id: 'verdict', label: 'Verdict' });
    if (stripCells.length > 0) items.push({ id: 'strip', label: 'Strip' });
    if (metricSeries.some(m => m.a.length > 0 || m.b.length > 0)) items.push({ id: 'sparklines', label: 'Metrics' });
    if (hasTrajectories) items.push({ id: 'trajectory', label: 'Trajectory' });
    for (const [turnNum] of turns) items.push({ id: `turn-${turnNum}`, label: `Turn ${turnNum}` });
    if (toolRegistry.list.length > 0) items.push({ id: 'toolbox', label: 'Toolbox' });
    if (citationRegistry.list.length > 0) items.push({ id: 'references', label: 'References' });
    return items;
  }, [verdict, stripCells.length, metricSeries, hasTrajectories, turns, toolRegistry.list.length, citationRegistry.list.length]);
```

- [ ] **Step 3: Replace the meta-pill opening section with the hero**

Find the existing block at [ReportView.tsx:245-332](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L245-L332) that renders `<section>` containing "Scenario Focus" and "This Run Produced" cards. Replace the ENTIRE block with:

```tsx
      <section id="hero">
        <HeroScoreboard
          verdict={verdict}
          leaderAName={nameA}
          leaderBName={nameB}
        />
      </section>

      <section id="strip">
        <RunStrip turns={stripCells} leaderAName={nameA} leaderBName={nameB} />
      </section>

      <section id="sparklines">
        <MetricSparklines metrics={metricSeries} leaderAName={nameA} leaderBName={nameB} />
      </section>
```

- [ ] **Step 4: Anchor the inline verdict block**

Find the `{verdict && <VerdictPanel verdict={verdict} />}` line around [ReportView.tsx:334](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L334). Wrap it:

```tsx
      <section id="verdict">
        {verdict && <VerdictPanel verdict={verdict} />}
      </section>
```

- [ ] **Step 5: Anchor the trajectory cards**

Find the `{hasTrajectories && (...)}` block at [ReportView.tsx:340-353](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L340-L353). Replace with:

```tsx
      <section id="trajectory">
        {hasTrajectories && (
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <CommanderTrajectoryCard
              events={state.a.events}
              leaderName={nameA}
              baselineHexaco={state.a.leader?.hexaco}
            />
            <CommanderTrajectoryCard
              events={state.b.events}
              leaderName={nameB}
              baselineHexaco={state.b.leader?.hexaco}
            />
          </div>
        )}
      </section>
```

- [ ] **Step 6: Anchor each per-turn block + give divergent turns visual weight**

Find the per-turn map at [ReportView.tsx:402-456](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L402-L456). Modify the outer `<div key={turnNum}>` to be a section with an id, and change its style to reflect divergence. Replace the outer element:

From:

```tsx
          <div key={turnNum} style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px',
            padding: '16px 20px', marginBottom: '14px', boxShadow: 'var(--card-shadow)',
          }}>
```

To:

```tsx
          <section key={turnNum} id={`turn-${turnNum}`} style={{
            background: diverged
              ? 'color-mix(in srgb, var(--bg-panel) 90%, var(--rust) 10%)'
              : 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderLeft: diverged ? '3px solid var(--rust)' : '1px solid var(--border)',
            borderRadius: '8px',
            padding: '16px 20px', marginBottom: '14px', boxShadow: 'var(--card-shadow)',
          }}>
```

And change the closing `</div>` of that block (the one right after `</div>` closing the "Per-turn shared sections" grid around line 454) to `</section>`.

- [ ] **Step 7: Anchor the toolbox + references blocks**

Find the `{toolRegistry.list.length > 0 && (<ToolboxSection ... />)}` block around [ReportView.tsx:462-470](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L462-L470) and the references block at [ReportView.tsx:471-479](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L471-L479). Wrap each:

```tsx
      <section id="toolbox">
        {toolRegistry.list.length > 0 && (
          <ToolboxSection
            registry={toolRegistry}
            title="Forged Toolbox"
            collapsible
            defaultOpen={toolsOpen}
            onToggle={setToolsOpen}
          />
        )}
      </section>

      <section id="references">
        {citationRegistry.list.length > 0 && (
          <ReferencesSection
            registry={citationRegistry}
            title="References"
            collapsible
            defaultOpen={refsOpen}
            onToggle={setRefsOpen}
          />
        )}
      </section>
```

- [ ] **Step 8: Demote the meta-pill section to a collapsible footer**

At the very bottom of the scrollable content, just before the closing `</div>` of the `.reports-content` wrapper, add a `<details>` block that re-renders the scenario focus + "this run produced" pills:

```tsx
      <details style={{
        marginTop: 16, padding: '10px 14px',
        background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8,
        fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)',
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
          What's in this report?
        </summary>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--amber)', marginBottom: 4 }}>Scenario focus</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {reportPlan.focusSections.map(section => (
                <span key={section} style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  border: '1px solid var(--border)', background: 'var(--bg-elevated, var(--bg-card))',
                  color: 'var(--amber)',
                }}>
                  {REPORT_FOCUS_LABELS[section]}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--amber)', marginBottom: 4 }}>This run produced</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {reportPlan.artifacts.map(artifact => (
                <span key={artifact} style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-2)',
                }}>
                  {REPORT_ARTIFACT_LABELS[artifact]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </details>
```

- [ ] **Step 9: Wrap the scrollable content with the side-nav**

Currently the returned tree is the single `<div ref={scrollRef} onScroll={onScroll} className="reports-content">`. Wrap it in a flex container that also mounts `ReportSideNav`. Replace the opening `<div ref={scrollRef} ...>` line and its matching closing `</div>` at [ReportView.tsx:239-481](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L239-L481):

Open:

```tsx
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div ref={scrollRef} onScroll={onScroll} className="reports-content" role="region" aria-label="Turn-by-turn report" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', background: 'var(--bg-deep)' }}>
```

Close (the final `</div>` of the scrollable wrapper becomes two closes with the side-nav in between):

```tsx
      </div>
      <ReportSideNav items={sideNavItems} scrollRoot={scrollRef.current} />
    </div>
```

- [ ] **Step 10: Build the dashboard**

Run: `cd apps/paracosm/src/cli/dashboard && npx vite build`

Expected: clean build. Any new errors from the wiring must be fixed before committing. Pre-existing errors in other files (TopBar, SimView, DrilldownPanel, viz-layout.test) may still show; those are out of scope.

- [ ] **Step 11: Run the existing dashboard tests**

Run: `cd apps/paracosm && node --import tsx --test 'src/cli/dashboard/src/**/*.test.ts'`

Expected: all pre-existing dashboard tests still pass (47+), plus the 5 new tests from Task 1. Zero failures.

- [ ] **Step 12: Commit**

```bash
cd apps/paracosm
git add src/cli/dashboard/src/components/reports/ReportView.tsx
git commit -m "feat(reports): compose hero + strip + sparklines + side-nav, demote meta-pills, highlight divergent turns"
```

---

### Task 7: Manual verification

**Files:** none (browser testing)

- [ ] **Step 1: Start the paracosm server + dashboard dev mode**

Run: `cd apps/paracosm && pnpm dashboard` in one terminal; `cd apps/paracosm/src/cli/dashboard && pnpm dev` in another. Open the URL vite prints.

- [ ] **Step 2: Replay an existing cached run and load /sim?tab=reports**

Use the TopBar's LOAD > Load from cache and pick any saved run. Navigate to the Reports tab.

Expected to see, top to bottom:
- Hero scoreboard with winner name, headline, key divergence, and seven A-vs-B stat bars.
- "View full verdict" link. Clicking it smoothly scrolls to the verdict block.
- Run Strip row: one cell per turn with T#/Y####, stacked A + B outcome badges, divergent turns visibly highlighted.
- Clicking a strip cell smoothly scrolls to that turn.
- Metric Trajectories block with six sparkline cards. Each shows A and B lines in rival colors, final values on the right.
- Existing verdict panel.
- Existing commander trajectory cards, if the run has them.
- Each turn section with the existing event blocks; DIVERGENT turns have a rust left-border and a faint red-tinted background; SHARED turns look like before.
- Existing toolbox and references sections.
- Collapsed "What's in this report?" footer. Expanding it shows the old scenario-focus + "this run produced" pills.

- [ ] **Step 3: Side-nav check**

On a desktop-width browser (≥ 1024px), a right-rail nav is visible with jump-links: Summary, Verdict, Strip, Metrics, Trajectory, Turn 1..N, Toolbox, References. Scroll the report; the active item highlights in amber. Click any item and the report scrolls to it.

- [ ] **Step 4: Mobile-width check**

Resize the browser to < 1024px. The right rail disappears and a sticky horizontal nav strip appears at the top of the scrolling area. Same anchor behavior.

- [ ] **Step 5: Mid-run check (optional, requires running sim)**

Launch a new simulation. Before it completes, navigate to Reports. Hero renders the "Simulation in progress" fallback (no stats bars). Strip + sparklines render what's available so far. No React errors in the console.

- [ ] **Step 6: Commit any follow-up fixes**

Any small polish found during manual testing gets individual commits with descriptive messages. If nothing to fix, skip.

- [ ] **Step 7: Push**

This plan does not push; pushing is a separate explicit step the user takes.

---

## Self-review summary

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Goal 1 (hero scoreboard) | Task 2 + Task 6 step 3 |
| Goal 2 (run strip) | Task 3 + Task 6 step 3 |
| Goal 3 (sparklines) | Task 4 + Task 6 step 3 |
| Goal 4 (divergent turn weight) | Task 6 step 6 |
| Goal 5 (side-nav) | Task 5 + Task 6 steps 2 + 9 |
| Goal 6 (preserve existing) | Task 6 steps 4, 5, 6, 7, 8 |
| Meta-pill demotion | Task 6 step 8 |
| Section anchors | Task 6 steps 3, 4, 5, 6, 7 |
| Shared helpers + tests | Task 1 |

**Placeholder scan:** no TBDs; every step shows the exact code. Task 7 is manual verification and lists specific checks.

**Type consistency:** `MetricSeries.id` matches both in `reports-shared.ts` (Task 1) and `MetricSparklines.tsx` (Task 4). `RunStripCell` shape is consistent between Task 1 (exporter) and Task 3 (consumer). `SideNavItem` is exported from Task 5 and imported unchanged in Task 6.

**Commit hygiene:** every task ends in a focused commit with Conventional Commits style. None mention AI. The plan does not push; user is the final gate on publishing.
