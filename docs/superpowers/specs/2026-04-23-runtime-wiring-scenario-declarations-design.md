# Runtime wiring for scenario declarations + setup defaults

**Status:** design, awaiting approval
**Date:** 2026-04-23
**Scope:** engine (`SimulationState`, `SimulationKernel`), runtime (`runSimulation` defaults, `buildRunArtifact`), compiler (state-shape block + fixture), tests. No schema-version bump; changes are additive.

---

## Motivation

Three coupled latent bugs surface whenever a scenario author declares state keys outside the Mars-era vocabulary:

1. **Kernel ignores scenario-declared metrics.** The kernel constructor hardcodes Mars defaults (`population: 100`, `morale: 0.85`, `powerKw: 400`, `foodMonthsReserve: 18`, etc.) into `state.systems`. If a scenario declares `revenueArr` under `world.metrics`, the runtime never populates it. Compiled hooks that read `state.systems.revenueArr` get `undefined.toFixed()` and throw. This silently bit F23.2 — the smoke only passed because it asserts on `population` (Mars-heritage), not on `revenueArr`.
2. **`RunOptions.startTime ?? 2035` hardcoded fallback.** A caller who omits `startTime` gets Mars 2035 regardless of what `scenario.setup.defaultStartTime` declares. Same pattern for `timePerTurn`. F23.2's smoke had to pass them explicitly; realistic users won't know to.
3. **`world.statuses` + `world.environment` are declaration-only dead code.** Scenarios declare them with `initial` values, but the runtime `SimulationState` has no corresponding bag. Authors see documentation that promises state bags that never materialize.

All three share a root cause: paracosm's runtime `SimulationState` is narrower than the scenario's `world.*` declaration vocabulary, so authors declare fields that silently don't exist. Fix all three at the runtime layer so the declared contract matches reality.

---

## Goals

1. `SimulationState` gains `statuses` + `environment` bags. Every `world.*` declaration now has a runtime projection.
2. `SimulationKernel` constructor seeds each state bag from `scenario.world.*` declaration `initial` values before applying caller overlays.
3. `runSimulation` reads `scenario.setup.defaultStartTime` / `defaultTimePerTurn` when the caller omits them.
4. `buildRunArtifact` widens the `finalState` mapping so every runtime bag flows into `WorldSnapshot.*` on the produced artifact. Same for per-timepoint snapshots.
5. Compiler state-shape block + fixture reflect the full runtime contract.
6. F23.2 smoke script runs without the explicit-`startTime` workaround.

Non-goals:

- Rename `systems` → `metrics` in runtime `SimulationState` to match `WorldSnapshot.metrics`. Deferred — wider blast radius, doesn't block the fix.
- Split `capacities` into its own runtime bag. Capacities currently flatten into `systems` at runtime; keep that.
- Schema-version bump. Changes are additive (new optional bags, new optional init fields). Old cached hooks keep working — they just never reference the newly-available bags.
- Sandbox hook execution. Separate spec.

---

## Architecture

### `SimulationState` (engine/core/state.ts)

```typescript
export interface SimulationState {
  metadata: SimulationMetadata;
  systems: WorldSystems;                // unchanged (merged world.metrics + world.capacities)
  politics: WorldPolitics;              // unchanged
  statuses: Record<string, string | boolean>;                // NEW — world.statuses projection
  environment: Record<string, number | string | boolean>;    // NEW — world.environment projection
  agents: Agent[];
  eventLog: TurnEvent[];
}
```

Both new bags default to `{}` for scenarios that declare neither, so the empty case is indistinguishable from legacy scenarios.

### `SimulationInitOverrides` (engine/core/kernel.ts)

```typescript
export interface SimulationInitOverrides {
  startTime?: number;
  initialPopulation?: number;
  scenario?: Scenario;                                          // NEW
  startingResources?: Partial<WorldSystems>;
  startingPolitics?: Partial<WorldPolitics>;
  startingStatuses?: Record<string, string | boolean>;          // NEW
  startingEnvironment?: Record<string, number | string | boolean>; // NEW
}
```

`scenario` is optional. Present → kernel reads `scenario.world.*` declarations as the primary seed source. Absent → kernel falls back to Mars-heritage hardcoded defaults (non-breaking for any external caller doing `new SimulationKernel(seed, leaderId, keyPersonnel)` without an overrides arg).

### Kernel initialization order

Each bag is built by layering in strict precedence (later wins):

1. **Mars-heritage defaults** — kernel's current hardcoded values (only for `systems` + `politics`, for back-compat). `statuses` / `environment` have no Mars-era defaults; start at `{}`.
2. **Scenario declarations** — `scenario.world.<bag>` values mapped to their `initial` field (or type-appropriate zero for `number` / `''` for `string` / `false` for `boolean` if `initial` absent).
3. **Caller overlays** — `init.startingResources` / `init.startingPolitics` / `init.startingStatuses` / `init.startingEnvironment` if provided.

This mirrors how `startingResources` already works today, extended uniformly across all four runtime bags.

### `RunOptions` defaults (runtime/orchestrator.ts)

```typescript
// Before:
const startTime = opts.startTime ?? 2035;
const timePerTurn = opts.timePerTurn;       // kernel default fires when absent

// After:
const startTime = opts.startTime ?? opts.scenario?.setup.defaultStartTime ?? 0;
const timePerTurn = opts.timePerTurn ?? opts.scenario?.setup.defaultTimePerTurn ?? 1;
```

Mars + Lunar scenarios both declare `defaultStartTime` + `defaultTimePerTurn`, so their behavior is unchanged. Non-Mars scenarios that previously would have silently defaulted to 2035 now use their own declared cadence.

Caller explicitly passing `startTime: 0` still gets 0 (nullish coalescing, not falsy).

### `buildRunArtifact` finalState widening (runtime/build-artifact.ts)

**Current:**
```typescript
finalState: inputs.finalState
  ? { metrics: inputs.finalState.systems }
  : undefined
```

**After:**
```typescript
finalState: inputs.finalState
  ? {
      metrics: inputs.finalState.systems,
      politics: inputs.finalState.politics,
      statuses: inputs.finalState.statuses,
      environment: inputs.finalState.environment,
    }
  : undefined
```

Same widening applied to the per-timepoint `worldSnapshot` construction inside the trajectory loop. `BuildArtifactInputs.finalState` type gains the three additional bags as optional fields.

`WorldSnapshot` Zod schema in `schema/primitives.ts` already accepts these — no schema change required. Existing callers whose `finalState` input doesn't carry the new bags just produce artifacts with those fields undefined, which the schema tolerates.

### Compiler updates

**`state-shape-block.ts`** — reverse the denial from commit `e866418a`:
- Re-list `state.statuses = Record<string, string | boolean>` with declared keys.
- Re-list `state.environment = Record<string, number | string | boolean>` with declared keys.
- Remove the "DO NOT EXIST at runtime" rule.
- Keep the flat-access rule and defensive nullish-coalescing recommendation.

**`scenario-fixture.ts`** — re-populate the two bags on the returned fixture, typed per declared `type` field. Mars-heritage overlay on `systems` stays (population, morale). Fixture now structurally matches the post-fix runtime state.

---

## Data flow

```
scenario.world.metrics          ─┐
scenario.world.capacities       ─┼─► kernel → state.systems
scenario.world.politics         ───► kernel → state.politics
scenario.world.statuses         ───► kernel → state.statuses          [NEW]
scenario.world.environment      ───► kernel → state.environment       [NEW]
scenario.setup.defaultStartTime ───► runSimulation fallback           [FIX]
scenario.setup.defaultTimePerTurn ─► runSimulation fallback           [FIX]

runSimulation → kernel.advanceTurn → state snapshots → buildRunArtifact
  .finalState.metrics      ← state.systems       (unchanged)
  .finalState.politics     ← state.politics      (was dropped, now mapped)
  .finalState.statuses     ← state.statuses      (NEW)
  .finalState.environment  ← state.environment   (NEW)

Per-timepoint worldSnapshot in trajectory receives the same widening.
```

---

## Error handling

- **Missing `scenario` on kernel init:** Mars-heritage hardcoded defaults fire, exactly as today. Explicit `startingResources` / `startingStatuses` / `startingEnvironment` still overlay. No regression for legacy kernel callers.
- **Scenario declares `world.metrics` but no `initial` per metric:** kernel seeds with type-appropriate zero (0 / '' / false). Compiler hooks that `.toFixed()` on an absent key see 0, no throw.
- **Scenario declares a bag as an empty `{}`:** kernel populates the runtime bag as `{}`. Empty is valid.
- **Caller passes `startTime: 0` explicitly:** honored (0 is a legitimate start). Nullish coalescing on `opts.startTime` only falls through on `undefined` / `null`.
- **Caller passes `scenario: undefined` in init overrides:** same as omitting it — Mars-heritage defaults. Symmetric with today's behavior.
- **Kernel sees unfamiliar `type` in a scenario's metric declaration:** falls back to numeric 0. Type-specific coercion logic already lives in `scenario-fixture.ts`; factor shared helper both consume.

---

## Testing

### New tests

- **`tests/engine/core/kernel.test.ts`** (extend): constructor seeds `state.systems` from `scenario.world.metrics` declared initials; seeds `state.politics` from `world.politics`; seeds `state.statuses` + `state.environment` from their bags. Covers each bag with a scenario declaring distinctive keys not in Mars vocabulary.
- **`tests/engine/core/kernel.test.ts`** (extend): constructor called WITHOUT a scenario reproduces today's Mars-heritage defaults — regression guard for any external consumer using `new SimulationKernel` directly without overrides.
- **`tests/engine/core/kernel.test.ts`** (extend): declared initials are overridden by `startingResources` / `startingStatuses` / `startingEnvironment` in the expected precedence order.
- **`tests/runtime/run-options-defaults.test.ts`** (new): calling `runSimulation` with a scenario declaring `defaultStartTime: 1` / `defaultTimePerTurn: 1` and no `opts.startTime` produces turn events with `time: 1, 2, ...`. Same caller with `opts.startTime: 42` overrides to 42.
- **`tests/runtime/build-artifact.test.ts`** (extend): `buildRunArtifact` output carries `finalState.politics` / `.statuses` / `.environment` when the input `finalState` populates them. Same for the per-timepoint `worldSnapshot`.
- **`tests/engine/compiler/scenario-fixture.test.ts`** (revise): fixture exposes `statuses` + `environment` bags again (the earlier correction to remove them is reverted because the runtime now carries them). Assert declared-keys are present with typed initials.
- **`tests/engine/compiler/state-shape-block.test.ts`** (revise): block lists state.statuses + state.environment with declared keys; no "DO NOT EXIST" language.

### Regression

- `tests/**` existing suites must still pass (532+ baseline).
- F23.2 smoke script runs with the explicit `startTime` / `timePerTurn` workaround REMOVED. Passes all 6 assertions against a fresh `.paracosm/cache` (script's cache-bust step handles that).

### Real-LLM smoke (post-merge)

- Recompile corporate-quarterly once to pick up the state-shape update. Run both leaders 2 turns. Expect the "v4 baseline" shape: ~$0.25, ~100s wall-clock, Citations ≥ 4, Tools ≥ 1 per leader.
- Recompile Mars once. Existing Mars test suites should keep passing — no behavior change for Mars since its `world.metrics` declaration already covers what the kernel hardcodes (population, morale, powerKw, etc.) and values match.

---

## Rollout

Five commits, each typecheck-green, each with its own test extension:

1. `feat(engine)`: add `statuses` + `environment` to `SimulationState`; default both to `{}` in kernel init.
2. `feat(kernel)`: constructor accepts `scenario` in overrides; seeds all four runtime bags from `world.*` declarations before applying caller overlays.
3. `feat(runtime)`: `runSimulation` falls back to `scenario.setup.*` for `startTime` / `timePerTurn` when caller omits.
4. `feat(compiler)`: state-shape block + fixture re-expose `state.statuses` + `state.environment` with declared keys.
5. `feat(artifact)`: `buildRunArtifact` widens `finalState` + per-timepoint `worldSnapshot` to map all four runtime bags.

After all five, the F23.2 smoke drops its `startTime` / `timePerTurn` workaround as a 6th cleanup commit.

Package version stays on `0.7.x` — CI auto-increments the run number on push. Changes are purely additive (new optional bags on `SimulationState`, new optional init fields). CHANGELOG entry covers the three fixes together under the current `## 0.7.0` section.

---

## Acceptance criteria

- `tsc --noEmit -p tsconfig.build.json` exit 0.
- `npm test` at or above current baseline (new tests added).
- F23.2 smoke script runs without `startTime` / `timePerTurn` workaround, all 6 assertions pass.
- Mars real-LLM recompile produces hooks structurally equivalent to current Mars baseline; no behavior regression.
- Corporate-quarterly smoke produces Citations ≥ 4 and Tools ≥ 1 per leader (post-fix baseline, matches pre-compiler-hardening v4 numbers).

---

## Rollback

`git revert` the five commits. `SimulationState` loses the two new bags, kernel reverts to Mars-heritage defaults, `runSimulation` reverts to 2035 fallback, `buildRunArtifact` drops back to `{metrics}` only. No persistent state affected; cached compiled hooks still work because the runtime shape is a superset of what they reference.

---

## Follow-ups (deferred)

- Rename runtime `state.systems` → `state.metrics` to match `WorldSnapshot.metrics` vocabulary — wider blast radius than this spec justifies.
- Split `capacities` into its own runtime bag (currently flattens into `systems`). Clean up semantically; tracked separately.
- Sandbox compiled-hook execution with V8 isolate / timeouts (reuse the forge sandbox infrastructure). Separate spec.
- Dashboard wiring for `state.statuses` + `state.environment` — add viz affordances to render these new bags in the dashboard Stats / Reports tabs. Track with the F23.1 / viz-kit work.
