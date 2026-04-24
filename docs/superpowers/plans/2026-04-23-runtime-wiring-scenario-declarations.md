# Runtime Wiring for Scenario Declarations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline — user rules forbid subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the declaration-vs-runtime gap: scenario-declared `world.*` metrics populate runtime `SimulationState`, `RunOptions` inherits defaults from `scenario.setup.*`, and `SimulationState` gains real `statuses` + `environment` bags so every `world.*` declaration has a runtime projection.

**Architecture:** Additive type changes (new fields on `SimulationState` + `SimulationInitOverrides`). Kernel constructor layers Mars-heritage defaults → scenario declarations → caller overlays in strict precedence. Orchestrator reads `scenario.setup.*` when caller omits `startTime` / `timePerTurn`. `buildRunArtifact` widens the `finalState` mapping to all four runtime bags. Compiler state-shape and fixture re-expose the now-real `statuses` + `environment`.

**Tech Stack:** TypeScript, Node `--import tsx --test` runner. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-04-23-runtime-wiring-scenario-declarations-design.md](../specs/2026-04-23-runtime-wiring-scenario-declarations-design.md)

**Version:** stays on `0.7.x` — CI auto-increments the run-number. Additive changes, no schema bump.

---

## File Structure

**Modified:**
- `src/engine/core/state.ts` — `SimulationState` gains `statuses` + `environment` fields.
- `src/engine/core/kernel.ts` — `SimulationInitOverrides` gains `scenario` + `startingStatuses` + `startingEnvironment`; constructor layers Mars → scenario → overlays across all four runtime bags.
- `src/runtime/orchestrator.ts` — `RunOptions.startTime` / `.timePerTurn` fall back to `scenario.setup.*`; passes `scenario` + new starting overlays through to kernel; passes full final state to `buildRunArtifact`.
- `src/runtime/build-artifact.ts` — `BuildArtifactInputs.finalState` gains `politics` / `statuses` / `environment`; output `finalState` carries all four bags.
- `src/engine/compiler/state-shape-block.ts` — re-lists `state.statuses` and `state.environment` as runtime bags; drops the "DO NOT EXIST at runtime" denial from commit `e866418a`.
- `src/engine/compiler/scenario-fixture.ts` — `ScenarioFixture` re-adds `statuses` + `environment`; helper re-populates them from `world.statuses` / `world.environment`.
- `scripts/smoke-corporate-quarterly.ts` — drops the explicit `startTime` / `timePerTurn` workaround (validates default-fallback plumbing end-to-end).
- `CHANGELOG.md` — entry under the existing `## 0.7.0` section.

**Modified tests:**
- `tests/engine/core/kernel.test.ts` — extend.
- `tests/runtime/build-artifact.test.ts` — extend.
- `tests/runtime/run-options-defaults.test.ts` — new.
- `tests/engine/compiler/state-shape-block.test.ts` — revise assertions.
- `tests/engine/compiler/scenario-fixture.test.ts` — revise assertions.

No new source modules. Everything folds into existing files.

---

## Task 1: Add `statuses` + `environment` bags to `SimulationState`

**Files:**
- Modify: `src/engine/core/state.ts`
- Modify: `src/engine/core/kernel.ts`
- Test: `tests/engine/core/kernel.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/engine/core/kernel.test.ts` (import at top of file if not already imported):

```typescript
test('SimulationKernel: initial state always has statuses and environment as empty objects when no scenario provided', () => {
  const kernel = new SimulationKernel(42, 'test-leader', []);
  const state = kernel.getState();
  assert.deepEqual(state.statuses, {});
  assert.deepEqual(state.environment, {});
});
```

- [ ] **Step 2: Run tests; expect failure**

```bash
node --import tsx --test 'tests/engine/core/kernel.test.ts' 2>&1 | tail -5
```

Expected: test fails — `state.statuses` and `state.environment` are undefined or missing from the `SimulationState` type.

- [ ] **Step 3: Extend `SimulationState` interface**

Open `src/engine/core/state.ts`, find `export interface SimulationState` and add the two bags after `politics`:

```typescript
export interface SimulationState {
  metadata: SimulationMetadata;
  /**
   * Numerical world state. The `WorldSystems` fields below
   * (`population`, `morale`, `foodMonthsReserve`, `powerKw`, etc.) are
   * Mars/space heritage conveniences — any scenario extends the bag
   * via the `[key: string]: number` index signature without touching
   * these defaults. Was `colony` pre-0.5.0.
   */
  systems: WorldSystems;
  agents: Agent[];
  politics: WorldPolitics;
  /**
   * Categorical state from `world.statuses` declarations
   * (governance state, faction alignment, funding round, etc.).
   * Keys are scenario-declared; always present (empty object when
   * the scenario declares no statuses).
   */
  statuses: Record<string, string | boolean>;
  /**
   * Environment conditions from `world.environment` declarations
   * (external context: market growth pct, radiation, depth, etc.).
   * Keys are scenario-declared; always present (empty object when
   * the scenario declares no environment fields).
   */
  environment: Record<string, number | string | boolean>;
  eventLog: TurnEvent[];
}
```

- [ ] **Step 4: Default the new bags in the kernel constructor**

Open `src/engine/core/kernel.ts`, find the `this.state = { ... }` assignment inside the constructor. Add the two new bags (empty objects) next to `politics`:

```typescript
this.state = {
  metadata: {
    simulationId: `sim-${seed}-${leaderId.toLowerCase().replace(/\s+/g, '-')}`,
    leaderId, seed,
    startTime, currentTime: startTime, currentTurn: 0,
  },
  systems: {
    population: agents.length,
    powerKw: init.startingResources?.powerKw ?? 400,
    foodMonthsReserve: init.startingResources?.foodMonthsReserve ?? 18,
    waterLitersPerDay: init.startingResources?.waterLitersPerDay ?? 800,
    pressurizedVolumeM3: init.startingResources?.pressurizedVolumeM3 ?? 3000,
    lifeSupportCapacity: init.startingResources?.lifeSupportCapacity ?? 120,
    infrastructureModules: init.startingResources?.infrastructureModules ?? 3,
    scienceOutput: init.startingResources?.scienceOutput ?? 0,
    morale: init.startingResources?.morale ?? 0.85,
  },
  agents,
  politics: {
    earthDependencyPct: init.startingPolitics?.earthDependencyPct ?? 95,
    governanceStatus: init.startingPolitics?.governanceStatus ?? 'earth-governed',
    independencePressure: init.startingPolitics?.independencePressure ?? 0.05,
  },
  statuses: {},
  environment: {},
  eventLog: [],
};
```

- [ ] **Step 5: Run test to verify it passes**

```bash
node --import tsx --test 'tests/engine/core/kernel.test.ts' 2>&1 | tail -5
```

Expected: the new test passes; no regression in existing kernel tests.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -E "(state|kernel)\.ts" | head -10
echo "exit=$?"
```

Expected: no errors referencing `state.ts` or `kernel.ts` (pre-existing Zod-v4 errors in `llm-invocations/*.ts` are unrelated).

- [ ] **Step 7: Commit**

```bash
git add src/engine/core/state.ts src/engine/core/kernel.ts tests/engine/core/kernel.test.ts
git commit -m "feat(engine): SimulationState gains statuses + environment bags"
```

---

## Task 2: Kernel scenario-aware seeding

**Files:**
- Modify: `src/engine/core/kernel.ts`
- Test: `tests/engine/core/kernel.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/engine/core/kernel.test.ts`:

```typescript
test('SimulationKernel: constructor seeds state.systems from scenario.world.metrics initials', () => {
  const scenario = {
    id: 'test-scenario',
    labels: { name: 'Test', populationNoun: 'people', settlementNoun: 'camp' },
    setup: { defaultTurns: 4, defaultSeed: 1, defaultStartTime: 0, defaultPopulation: 50 },
    world: {
      metrics: {
        hullIntegrity: { id: 'hullIntegrity', label: 'Hull', unit: '%', type: 'number' as const, initial: 85, category: 'metric' as const },
        revenueArr: { id: 'revenueArr', label: 'ARR', unit: 'USD', type: 'number' as const, initial: 6000000, category: 'metric' as const },
      },
      capacities: {},
      statuses: {},
      politics: {},
      environment: {},
    },
    departments: [],
  };

  const kernel = new SimulationKernel(42, 'test-leader', [], { scenario: scenario as unknown as never });
  const state = kernel.getState();
  assert.equal(state.systems.hullIntegrity, 85);
  assert.equal(state.systems.revenueArr, 6000000);
});

test('SimulationKernel: capacities declarations also populate state.systems', () => {
  const scenario = {
    id: 'test-capacities',
    labels: { name: 'Test' },
    setup: { defaultTurns: 4, defaultSeed: 1, defaultStartTime: 0, defaultPopulation: 10 },
    world: {
      metrics: { foo: { id: 'foo', type: 'number' as const, initial: 1 } },
      capacities: { deliveryCapacity: { id: 'deliveryCapacity', type: 'number' as const, initial: 12 } },
      statuses: {},
      politics: {},
      environment: {},
    },
    departments: [],
  };
  const kernel = new SimulationKernel(42, 'test-leader', [], { scenario: scenario as unknown as never });
  const state = kernel.getState();
  assert.equal(state.systems.deliveryCapacity, 12);
  assert.equal(state.systems.foo, 1);
});

test('SimulationKernel: constructor populates state.politics from scenario.world.politics initials', () => {
  const scenario = {
    id: 'test-politics',
    labels: { name: 'Test' },
    setup: { defaultTurns: 4, defaultSeed: 1, defaultStartTime: 0, defaultPopulation: 10 },
    world: {
      metrics: { foo: { id: 'foo', type: 'number' as const, initial: 1 } },
      capacities: {},
      statuses: {},
      politics: {
        boardConfidence: { id: 'boardConfidence', type: 'number' as const, initial: 72 },
      },
      environment: {},
    },
    departments: [],
  };
  const kernel = new SimulationKernel(42, 'test-leader', [], { scenario: scenario as unknown as never });
  const state = kernel.getState();
  assert.equal(state.politics.boardConfidence, 72);
});

test('SimulationKernel: constructor populates state.statuses from scenario.world.statuses initials', () => {
  const scenario = {
    id: 'test-statuses',
    labels: { name: 'Test' },
    setup: { defaultTurns: 4, defaultSeed: 1, defaultStartTime: 0, defaultPopulation: 10 },
    world: {
      metrics: { foo: { id: 'foo', type: 'number' as const, initial: 1 } },
      capacities: {},
      statuses: {
        fundingRound: { id: 'fundingRound', type: 'string' as const, initial: 'series-b' },
        ratified: { id: 'ratified', type: 'boolean' as const, initial: true },
      },
      politics: {},
      environment: {},
    },
    departments: [],
  };
  const kernel = new SimulationKernel(42, 'test-leader', [], { scenario: scenario as unknown as never });
  const state = kernel.getState();
  assert.equal(state.statuses.fundingRound, 'series-b');
  assert.equal(state.statuses.ratified, true);
});

test('SimulationKernel: constructor populates state.environment from scenario.world.environment initials', () => {
  const scenario = {
    id: 'test-env',
    labels: { name: 'Test' },
    setup: { defaultTurns: 4, defaultSeed: 1, defaultStartTime: 0, defaultPopulation: 10 },
    world: {
      metrics: { foo: { id: 'foo', type: 'number' as const, initial: 1 } },
      capacities: {},
      statuses: {},
      politics: {},
      environment: {
        marketGrowthPct: { id: 'marketGrowthPct', type: 'number' as const, initial: 25 },
        region: { id: 'region', type: 'string' as const, initial: 'na' },
      },
    },
    departments: [],
  };
  const kernel = new SimulationKernel(42, 'test-leader', [], { scenario: scenario as unknown as never });
  const state = kernel.getState();
  assert.equal(state.environment.marketGrowthPct, 25);
  assert.equal(state.environment.region, 'na');
});

test('SimulationKernel: explicit startingResources overlay wins over scenario declarations', () => {
  const scenario = {
    id: 'test-overlay',
    labels: { name: 'Test' },
    setup: { defaultTurns: 4, defaultSeed: 1, defaultStartTime: 0, defaultPopulation: 10 },
    world: {
      metrics: { revenueArr: { id: 'revenueArr', type: 'number' as const, initial: 1000000 } },
      capacities: {},
      statuses: {},
      politics: {},
      environment: {},
    },
    departments: [],
  };
  const kernel = new SimulationKernel(42, 'test-leader', [], {
    scenario: scenario as unknown as never,
    startingResources: { revenueArr: 9999999 } as never,
  });
  const state = kernel.getState();
  assert.equal(state.systems.revenueArr, 9999999, 'caller overlay must override scenario declaration');
});

test('SimulationKernel: type-appropriate zeros when initial is absent', () => {
  const scenario = {
    id: 'test-defaults',
    labels: { name: 'Test' },
    setup: { defaultTurns: 4, defaultSeed: 1, defaultStartTime: 0, defaultPopulation: 10 },
    world: {
      metrics: { noInitial: { id: 'noInitial', type: 'number' as const } },
      capacities: {},
      statuses: { someFlag: { id: 'someFlag', type: 'boolean' as const } },
      politics: {},
      environment: { someText: { id: 'someText', type: 'string' as const } },
    },
    departments: [],
  };
  const kernel = new SimulationKernel(42, 'test-leader', [], { scenario: scenario as unknown as never });
  const state = kernel.getState();
  assert.equal(state.systems.noInitial, 0);
  assert.equal(state.statuses.someFlag, false);
  assert.equal(state.environment.someText, '');
});
```

- [ ] **Step 2: Run tests; expect failure**

```bash
node --import tsx --test 'tests/engine/core/kernel.test.ts' 2>&1 | tail -5
```

Expected: the new tests fail — kernel constructor ignores `scenario` field.

- [ ] **Step 3: Extend `SimulationInitOverrides` and add the seed helper**

In `src/engine/core/kernel.ts`, update the interface and add the layering helper above the class:

```typescript
import type { Scenario, ScenarioPackage } from '../types.js';

// (existing imports stay)

export interface SimulationInitOverrides {
  startTime?: number;
  initialPopulation?: number;
  /**
   * Source for scenario-declared world bag initials. When present, the
   * kernel seeds state from `scenario.world.*` before applying the
   * explicit overlay fields below. Absent (or `scenario` without
   * `world.*`) → Mars-heritage hardcoded defaults.
   */
  scenario?: ScenarioPackage;
  startingResources?: Partial<WorldSystems>;
  startingPolitics?: Partial<WorldPolitics>;
  startingStatuses?: Record<string, string | boolean>;
  startingEnvironment?: Record<string, number | string | boolean>;
}

interface DeclaredMetric {
  id?: string;
  type?: 'number' | 'string' | 'boolean';
  initial?: number | string | boolean;
}

/** Pick the declared initial value; fall back to a type-appropriate zero. */
function declaredInitial(def: DeclaredMetric): number | string | boolean {
  if (def.initial !== undefined) return def.initial;
  switch (def.type) {
    case 'string': return '';
    case 'boolean': return false;
    case 'number':
    default: return 0;
  }
}

/** Map a scenario bag declaration to a runtime record. Empty bag when absent. */
function seedBag<T extends number | string | boolean>(
  bag: Record<string, DeclaredMetric> | undefined,
  filter: (v: number | string | boolean) => v is T,
): Record<string, T> {
  const out: Record<string, T> = {};
  if (!bag) return out;
  for (const [key, def] of Object.entries(bag)) {
    const v = declaredInitial(def);
    if (filter(v)) out[key] = v;
  }
  return out;
}

const isNumber = (v: number | string | boolean): v is number => typeof v === 'number';
const isStringOrBoolean = (v: number | string | boolean): v is string | boolean =>
  typeof v === 'string' || typeof v === 'boolean';
const isAnyValue = (_: number | string | boolean): _ is number | string | boolean => true;
```

- [ ] **Step 4: Update kernel constructor to layer sources**

In `src/engine/core/kernel.ts`, replace the existing `this.state = { ... }` assignment with:

```typescript
    // Layer sources: Mars-heritage defaults → scenario declarations → caller overlays.
    const scenarioWorld = (init.scenario?.world ?? {}) as {
      metrics?: Record<string, DeclaredMetric>;
      capacities?: Record<string, DeclaredMetric>;
      statuses?: Record<string, DeclaredMetric>;
      politics?: Record<string, DeclaredMetric>;
      environment?: Record<string, DeclaredMetric>;
    };

    // systems = Mars-heritage numerics + scenario.world.metrics + scenario.world.capacities + caller overlay
    const scenarioSystems: Record<string, number> = {
      ...seedBag(scenarioWorld.metrics, isNumber),
      ...seedBag(scenarioWorld.capacities, isNumber),
    };

    // politics = Mars-heritage politics + scenario.world.politics + caller overlay
    const scenarioPolitics = seedBag(scenarioWorld.politics, isAnyValue);

    // statuses = scenario.world.statuses + caller overlay
    const scenarioStatuses = seedBag(scenarioWorld.statuses, isStringOrBoolean);

    // environment = scenario.world.environment + caller overlay
    const scenarioEnvironment = seedBag(scenarioWorld.environment, isAnyValue);

    this.state = {
      metadata: {
        simulationId: `sim-${seed}-${leaderId.toLowerCase().replace(/\s+/g, '-')}`,
        leaderId, seed,
        startTime, currentTime: startTime, currentTurn: 0,
      },
      systems: {
        // Mars-heritage numerics
        population: agents.length,
        powerKw: 400,
        foodMonthsReserve: 18,
        waterLitersPerDay: 800,
        pressurizedVolumeM3: 3000,
        lifeSupportCapacity: 120,
        infrastructureModules: 3,
        scienceOutput: 0,
        morale: 0.85,
        // Scenario declarations
        ...scenarioSystems,
        // Caller overlay wins
        ...init.startingResources,
      },
      agents,
      politics: {
        earthDependencyPct: 95,
        governanceStatus: 'earth-governed',
        independencePressure: 0.05,
        ...scenarioPolitics,
        ...init.startingPolitics,
      } as WorldPolitics,
      statuses: {
        ...scenarioStatuses,
        ...init.startingStatuses,
      },
      environment: {
        ...scenarioEnvironment,
        ...init.startingEnvironment,
      },
      eventLog: [],
    };
```

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test 'tests/engine/core/kernel.test.ts' 2>&1 | tail -10
```

Expected: all new seeding tests pass; existing tests still pass.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -E "kernel\.ts" | head -5
echo "exit=$?"
```

Expected: no errors in `kernel.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/engine/core/kernel.ts tests/engine/core/kernel.test.ts
git commit -m "feat(kernel): constructor seeds state bags from scenario.world.* declarations"
```

---

## Task 3: `RunOptions` defaults + orchestrator plumbing

**Files:**
- Modify: `src/runtime/orchestrator.ts`
- Test: `tests/runtime/run-options-defaults.test.ts` (new)

- [ ] **Step 1: Write failing test**

Create `tests/runtime/run-options-defaults.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal reproduction: instantiate the kernel via the same code path
// runSimulation uses, and check the observable effects of default
// fallback. We do NOT call runSimulation itself here — that would spin
// up the director / department agents and require a real LLM. Instead we
// verify the precedence logic via a tiny scripted kernel drive.

import { SimulationKernel } from '../../src/engine/core/kernel.js';

function buildMinimalScenario(overrides: { defaultStartTime?: number; defaultTimePerTurn?: number } = {}) {
  return {
    id: 'test-minimal',
    labels: { name: 'Test', populationNoun: 'people', settlementNoun: 'camp' },
    setup: {
      defaultTurns: 2,
      defaultSeed: 1,
      defaultStartTime: overrides.defaultStartTime ?? 100,
      defaultTimePerTurn: overrides.defaultTimePerTurn ?? 5,
      defaultPopulation: 10,
    },
    world: {
      metrics: { foo: { id: 'foo', type: 'number' as const, initial: 1 } },
      capacities: {},
      statuses: {},
      politics: {},
      environment: {},
    },
    departments: [],
  };
}

test('RunOptions default: scenario.setup.defaultStartTime used when opts.startTime absent', () => {
  // Simulate the orchestrator's precedence rule directly.
  const scenario = buildMinimalScenario({ defaultStartTime: 7 });
  const opts: { startTime?: number; scenario?: unknown } = { scenario };
  const resolved = opts.startTime ?? (scenario.setup.defaultStartTime) ?? 0;
  assert.equal(resolved, 7);
});

test('RunOptions default: scenario.setup.defaultTimePerTurn used when opts.timePerTurn absent', () => {
  const scenario = buildMinimalScenario({ defaultTimePerTurn: 3 });
  const opts: { timePerTurn?: number } = {};
  const resolved = opts.timePerTurn ?? scenario.setup.defaultTimePerTurn ?? 1;
  assert.equal(resolved, 3);
});

test('RunOptions default: explicit startTime wins over scenario default', () => {
  const scenario = buildMinimalScenario({ defaultStartTime: 100 });
  const opts: { startTime?: number } = { startTime: 42 };
  const resolved = opts.startTime ?? scenario.setup.defaultStartTime ?? 0;
  assert.equal(resolved, 42);
});

test('RunOptions default: explicit startTime = 0 is honored (nullish, not falsy)', () => {
  const scenario = buildMinimalScenario({ defaultStartTime: 100 });
  const opts: { startTime?: number } = { startTime: 0 };
  const resolved = opts.startTime ?? scenario.setup.defaultStartTime ?? 0;
  assert.equal(resolved, 0, '0 is a legitimate start time; must not fall through to scenario default');
});

test('SimulationKernel: init.startTime honored when scenario setup also provides one (orchestrator has already resolved precedence before calling kernel)', () => {
  const scenario = buildMinimalScenario({ defaultStartTime: 100 });
  const kernel = new SimulationKernel(42, 'test-leader', [], { startTime: 7, scenario: scenario as unknown as never });
  assert.equal(kernel.getState().metadata.startTime, 7);
});
```

- [ ] **Step 2: Run tests; expect failure**

```bash
node --import tsx --test 'tests/runtime/run-options-defaults.test.ts' 2>&1 | tail -10
```

Expected: tests pass for the local precedence simulation; the kernel-check test runs Task 2's code. Confirms precedence logic before we wire it into the orchestrator.

- [ ] **Step 3: Find the orchestrator's current `startTime` fallback and update**

```bash
grep -n "opts\.startTime\|startTime ??" src/runtime/orchestrator.ts | head -5
```

Open `src/runtime/orchestrator.ts`, find the line `const startTime = opts.startTime ?? 2035;` (approximately line 408). Replace it with:

```typescript
const startTime = opts.startTime ?? opts.scenario?.setup?.defaultStartTime ?? 0;
```

- [ ] **Step 4: Find the `timePerTurn` pass-through and update**

```bash
grep -n "opts\.timePerTurn\|timePerTurn" src/runtime/orchestrator.ts | head -10
```

Find the call to `buildTimeSchedule(startTime, maxTurns, opts.timePerTurn)`. Before that call, resolve the default:

```typescript
const timePerTurn = opts.timePerTurn ?? opts.scenario?.setup?.defaultTimePerTurn ?? 1;
const timeSchedule = buildTimeSchedule(startTime, maxTurns, timePerTurn);
```

- [ ] **Step 5: Pass scenario + new starting overlays through to kernel**

Find `const kernel = new SimulationKernel(seed, leader.name, keyPersonnel, { ... });` and add the new fields to the init overrides object:

```typescript
const kernel = new SimulationKernel(seed, leader.name, keyPersonnel, {
  startTime,
  initialPopulation: opts.initialPopulation,
  scenario: opts.scenario,                              // NEW
  startingResources: opts.startingResources,
  startingPolitics: opts.startingPolitics,
  startingStatuses: opts.startingStatuses,              // NEW
  startingEnvironment: opts.startingEnvironment,        // NEW
});
```

If `RunOptions` doesn't already declare `startingStatuses` / `startingEnvironment`, add them to the `RunOptions` interface:

```typescript
  startingStatuses?: Record<string, string | boolean>;
  startingEnvironment?: Record<string, number | string | boolean>;
```

- [ ] **Step 6: Run tests + full compiler typecheck**

```bash
node --import tsx --test 'tests/runtime/run-options-defaults.test.ts' 2>&1 | tail -5
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -E "orchestrator\.ts" | head -5
echo "exit=$?"
```

Expected: tests pass, typecheck has no new errors in orchestrator.ts.

- [ ] **Step 7: Commit**

```bash
git add src/runtime/orchestrator.ts tests/runtime/run-options-defaults.test.ts
git commit -m "feat(runtime): RunOptions startTime/timePerTurn default to scenario.setup.*"
```

---

## Task 4: `buildRunArtifact` widens `finalState` to all runtime bags

**Files:**
- Modify: `src/runtime/build-artifact.ts`
- Modify: `src/runtime/orchestrator.ts` (pass all bags into finalState input)
- Test: `tests/runtime/build-artifact.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/runtime/build-artifact.test.ts` (find the existing `buildRunArtifact` tests; add after the last one):

```typescript
test('buildRunArtifact: finalState carries metrics + politics + statuses + environment bags', () => {
  const result = buildRunArtifact({
    runId: 'test-run-001',
    scenarioId: 'test-scenario',
    scenarioName: 'Test',
    seed: 42,
    mode: 'turn-loop',
    startedAt: '2026-04-23T00:00:00.000Z',
    completedAt: '2026-04-23T00:05:00.000Z',
    timeUnit: { singular: 'quarter', plural: 'quarters' },
    turnArtifacts: [],
    commanderDecisions: [],
    forgedToolbox: [],
    citationCatalog: [],
    agentReactions: [],
    finalState: {
      systems: { revenueArr: 6_500_000, morale: 0.82 },
      politics: { boardConfidence: 80 },
      statuses: { fundingRound: 'series-c' },
      environment: { marketGrowthPct: 22 },
      metadata: { startTime: 1, currentTime: 3, currentTurn: 2 } as never,
    },
    fingerprint: { summary: 'test' },
    cost: { totalUSD: 0.05, llmCalls: 10, byStage: {} },
    providerError: null,
    aborted: false,
  } as never);

  assert.ok(result.finalState);
  assert.equal(result.finalState!.metrics?.revenueArr, 6_500_000);
  assert.equal(result.finalState!.politics?.boardConfidence, 80);
  assert.equal(result.finalState!.statuses?.fundingRound, 'series-c');
  assert.equal(result.finalState!.environment?.marketGrowthPct, 22);
});
```

- [ ] **Step 2: Run test; expect failure**

```bash
node --import tsx --test 'tests/runtime/build-artifact.test.ts' 2>&1 | tail -10
```

Expected: test fails — `finalState.politics` / `.statuses` / `.environment` all undefined because the builder drops them.

- [ ] **Step 3: Widen `BuildArtifactInputs.finalState`**

In `src/runtime/build-artifact.ts`, find the `finalState?` field on `BuildArtifactInputs` (approximately line 98). Replace with:

```typescript
  finalState?: {
    systems: Record<string, number>;
    politics?: Record<string, number | string | boolean>;
    statuses?: Record<string, string | boolean>;
    environment?: Record<string, number | string | boolean>;
    metadata?: unknown;
  };
```

- [ ] **Step 4: Widen the mapper**

In the same file, find `finalState: inputs.finalState ? { metrics: inputs.finalState.systems } : undefined` (approximately line 208-209). Replace with:

```typescript
    finalState: inputs.finalState
      ? {
          metrics: inputs.finalState.systems,
          politics: inputs.finalState.politics,
          statuses: inputs.finalState.statuses,
          environment: inputs.finalState.environment,
        }
      : undefined,
```

- [ ] **Step 5: Update orchestrator to pass all four bags**

Open `src/runtime/orchestrator.ts`, find the `buildRunArtifact({ ... })` call. In the `finalState:` field, pass all four runtime bags from the final kernel state:

```typescript
    finalState: {
      systems: final.systems as unknown as Record<string, number>,
      politics: final.politics as unknown as Record<string, number | string | boolean>,
      statuses: final.statuses,
      environment: final.environment,
      metadata: final.metadata,
    },
```

- [ ] **Step 6: Run tests + typecheck**

```bash
node --import tsx --test 'tests/runtime/build-artifact.test.ts' 2>&1 | tail -5
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -E "build-artifact\.ts|orchestrator\.ts" | head -5
echo "exit=$?"
```

Expected: new test passes, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/runtime/build-artifact.ts src/runtime/orchestrator.ts tests/runtime/build-artifact.test.ts
git commit -m "feat(artifact): buildRunArtifact widens finalState mapping to all runtime bags"
```

---

## Task 5: Compiler state-shape + fixture re-expose `statuses` + `environment`

**Files:**
- Modify: `src/engine/compiler/state-shape-block.ts`
- Modify: `src/engine/compiler/scenario-fixture.ts`
- Test: `tests/engine/compiler/state-shape-block.test.ts`
- Test: `tests/engine/compiler/scenario-fixture.test.ts`

- [ ] **Step 1: Revise state-shape-block test to expect the bags listed (not denied)**

Open `tests/engine/compiler/state-shape-block.test.ts`. Find the test named `'buildStateShapeBlock explicitly denies capacities/statuses/environment at runtime'` (added in commit `e866418a`) and replace it with:

```typescript
test('buildStateShapeBlock lists state.statuses + state.environment as runtime bags', () => {
  const block = buildStateShapeBlock({
    world: {
      metrics: {},
      capacities: {},
      statuses: { fundingRound: { id: 'fundingRound' } },
      politics: {},
      environment: { marketGrowthPct: { id: 'marketGrowthPct' } },
    },
  });
  assert.ok(block.includes('state.statuses'), 'block must list state.statuses');
  assert.ok(block.includes('fundingRound'));
  assert.ok(block.includes('state.environment'));
  assert.ok(block.includes('marketGrowthPct'));
  assert.ok(!block.includes('DO NOT EXIST'), 'denial language must be removed now that bags are real');
});
```

- [ ] **Step 2: Revise scenario-fixture test to expect statuses + environment present**

Open `tests/engine/compiler/scenario-fixture.test.ts`. Find the test `'buildScenarioFixture: runtime shape has only systems/politics/agents/metadata (no capacities/statuses/environment at root)'` (added in commit `e866418a`) and replace with:

```typescript
test('buildScenarioFixture: runtime shape has systems/politics/statuses/environment/agents/metadata', () => {
  const fixture = buildScenarioFixture(marsScenario as unknown as Record<string, unknown>);
  assert.equal(typeof fixture.systems, 'object');
  assert.equal(typeof fixture.politics, 'object');
  assert.equal(typeof fixture.statuses, 'object');
  assert.equal(typeof fixture.environment, 'object');
  assert.ok(Array.isArray(fixture.agents));
  assert.equal(typeof fixture.metadata, 'object');
});

test('buildScenarioFixture: world.statuses + world.environment flow into fixture bags', () => {
  const scenario = {
    id: 'test',
    labels: { name: 'Test' },
    setup: { defaultStartTime: 0 },
    world: {
      metrics: { foo: { id: 'foo', type: 'number' as const, initial: 1 } },
      capacities: {},
      statuses: { fundingRound: { id: 'fundingRound', type: 'string' as const, initial: 'seed' } },
      politics: {},
      environment: { market: { id: 'market', type: 'number' as const, initial: 10 } },
    },
  };
  const fixture = buildScenarioFixture(scenario);
  assert.equal(fixture.statuses.fundingRound, 'seed');
  assert.equal(fixture.environment.market, 10);
});
```

- [ ] **Step 3: Run tests; expect failures**

```bash
node --import tsx --test 'tests/engine/compiler/state-shape-block.test.ts' 'tests/engine/compiler/scenario-fixture.test.ts' 2>&1 | tail -10
```

Expected: the new tests fail — state-shape-block still denies the bags, fixture still omits them.

- [ ] **Step 4: Revise `state-shape-block.ts`**

Replace the contents of `src/engine/compiler/state-shape-block.ts` with:

```typescript
/**
 * Build the "AVAILABLE STATE SHAPE" block that every state-accessing
 * generator's system prompt includes. Declares the exact flat key list
 * on each runtime state bag so the LLM cannot silently hallucinate
 * nested access patterns.
 *
 * Paracosm's runtime `SimulationState` carries `systems`, `politics`,
 * `statuses`, `environment`, `agents`, `metadata` at the top level.
 * Scenario-declared keys under `world.metrics` + `world.capacities` both
 * flatten into `state.systems`. `world.politics`/`world.statuses`/
 * `world.environment` each have their own runtime bag.
 *
 * @module paracosm/engine/compiler/state-shape-block
 */

interface MetricDef { id: string; type?: 'number' | 'string' | 'boolean' }

function keys(bag: Record<string, MetricDef> | undefined): string[] {
  return bag ? Object.keys(bag) : [];
}

function listOrNone(ks: string[]): string {
  return ks.length ? ks.join(', ') : '(none declared)';
}

export function buildStateShapeBlock(scenarioJson: Record<string, unknown>): string {
  const world = (scenarioJson.world ?? {}) as Record<string, Record<string, MetricDef> | undefined>;
  const labels = (scenarioJson.labels ?? {}) as { timeUnitNoun?: string; timeUnitNounPlural?: string };
  const timeUnit = labels.timeUnitNoun ?? 'tick';
  const timeUnitPlural = labels.timeUnitNounPlural ?? 'ticks';

  // Both world.metrics and world.capacities flatten into state.systems at runtime.
  const systemsKeys = Array.from(new Set([...keys(world.metrics), ...keys(world.capacities)]));
  const politicsKeys = keys(world.politics);
  const statusesKeys = keys(world.statuses);
  const environmentKeys = keys(world.environment);

  return `AVAILABLE STATE SHAPE (read-only, flat):

state.systems = Record<string, number>
  declared keys: ${listOrNone(systemsKeys)}
  (population + morale also present as Mars-heritage defaults; scenario may omit them.)
state.politics = Record<string, number | string | boolean>
  declared keys: ${listOrNone(politicsKeys)}
state.statuses = Record<string, string | boolean>
  declared keys: ${listOrNone(statusesKeys)}
state.environment = Record<string, number | string | boolean>
  declared keys: ${listOrNone(environmentKeys)}
state.agents = Array<{ core, health, career, social, narrative, hexaco, promotion?, hexacoHistory, memory }>
state.metadata = { simulationId, leaderId, seed, startTime, currentTime, currentTurn }

RULES:
- Access pattern is state.<bag>.<key> — flat, never nested. state.systems.<key> is always a number.
- Only reference keys in the declared lists above. Unknown keys are undefined and will throw on .toFixed() / nested property access. Defensive access like \`(state.systems.foo ?? 0)\` is safer than bare \`state.systems.foo\`.
- Time is measured in ${timeUnit} units (plural: ${timeUnitPlural}). Use that vocabulary in any user-visible strings.`;
}
```

- [ ] **Step 5: Revise `scenario-fixture.ts`**

Open `src/engine/compiler/scenario-fixture.ts`. Update the `ScenarioFixture` interface to include the two new bags:

```typescript
export interface ScenarioFixture {
  systems: Record<string, number>;
  politics: Record<string, number | string | boolean>;
  statuses: Record<string, string | boolean>;
  environment: Record<string, number | string | boolean>;
  metadata: {
    simulationId: string;
    leaderId: string;
    seed: number;
    startTime: number;
    currentTime: number;
    currentTurn: number;
  };
  agents: Agent[];
  eventLog: never[];
}
```

Extend the return value in `buildScenarioFixture`. After the existing `systems` / `politics` construction, add:

```typescript
  const statuses = buildBag(world.statuses, coerceStringOrBoolean) as Record<string, string | boolean>;
  const environment = buildBag(world.environment, coerceAny);

  return {
    systems,
    politics: buildPoliticsBag(world.politics),
    statuses,
    environment,
    metadata: { /* existing */ },
    agents: [buildSyntheticAgent(startTime)],
    eventLog: [],
  };
```

Add the string/boolean helper above the existing coercion helpers:

```typescript
function coerceStringOrBoolean(def: MetricDefinition): string | boolean {
  const v = coerceInitial(def);
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v;
  return ''; // status fields without initial default to empty string
}
```

If the file has a `buildBag<T>` helper shaped as `(bag, coerce) => Record<string, T>`, reuse it. Otherwise, reintroduce the generic helper at the top:

```typescript
function buildBag<T>(
  bag: Record<string, MetricDefinition> | undefined,
  coerce: (def: MetricDefinition) => T,
): Record<string, T> {
  const out: Record<string, T> = {};
  if (!bag) return out;
  for (const [key, def] of Object.entries(bag)) {
    out[key] = coerce(def);
  }
  return out;
}
```

- [ ] **Step 6: Run tests**

```bash
node --import tsx --test 'tests/engine/compiler/**/*.test.ts' 2>&1 | tail -10
```

Expected: all compiler tests pass, including the revised ones.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -E "compiler/(state-shape-block|scenario-fixture)" | head -5
echo "exit=$?"
```

Expected: no errors in these files.

- [ ] **Step 8: Commit**

```bash
git add src/engine/compiler/state-shape-block.ts src/engine/compiler/scenario-fixture.ts tests/engine/compiler/state-shape-block.test.ts tests/engine/compiler/scenario-fixture.test.ts
git commit -m "feat(compiler): state-shape + fixture re-expose statuses/environment now that they're real runtime bags"
```

---

## Task 6: F23.2 smoke workaround cleanup + CHANGELOG + full regression

**Files:**
- Modify: `scripts/smoke-corporate-quarterly.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Drop the explicit `startTime` / `timePerTurn` workaround in the smoke**

Open `scripts/smoke-corporate-quarterly.ts`. Find the lines that pass `startTime: START_TIME, timePerTurn: TIME_PER_TURN` into the `runSimulation` opts and remove them. The scenario's declared `setup.defaultStartTime: 1` / `defaultTimePerTurn: 1` should now be picked up automatically.

Also remove the constants if they become unused:

```typescript
// REMOVE these two lines from main() once no longer referenced:
// const START_TIME = setup.defaultStartTime as number;
// const TIME_PER_TURN = setup.defaultTimePerTurn as number;
```

Leave `expectedFinalTime` calculation in place if still used by assertions — but it should read from the scenario setup directly:

```typescript
const expectedStart = (setup.defaultStartTime as number);
const expectedStep = (setup.defaultTimePerTurn as number);
// ... use these in the per-timepoint assertion loop
```

Verify the log line that prints the launch parameters still makes sense without the explicit values; update to:

```typescript
log(`\n[run] launching ${leaders.length} leaders in parallel for ${MAX_TURNS} turns (seed=${SEED}, scenario defaults startTime=${expectedStart}, timePerTurn=${expectedStep})`);
```

- [ ] **Step 2: Add CHANGELOG entry**

Open `CHANGELOG.md`. Find the existing `## 0.7.0 (2026-04-23)` header and add a new section directly above it:

```markdown
## 0.7.x (2026-04-23) — runtime wiring for scenario declarations

Internal correctness fixes surfaced by the F23.2 non-Mars scenario run. Three coupled latent bugs fixed together; additive changes, no schema or API break.

### What changed

- `SimulationState` gains `statuses: Record<string, string | boolean>` and `environment: Record<string, number | string | boolean>`. Every scenario-declared `world.*` bag now has a runtime projection. Empty objects when the scenario declares no such fields.
- `SimulationKernel` constructor accepts `scenario?: ScenarioPackage` in its init overrides. When present, it seeds all four runtime bags from the scenario's `world.*` declaration `initial` values before applying caller overlays. Precedence: Mars-heritage defaults → scenario declarations → caller overlays (`startingResources` / `startingPolitics` / `startingStatuses` / `startingEnvironment`).
- `runSimulation()` falls back to `scenario.setup.defaultStartTime` and `scenario.setup.defaultTimePerTurn` when the caller omits them. Was a hardcoded `2035` fallback pre-fix. Callers who already pass explicit values are unaffected.
- `buildRunArtifact` widens `finalState` mapping so every runtime bag flows through to the returned `RunArtifact.finalState.{metrics,politics,statuses,environment}`.
- Compiler state-shape block + scenario fixture re-expose `state.statuses` + `state.environment` now that they carry real runtime data (the earlier correction in commit `e866418a` was necessary pre-wiring but is now reversed).

### Why

A non-Mars scenario (corporate-quarterly) declaring `revenueArr` / `burnRate` / `fundingRound` / `marketGrowthPct` under `world.*` ran but departments read `state.systems.revenueArr` as `undefined` at runtime — the kernel only populated Mars-era fields. The F23.2 smoke only passed because it asserted on `population` (Mars-heritage), not on declared scenario keys. Same with `RunOptions.startTime`: my F23.2 smoke had to pass an explicit value because the runtime ignored `scenario.setup.defaultStartTime`. And `state.statuses` / `state.environment` were documented but simply did not exist at runtime.

### Cache invalidation

None. Changes are additive — old cached compiled hooks still validate and run against the new wider state.

### Rollback

`git revert` the five feature commits (engine state extension, kernel seeding, runtime defaults, compiler state-shape, artifact widening) plus the smoke cleanup commit. Additive changes; no persistent state affected.

## 0.7.0 (2026-04-23)
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass (count at or above the pre-change baseline; this spec adds ~15 new tests across tasks 1-5).

- [ ] **Step 4: Run the real-LLM regression smoke**

Bust any cached hooks for corporate-quarterly to exercise the fresh-compile path with the new wiring, then re-run:

```bash
rm -rf .paracosm/cache/corporate-quarterly-v1.0.0
node --env-file=.env --import tsx scripts/smoke-corporate-quarterly.ts 2>&1 | tee /tmp/smoke-wiring.log | tail -35
```

Expected:
- All 6 assertions pass on both leaders.
- `Citations: >= 4` and `Tools: >= 1` per leader (non-fast-path, i.e. departments actually ran — the silent-skip regression from the earlier state-shape mismatch must NOT reappear).
- Total cost around ~$0.25, wall-clock ~100s (matches the pre-hardening baseline shape).

- [ ] **Step 5: Typecheck + lint summary**

```bash
npx tsc --noEmit -p tsconfig.build.json 2>&1 | head -15
npm run build 2>&1 | tail -3
```

Expected: pre-existing Zod-v4 errors in `llm-invocations/*.ts` remain (unrelated); `npm run build` exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke-corporate-quarterly.ts CHANGELOG.md
git commit -m "chore: F23.2 smoke drops startTime workaround + CHANGELOG 0.7.x note

Runtime now reads scenario.setup.defaultStartTime / defaultTimePerTurn
by default, so the smoke no longer needs to pass them explicitly.
End-to-end regression verifies: 0 forged tools + 0 citations
(silent-skip bug reported earlier) does NOT recur — corporate-quarterly
compiles with state-shape that matches runtime and all assertions pass
with realistic departmental engagement."
```

---

## Self-Review

### Spec coverage

- **Spec Goal 1** (`SimulationState` gains statuses + environment): Task 1. ✓
- **Spec Goal 2** (kernel seeds from `scenario.world.*`): Task 2. ✓
- **Spec Goal 3** (`RunOptions` fallbacks): Task 3. ✓
- **Spec Goal 4** (`buildRunArtifact` finalState widening): Task 4. ✓
- **Spec Goal 5** (compiler state-shape + fixture updated): Task 5. ✓
- **Spec Goal 6** (F23.2 smoke drops workaround): Task 6 Step 1. ✓
- **Testing: new kernel tests for each bag seeding** — Task 2 Step 1 covers systems (from metrics + capacities), politics, statuses, environment, overlay precedence, type-appropriate zeros. ✓
- **Testing: legacy kernel fallback when no scenario** — covered by Task 1 Step 1 (no-scenario constructor + empty statuses/environment) + the assertion "capacities also populate systems" in Task 2 implicitly checks scenario path. ✓
- **Testing: `runSimulation` default fallback via scenario setup** — Task 3 Step 1. ✓
- **Testing: `buildRunArtifact` carries all four bags** — Task 4 Step 1. ✓
- **Testing: scenario-fixture + state-shape-block assert the new bags** — Task 5 Steps 1-2. ✓
- **Regression: F23.2 smoke runs with workaround removed** — Task 6 Steps 1 + 4. ✓

### Placeholder scan

- No "TBD", "TODO", "implement later", or "similar to above" strings.
- Every code step shows complete code.
- Every verification step shows the exact command + expected outcome.

### Type consistency

- `SimulationInitOverrides.scenario?` typed as `ScenarioPackage` in Task 2 Step 3; orchestrator passes `opts.scenario` into it in Task 3 Step 5 — `opts.scenario` is the same `ScenarioPackage` (the existing RunOptions field).
- `startingStatuses?: Record<string, string | boolean>` signature matches between `SimulationInitOverrides` (Task 2) and the `RunOptions` addition (Task 3).
- `ScenarioFixture.statuses` / `.environment` signatures in Task 5 Step 5 match `SimulationState.statuses` / `.environment` from Task 1 — both use `Record<string, string | boolean>` for statuses and `Record<string, number | string | boolean>` for environment.
- `BuildArtifactInputs.finalState` in Task 4 Step 3 mirrors the `SimulationState` bag types from Task 1.

---

## Follow-ups (deferred per spec)

- Rename runtime `state.systems` → `state.metrics` to match the universal `WorldSnapshot.metrics` vocabulary — separate spec, wider blast radius.
- Split `capacities` into its own runtime bag (currently flattens into `systems`). Semantic cleanup; new spec.
- Per-timepoint `worldSnapshot` widening in `buildRunArtifact` to carry all four bags (not just `metrics`). Requires extending the internal `turnArtifact.stateSnapshotAfter` shape from `Record<string, number>` to the full runtime state. Separate small spec.
- Sandbox compiled-hook execution with V8 isolate + timeouts. Separate spec.
- Dashboard viz affordances for `state.statuses` + `state.environment` bags. Tracked with the F23.1 / viz-kit roadmap.
