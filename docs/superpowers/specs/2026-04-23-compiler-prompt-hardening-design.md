# Compiler Prompt Hardening — scenario-derived fixtures + exact key lists

**Status:** design, awaiting approval
**Date:** 2026-04-23
**Scope:** the five `generate-*.ts` LLM hook generators in `src/engine/compiler/`, the shared validation fixture, `generateValidatedCode`'s retry loop, and `COMPILE_SCHEMA_VERSION`. No runtime or schema changes.

---

## Motivation

A consumer running `compileScenario(myWorldJson)` against a scenario that declares a `hull` metric saw this at runtime on turn 3:

```
[event 1/1] Failed: TypeError: undefined is not an object
(evaluating 'ctx.state.systems.hull.integrity')
```

Root cause: the LLM-generated `departmentPromptHook` assumed a nested object shape for `state.systems.hull` (probably inferred from domain vocabulary like "hull integrity"). `state.systems` is actually a flat `Record<string, number>`. The access `.hull.integrity` is `undefined.integrity`, which throws.

The compiler has retry + smokeTest safety rails via `generateValidatedCode`, but they didn't save this run because:

1. **Hardcoded Mars-shaped fixtures.** Each generator's smokeTest uses a fixed Mars-era `systems` bag (`{ morale, population, foodMonthsReserve, powerKw, ... }`). For scenarios with other metric keys, the fixture misses them. Hooks that reference scenario-declared keys fail against this fixture even when they'd work against real scenario state; hooks that use optional chaining around a wrong shape slip through validation because `state.systems.hull?.integrity` returns undefined rather than throwing, so the fixture can't tell the difference.
2. **Retries re-run with identical prompts.** When a hook fails smokeTest, `generateValidatedCode` retries with the same prompt. The LLM has no signal about what failed, so it tends to produce variants of the same wrong shape.
3. **Prompt doesn't declare the state shape.** `buildSystemBlock()` in each generator says things like "access `ctx.state.systems`" without pinning down the exact key list or the flatness constraint. The LLM fills the gap with plausible-sounding domain assumptions.

Compile cache predates the tightened contract, so existing caches must regenerate.

---

## Goals

1. Every `generate-*.ts` that produces a hook reading `ctx.state.*` validates the hook against a fixture derived from **the scenario being compiled**, not a hardcoded Mars fixture.
2. Every prompt declares the exact flat key list available on each state bag so the LLM has no reason to hallucinate nested paths or unknown keys.
3. When validation fails and the generator retries, the retry prompt carries the previous failure's error message as negative-example feedback.
4. The cache regenerates once on every user's disk so no pre-hardening hooks survive.

Non-goals:

- AST-level blacklisting of nested access patterns (too brittle, high false-positive rate).
- Sandboxing hook execution at runtime beyond the event-loop catch improvement already shipped in [4d85244c].
- Retroactive rewrite of existing published hook examples in the test suite.

---

## Architecture

### New helper: `src/engine/compiler/scenario-fixture.ts`

Single exported function `buildScenarioFixture(scenarioJson)` returning a `SimulationState`-shaped object:

```typescript
interface BuiltFixture {
  systems: Record<string, number>;            // from world.metrics initials
  capacities: Record<string, number>;         // from world.capacities initials
  statuses: Record<string, string | boolean>; // from world.statuses initials
  politics: Record<string, number | string | boolean>; // from world.politics
  environment: Record<string, number | string | boolean>; // from world.environment
  metadata: {
    simulationId: string;
    leaderId: string;
    seed: number;
    startTime: number;
    currentTime: number;
    currentTurn: number;
  };
  agents: Agent[];  // single synthetic agent with all HEXACO + lifecycle fields
  eventLog: [];
}
```

For each `world.<bag>` declaration, map over the metric definitions and populate the fixture keyed by `metric.id` with `metric.initial` (or a type-appropriate default: `0` for `number`, `""` for `string`, `false` for `boolean`, if initial is absent). Honor the scenario's `setup.defaultStartTime` and `setup.defaultTimePerTurn` for the metadata block.

Produces a fixture that (a) contains every key a correctly-written hook would reference and (b) throws TypeError on any nested access that doesn't match the declared shape.

### Per-generator prompt hardening

Each of these `buildSystemBlock()` functions gets a mandatory new section:

- `generate-prompts.ts` (department prompt hook)
- `generate-politics.ts` (politics delta hook)
- `generate-reactions.ts` (reaction context hook)
- `generate-fingerprint.ts` (timeline fingerprint hook)
- `generate-milestones.ts` (milestone event hook — no `ctx.state` access today, but the prompt hardening around `labels.timeUnitNoun` applies)

New section template added to every prompt:

```
AVAILABLE STATE SHAPE (read-only, flat):

state.systems = Record<string, number>
  keys: ${scenarioJson.world.metrics.keys.join(', ')}
state.capacities = Record<string, number>
  keys: ${scenarioJson.world.capacities.keys.join(', ')}
state.politics = Record<string, number | string | boolean>
  keys: ${scenarioJson.world.politics.keys.join(', ')}
state.statuses = Record<string, string | boolean>
  keys: ${scenarioJson.world.statuses.keys.join(', ')}
state.environment = Record<string, number | string | boolean>
  keys: ${scenarioJson.world.environment.keys.join(', ')}
state.metadata = { simulationId, leaderId, seed, startTime, currentTime, currentTurn }

RULES:
- All five bags are flat. Access is `state.<bag>.<key>` — no deeper nesting.
- `state.systems.hull` is a number, not an object. Do not write
  `state.systems.hull.integrity` or similar two-level paths.
- Only use keys listed above. Other keys are not guaranteed to exist
  and will throw at validation or runtime.
- Time is measured in `${scenarioJson.labels.timeUnitNoun ?? 'tick'}`
  units. Use that vocabulary in any user-visible strings this hook
  emits.
```

Generators that don't receive `ctx.state` (e.g. `generate-milestones.ts` which only sees `turn` + `maxTurns`) still get the `labels.timeUnitNoun` line; the state-shape block is omitted.

### Retry feedback: `generateValidatedCode`

Current signature at `src/engine/compiler/llm-invocations/generateValidatedCode.ts`:

```typescript
generateValidatedCode<Fn>({
  generateText, systemPrompt, userPrompt, parse, smokeTest,
  fallback, fallbackSource, hookName, maxRetries, ...
})
```

Add: when the smokeTest throws on attempt N < maxRetries-1, capture `err.message` and append it to the user-prompt on the next attempt:

```typescript
const retryPrompt = attempt === 0
  ? opts.userPrompt
  : `${opts.userPrompt}

Previous attempt failed validation with: ${lastReason}

Regenerate the function. The error message above indicates which key
access was invalid. Only reference keys listed in the AVAILABLE STATE
SHAPE section of the system prompt.`;
```

The LLM now has concrete corrective signal. No change to retry count or fallback behavior.

### Cache bump

`src/engine/compiler/cache.ts`:
- `COMPILE_SCHEMA_VERSION: 4 → 5`
- Changelog entry at top of the file noting: "v5 (2026-04-23): compiler prompts declare flat state shape; smokeTest fixtures derived from the scenario's own world declarations. Every cached hook regenerates on next compile."

---

## Data flow

```
compileScenario(worldJson)
  │
  ├── buildScenarioFixture(worldJson) ──┐
  │                                     │
  └── for each generator:                │
        buildSystemBlock(worldJson) ◄───┤ (prompt with declared key list)
        generateValidatedCode({          │
          smokeTest: fn => fn(fixture) ◄─┘ (runs hook against scenario fixture)
          parse, fallback, ...
        })
          │
          └── on smokeTest throw:
                retry with lastReason appended to user prompt
          └── on max-retry exhausted:
                fall back to safe no-op
```

Fixture is built once per `compileScenario()` call and shared across all six generators. Each generator's smokeTest injects it into the right signature (progression hook vs prompt hook vs politics hook etc.).

---

## Error handling

- **`buildScenarioFixture` input validation:** scenarios without `world.metrics` throw `Error('buildScenarioFixture: scenario missing world.metrics declaration')` immediately. Post-0.5.0 scenarios all carry `world.*` bags; a missing one indicates malformed input and should surface fast rather than silently falling back to a stale Mars fixture.
- **LLM gives unparseable output:** handled by existing `parse` step returning null; retry loop continues.
- **Fixture missing a key the hook legitimately needs:** if a hook throws and the error mentions a key declared in `world.metrics` but missing from the fixture, the fixture builder had a bug — log it as a compiler bug and surface in telemetry.
- **Fallback still triggered after max retries:** existing behavior (fallback to no-op), but `fallbackReason` now carries the structured `lastReason` for easier debugging.

---

## Testing

### Unit tests

- `tests/engine/compiler/scenario-fixture.test.ts` — new:
  - Builds fixture from `marsScenario`, `lunarScenario`, `scenarios/corporate-quarterly.json`, and a hand-rolled minimal submarine scenario. Asserts every key declared in each scenario's `world.*` bags shows up in the fixture with type-correct initial value.
  - Edge case: scenario with empty `world.statuses` → fixture has `statuses: {}` (not undefined).
- `tests/engine/compiler/generate-prompts.test.ts` (extend existing) — feed a synthetic scenario with a distinctive metric key (`hullIntegrity: 85`), assert the generated prompt's "AVAILABLE STATE SHAPE" section lists `hullIntegrity` exactly.

### Integration tests

- `tests/engine/compiler/retry-feedback.test.ts` — new:
  - Mock `generateText` to emit a hook body referencing a nonexistent `state.systems.xyz.foo` on attempt 1, and a valid hook on attempt 2. Assert `generateValidatedCode` calls `generateText` twice, the second call's user prompt contains `"Previous attempt failed validation"`, and the second-attempt hook returns successfully.

### Real-LLM smoke (manual, not CI)

- Re-compile the Mars scenario with the new prompts against `gpt-5.4-nano`. Verify the generated hooks remain structurally equivalent to the current Mars baseline (no accidental quality regression). Ballpark $0.10.
- Compile the `corporate-quarterly.json` scenario fresh (after cache bust from v5 bump). Run the F23.2 smoke (already shipped). Expect pass. Ballpark $0.50.

### Existing tests

- `tests/engine/compiler/cache-version-bust.test.ts` — update to assert v4 manifest → null after bump to v5.
- All existing `generate-*.test.ts` suites should pass unchanged since the smokeTest fixture's Mars defaults remain reachable through `buildScenarioFixture(marsScenario)`.

---

## Acceptance criteria

- `tsc --noEmit -p tsconfig.build.json` exit 0.
- `npm test` passes at or above current baseline (add the new tests; no regressions in existing suites).
- Re-compiling Mars via `bun scripts/smoke-mars-compile.ts` (or existing equivalent) still produces hooks that pass all existing suites — no quality regression.
- User's original scenario (whatever declares `hull` as a metric) no longer throws at event time; a fresh compile produces a hook whose smokeTest either passes (access `state.systems.hull` as a number) or fails all retries and falls back to a safe no-op without runtime crash.
- `COMPILE_SCHEMA_VERSION === 5` shipped and documented.

---

## Rollback

`git revert` the three commits (`feat(compiler)`, `test(compiler)`, `chore(release)`). Cached hooks on user disks regenerate harmlessly on next `compileScenario()` call. No persistent state affected.

---

## Follow-ups (deferred)

- **AST-level blacklist of two-level state access.** Too brittle for this pass; revisit if scenario-fixture validation proves insufficient.
- **Hook-level runtime try/catch per department** in the orchestrator. Partially covered by the event-loop catch improvement in commit `4d85244c`; full hook-by-hook wrapping is nice-to-have but not urgent.
- **Compiler telemetry.** Add per-generator attempt-count + fallback-rate metrics to `/retry-stats`. Useful for quantifying whether the prompt hardening actually reduces retry pressure.
- **Scenario author docs.** A short page explaining the flat state contract so authors understand what the LLM sees, added to the main README / API reference.
