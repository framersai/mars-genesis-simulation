# Design: 2026-04-25 hotfix bundle + T5.1 dashboard viz kit

**Date:** 2026-04-25
**Status:** Draft pending user approval.
**Predecessor:** [`2026-04-23-structured-world-model-positioning-design.md`](2026-04-23-structured-world-model-positioning-design.md), [`2026-04-24-paracosm-init-cli-design.md`](2026-04-24-paracosm-init-cli-design.md), [`2026-04-24-simulate-endpoint-design.md`](2026-04-24-simulate-endpoint-design.md), [`2026-04-24-state-systems-metrics-rename-design.md`](2026-04-24-state-systems-metrics-rename-design.md).
**Audit reference:** `SESSION_2026-04-24_FULL_AUDIT.md` is the prior session's audit. The 2026-04-25 audit pass exposed five regressions and one shipped feature that does not run. This spec is the corrective bundle plus the next planned feature (T5.1 viz kit) so they ship as one coherent push.

---

## 1. Problem

Five regressions slipped past the 2026-04-24 verification surface, and one feature shipped as broken-in-production:

| # | Severity | Where | What |
|---|---|---|---|
| 1 | BLOCKING | `src/cli/init-templates.ts` + `src/cli/init.ts` | `paracosm init` scaffolds a project that fails `npm install` (paracosm pinned to non-existent `^1.0.0`) and whose `run.mjs` fails on first execution (wrong `runSimulation` signature: positional args inverted, `mode` field that does not exist, `turns` instead of `maxTurns`). |
| 2 | HIGH | `src/cli/simulate-route.ts` + `src/cli/server-app.ts` | `POST /simulate` reads `X-API-Key` and `X-Anthropic-Key` headers, threads them as `deps.userApiKey` / `deps.userAnthropicKey`, and passes them to `runSimulation` options. `RunOptions` does not declare these fields and the orchestrator does not scope them into `process.env` before calling LLM providers. The keys are silently dropped; the host's keys are billed. The rate-limiter still bypasses on key presence, so users billing the host are also rate-limit-exempt. |
| 3 | HIGH | 8 test fixtures across `tests/runtime/`, `tests/engine/core/`, `tests/engine/mars/`, `tests/engine/lunar/`, `tests/engine/schema/`, `tests/engine/compiler/`, `tests/engine/integration.test.ts` | T4.5 renamed runtime field `state.systems` to `state.metrics`. The 11 test fixtures listed in §3.3 still use `systems:`. They fail with `Cannot read properties of undefined`. The 2026-04-24 audit's curated test list bypassed every one of them; `npm test` exposes 11 fails out of 717. |
| 4 | MEDIUM | `docs/ARCHITECTURE.md` lines 203-208, `docs/positioning/world-model-mapping.md` pillar #6 | T4.1 corrected three lies in `packages/agentos/docs/architecture/EMERGENT_CAPABILITIES.md`: "isolated V8 context" became "hardened node:vm context", "Memory: 128 MB" became "Memory observed (heap delta heuristic, NOT preempted)". The matching paracosm docs were not swept. They now contradict the upstream documentation. |
| 5 | LOW | `src/engine/world-model/` | Empty directory. The 2026-04-23 spec proposed the facade live at `engine/world-model/index.ts`. The implementation correctly lives at `runtime/world-model/index.ts` (it depends on `runSimulation`). The empty engine directory is a leftover and confuses readers. |
| 6 | LOW | `docs/superpowers/SESSION_2026-04-24_FULL_AUDIT.md` | The audit names `ca5446c9` as paracosm HEAD; actual is `a5e6364e` (the audit doc itself plus a dependency-bump commit landed after). It also names `@framers/agentos@0.2.6` as latest; actual npm is `0.2.11`. |

The shipped T5.1 dashboard viz kit (§3 of [`NEXT_SESSION_2026-04-25_HANDOFF.md`](../NEXT_SESSION_2026-04-25_HANDOFF.md)) is the planned next user-facing feature. It is bundled with the hotfixes here because (a) Phase 0 is half a day, (b) shipping the viz kit on top of a broken `paracosm init` weakens the public-showcase narrative the work is meant to support, and (c) the same em-dash / tsc / test-suite verification gates run once instead of twice.

## 2. Goals

1. Every numbered finding in §1 has a fix that lands in this push.
2. The `paracosm init` command produces a project where `npm install && node run.mjs` runs to a successful first turn against the host's API key.
3. `POST /simulate` with a valid `X-API-Key` header bills the supplied key, not the host's.
4. `npm test` reports zero failures (717 / 717 pass at the end of the push, modulo pre-existing skips).
5. The four T5.1 viz components render the three modes correctly in the dashboard. Batch-trajectory and batch-point produce trajectory strips and timepoint cards rather than empty cards.
6. Every doc surface that mentions the sandbox uses the corrected vocabulary.
7. tsc passes on root and build configs (already passing, must stay).

Out of scope, by design:

- T5.4 paracosm/digital-twin subpath, T5.5 WorldModel.replay, T6.x audit-track tests, T7.x ecosystem adapters, T8.x docs items. Each is its own design pass after this lands.
- New simulation modes, kernel changes, or schema bumps. The viz kit consumes the existing `metadata.mode` discriminator on `RunArtifact`; no schema change.
- Mobile responsiveness audit (T8.5 territory).
- Animation, drilldown modals, export buttons on the viz components (v2).
- Adversarial sandbox tests beyond what agentos already ships.

## 3. Phase 0: Hotfix bundle

### 3.1 `paracosm init` correctness (BLOCKING)

Three fixes, plus one new test that would have caught the regression:

**3.1.1 Default `paracosmVersion` to the actual published version.**

`src/cli/init.ts:237` currently:

```ts
const paracosmVersion = deps.paracosmVersion ?? '1.0.0';
```

Replace with a read of the running package's own `package.json`:

```ts
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function readOwnVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli/init.js -> ../../package.json. src/cli/init.ts (tsx) -> ../../package.json.
  // Both resolve to the same package.json since the build mirrors src/.
  const pkgPath = resolve(here, '../../package.json');
  const raw = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    throw new Error('paracosm package.json is missing a version field');
  }
  return raw.version;
}

const paracosmVersion = deps.paracosmVersion ?? readOwnVersion();
```

The deps escape hatch stays so test files can pass `paracosmVersion: '1.2.3'` without filesystem reads.

**3.1.2 Generate a correct `run.mjs`. Drop the inert `mode` field from `RunMjsInput`.**

`src/cli/init-templates.ts:38` `renderRunMjs`. The `mode` field on `RunMjsInput` was previously embedded as a literal in the template's `runSimulation` call. Since `runSimulation` does not accept a `mode` parameter (mode is a property of the produced `RunArtifact.metadata`, not a runtime input), the field is removed entirely from `RunMjsInput`. Callers in `init.ts` drop the `mode: opts.mode` argument:

```ts
export function renderRunMjs(input: RunMjsInput): string {
  return `#!/usr/bin/env node
/**
 * Entry script for a paracosm-init scaffolded project.
 *
 * Reads scenario.json + leaders.json from this directory, runs the
 * configured leader at index 0 against turn-loop mode, and prints the
 * RunArtifact. Edit the leader index or runtime options to explore.
 *
 * The "mode" of the simulation is a property of the produced artifact
 * (RunArtifact.metadata.mode), not a runtime input. turn-loop is the
 * default (and only) mode runSimulation produces today; batch-trajectory
 * and batch-point are produced by runBatch with the appropriate config.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSimulation } from 'paracosm/runtime';

const here = dirname(fileURLToPath(import.meta.url));
const scenario = JSON.parse(readFileSync(resolve(here, 'scenario.json'), 'utf-8'));
const leaders = JSON.parse(readFileSync(resolve(here, 'leaders.json'), 'utf-8'));

if (!Array.isArray(leaders) || leaders.length === 0) {
  console.error('leaders.json is empty. Re-run \`paracosm init\` to regenerate.');
  process.exit(1);
}

const leader = leaders[0];

const result = await runSimulation(leader, [], {
  scenario,
  maxTurns: 6,
  seed: 42,
});

console.log(JSON.stringify(result, null, 2));
`;
}
```

Three changes from the broken version:

- Import path is `paracosm/runtime`, not `paracosm`. The root export ships engine types only; `runSimulation` is at `paracosm/runtime`. The package.json exports map confirms this.
- `runSimulation(leader, [], opts)` positional signature.
- `maxTurns: 6` not `turns: 6`.

`RunMjsInput.mode` is removed; `init.ts` drops the `mode: opts.mode` argument when calling `renderRunMjs`. The init-templates.test.ts assertion at line 22 ("mode literal must appear") gets replaced with an assertion that `runSimulation(leader` (positional, no options object as first arg) appears in the generated text and `maxTurns:` appears.

**3.1.3 Add a generated-project end-to-end test.**

New test file `tests/cli/init-generated-project.test.ts`. It runs `runInit` against a temp dir with stubbed compileFromSeed + generateQuickstartLeaders, then:

- Parses `package.json` and asserts `dependencies.paracosm` matches the regex `^\\^\\d+\\.\\d+\\.\\d+`. Verifies the version is real, not a literal `1.0.0`.
- Imports `run.mjs` as a module via `await import(toFileUrl(runMjsPath))` with a stubbed `paracosm/runtime` (vitest-style `__mocks__` or a tsx import-resolver hook). Asserts no `TypeError` from a missing field. Asserts `runSimulation` was called with three positional arguments and an options object whose first key is `scenario`.

This test would have caught both bugs in 3.1.1 and 3.1.2. Without it, the existing init-templates.test.ts only checks substring presence, which is necessary but not sufficient.

### 3.2 `/simulate` BYO-key scoping (HIGH)

Apply the same env-scoping pattern the `/compile` route uses. `src/cli/server-app.ts:1035` already calls `scopeCompileKey('OPENAI_API_KEY', apiKey)`. The `/simulate` route at `src/cli/server-app.ts:962-975` builds the deps object and never scopes.

**Fix**, scope user keys before `handleSimulate` and unscope after:

```ts
// In server-app.ts at the /simulate handler (around line 962)
const restoreOpenai = scopeRunKey('OPENAI_API_KEY', userApiKey);
const restoreAnthropic = scopeRunKey('ANTHROPIC_API_KEY', userAnthropicKey);
try {
  const deps: SimulateDeps = {
    compileScenario: (raw, opts) => {
      const userCompile = options.compileScenario;
      if (userCompile) return userCompile(raw, opts as Record<string, unknown>);
      return compileScenarioReal(raw, opts);
    },
    runSimulation: async (leader, keyPersonnel, runOpts) => {
      const { runSimulation } = await import('../runtime/orchestrator.js');
      return runSimulation(leader, keyPersonnel, runOpts);
    },
    // userApiKey / userAnthropicKey removed from SimulateDeps. The
    // simulate route has no further use for them once the env is scoped;
    // keeping them on the deps interface is a footgun (a future consumer
    // who reads them in handleSimulate would expect them to do
    // something, but they cannot, since RunOptions does not declare them).
  };
  await handleSimulate(req, res, body, deps);
} finally {
  restoreOpenai();
  restoreAnthropic();
}
```

`scopeRunKey` is a sibling of `scopeCompileKey` in `sim-config.ts`. If it does not exist already, factor `scopeCompileKey` into the generic shape:

```ts
export function scopeKey(envVar: string, value?: string): () => void {
  if (!value) return () => {};
  const prior = process.env[envVar];
  process.env[envVar] = value;
  return () => {
    if (prior === undefined) delete process.env[envVar];
    else process.env[envVar] = prior;
  };
}
```

Then `scopeCompileKey` and `scopeRunKey` are one-liners on top of `scopeKey`.

**Test additions in `tests/cli/simulate-route.test.ts`:**

- "user API keys scope OPENAI_API_KEY env var across the runSimulation call." Stub `runSimulation` to read `process.env.OPENAI_API_KEY` and assert it equals the supplied X-API-Key for the duration of the call.
- "OPENAI_API_KEY restores its prior value after handleSimulate returns."
- "anthropic key works in parallel with openai key."

Drop the existing test at line 151 ("user API keys from deps are threaded into runSimulation options"). It locks broken behavior. The replacement tests above lock the correct behavior.

**Update `SimulateDeps`:** remove `userApiKey?: string` and `userAnthropicKey?: string`. The interface no longer carries them since the env-var scoping happens in the server-app caller, not in the route handler. The route handler's job is to validate request shape and dispatch; the caller's job is to pre-condition the environment.

### 3.3 Test fixture renames `systems:` -> `metrics:` (HIGH)

11 occurrences across 8 test files. All 11 are object-literal property names inside the test fixture argument to a function expecting `WorldMetrics`-shaped data. None are real `system` references; they are stale local fixtures the T4.5 sweep missed because they live inside `as any`-cast blocks that the compiler does not type-check.

| File | Line(s) | Fix |
|---|---|---|
| `tests/runtime/sse-envelope.test.ts` | 41, 61, 78 | `data: { systems: {...} }` -> `data: { metrics: {...} }` |
| `tests/engine/core/progression.test.ts` | 12 | `systems: { ... }` block in fixture object becomes `metrics: { ... }` |
| `tests/engine/lunar/index.test.ts` | 74 | same as above |
| `tests/engine/integration.test.ts` | 83 | same as above |
| `tests/engine/schema/stream-event.test.ts` | 94, 119, 154 | `data: { systems: ... }` -> `data: { metrics: ... }` (and fix the 154 line where the test asserts a "bad" event shape; if the assertion is "missing `metrics` should fail validation," update accordingly) |
| `tests/engine/mars/fingerprint.test.ts` | 7, 22, 42 | `systems:` block in finalState fixture |
| `tests/engine/compiler/integration.test.ts` | 209 | same pattern |
| `tests/engine/mars/prompts.test.ts` | 11, 26, 41 | same pattern |

**Procedure:**

1. Single sed sweep with the literal token: `perl -i -pe 's/\bsystems:/metrics:/g' <each file>`. Audit the diff before commit; sed will not over-match because the surrounding context is always object-literal.
2. Run the full `npm test`. Confirm 0 failures. The two `progressBetweenTurns` and two `computeGameState` failures should clear too, since they failed for the same shape reason.
3. Re-run `node --import tsx --test 'tests/**/*.test.ts'` to confirm.

### 3.4 Sandbox vocabulary in paracosm docs (MEDIUM)

`docs/ARCHITECTURE.md` lines 203-208 currently:

> 3. The `SandboxedToolForge` executes the code in an isolated V8 context with hard resource limits:
>    - Memory: 128 MB
>    - Timeout: 10 seconds

Replace with the corrected vocabulary mirrored from `packages/agentos/docs/architecture/EMERGENT_CAPABILITIES.md`:

> 3. The `SandboxedToolForge` delegates to a hardened node:vm context with these guarantees:
>    - Wall-clock timeout enforced via `vm.runInContext` (default 10 seconds, configurable via `sandboxTimeoutMs`).
>    - Memory observed via `process.memoryUsage().heapUsed` delta (heuristic, not preempted; the default `sandboxMemoryMB: 128` is a soft monitoring target, not a hard cap).
>    - `codeGeneration: { strings: false, wasm: false }` blocks `eval` and `Function()` reflection.
>    - Frozen `console`, explicit-undefined for `process`, `globalThis`, `require`, `setTimeout`, `setInterval`, `fetch`.
>    - Realm intrinsics (`Reflect`, `Proxy`, `WebAssembly`, `SharedArrayBuffer`, `Atomics`) blocked at the context-construction level.

`docs/positioning/world-model-mapping.md` pillar #6 currently:

> Execution in a V8 isolate, 128 MB / 10 s sandbox.

Replace with:

> Execution in a hardened node:vm context (timeout-bounded, codeGeneration-blocked, realm-intrinsics-blocked).

`README.md` does not describe the sandbox at the architecture level, only at the feature level. No change needed to README. Sweep grep for `isolated V8\|V8 isolate\|128 MB`:

```bash
cd apps/paracosm
grep -rn "isolated V8\|V8 isolate\|128 MB" docs/ README.md src/
```

Each remaining match gets replaced with the corrected phrasing or deleted if it is purely a documentation claim with no operational meaning.

### 3.5 Empty directory cleanup (LOW)

`src/engine/world-model/` is empty. Delete the directory. No code references it. The `package.json` exports map already points to `dist/runtime/world-model/index.js` (the actual file location). No additional change needed.

### 3.6 Audit doc currency (LOW)

Two options:

A. Update `SESSION_2026-04-24_FULL_AUDIT.md` in place to match current state (HEAD a5e6364e, agentos 0.2.11, full test 717-11=706 pass).
B. Leave it as historical and write `SESSION_2026-04-25_AUDIT.md` documenting the regression discovery + this hotfix bundle.

Recommendation: B. The 2026-04-24 doc is a record of what that session believed it shipped. Editing it post-hoc loses the historical signal. The 2026-04-25 doc explains "what we believed shipped vs what shipped, and why the verification surface missed it."

This spec produces the 2026-04-25 audit doc as its first artifact in the execution order (§7 below), so the new doc is committed before any code change.

## 4. Phase 1: T5.1 dashboard viz kit

The full scope is in §3 of [`NEXT_SESSION_2026-04-25_HANDOFF.md`](../NEXT_SESSION_2026-04-25_HANDOFF.md). This section adds the integration details and tests omitted there.

### 4.1 File structure

```
src/cli/dashboard/src/components/viz/kit/
  TimepointCard.tsx + .module.scss + .test.tsx
  HealthScoreGauge.tsx + .module.scss + .test.tsx
  RiskFlagList.tsx + .module.scss + .test.tsx
  TrajectoryStrip.tsx + .module.scss + .test.tsx
  shared/
    metric-color.ts + .test.ts
    format-metric.ts + .test.ts
    types.ts
  index.ts (barrel)
```

### 4.2 Component API contracts

**`<TimepointCard>`**

```ts
interface TimepointCardProps {
  timepoint: number;              // turn or batch-trajectory time index
  mode: 'turn-loop' | 'batch-trajectory' | 'batch-point';
  metrics: Record<string, number>;
  highlights?: string[];
  riskFlags?: RiskFlag[];
  className?: string;
}
```

Renders: timepoint label ("Turn 3" / "T+12mo" / "Forecast Q3" depending on `mode`), top-3 metrics rendered as mini `<HealthScoreGauge variant="linear" size="sm" />`, highlights as bullet list, riskFlags as a horizontal `<RiskFlagList expandable={false}>`.

The mode-discriminated label is the only mode-aware logic in the component. Everything else is mode-neutral. This keeps the consumer-side branching in `ReportView.tsx` rather than each viz component.

**`<HealthScoreGauge>`**

```ts
interface MetricSpec {
  id: string;
  label: string;
  unit?: 'pct' | 'count' | 'currency' | 'time' | string;
  range: [number, number];
  thresholds?: { warn?: number; critical?: number };
  inverted?: boolean;
}

interface HealthScoreGaugeProps {
  spec: MetricSpec;
  value: number;
  variant?: 'radial' | 'linear';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

Renders: SVG arc (radial) or filled bar (linear). Color from `metric-color.ts` using `value`, `spec.range`, `spec.thresholds`, `spec.inverted`. Label below, value formatted by `format-metric.ts`. Pure SVG, no chart library.

**`<RiskFlagList>`**

```ts
interface RiskFlag {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  detail?: string;
  source?: string;
}

interface RiskFlagListProps {
  flags: RiskFlag[];
  expandable?: boolean;
  className?: string;
}
```

Renders: vertical list of pills sorted by severity (critical > high > medium > low). Color-coded via `metric-color.ts`. When `expandable`, click toggles `detail` panel below the pill.

**`<TrajectoryStrip>`**

```ts
interface TrajectoryStripProps {
  timepoints: Array<{
    label: string;
    metrics: Record<string, number>;
    riskFlags?: RiskFlag[];
  }>;
  primaryMetric: MetricSpec;
  width?: number;
  height?: number;
  className?: string;
}
```

Renders: horizontal SVG strip with N timepoint columns. Primary metric drawn as a polyline across columns. Risk flags as colored dots above their column. Mini `<TimepointCard>` per column on hover.

### 4.3 Integration

**`src/cli/dashboard/src/components/reports/ReportView.tsx`**: today the report only renders cleanly for `mode === 'turn-loop'`. Add two branches:

- `mode === 'batch-trajectory'`: render `<TrajectoryStrip timepoints={artifact.trajectory.timepoints} primaryMetric={primaryMetricSpec} />` followed by a grid of `<TimepointCard>` instances, one per timepoint.
- `mode === 'batch-point'`: render a single `<TimepointCard timepoint={0} mode="batch-point">` with the forecast point's metrics + risk flags.

The existing `mode === 'turn-loop'` branch keeps its existing rendering. Optional: replace its inline metric display with `<HealthScoreGauge>` for visual consistency, but only after the batch modes are working.

`primaryMetricSpec` resolution: every scenario contract carries a `metrics[]` array of `MetricSpec`-shaped definitions. The first entry is the canonical "primary" by convention (`scenarios/mars-genesis.json` puts `population` first, `scenarios/lunar-outpost.json` puts `oxygenReserveDays` first). When a scenario does not declare a primary, fall back to whichever metric varies most across the timepoints (max range / mean ratio).

**`src/cli/dashboard/src/components/quickstart/QuickstartResults.tsx`**: optional preview of `<TimepointCard>` per leader result to make Quickstart output match the post-fork experience.

**`src/cli/dashboard/src/components/sim/EventCard.tsx`**: optional, swap inline metric display for `<HealthScoreGauge>`. Skip if it expands the diff beyond what is reviewable.

### 4.4 Testing

| File | What it locks |
|---|---|
| `metric-color.test.ts` | Color buckets respect threshold + inversion at min, max, warn, critical, mid. Inverted metric reverses the scale. |
| `format-metric.test.ts` | Each unit formats as expected (pct -> "85%", count -> "1,200", currency -> "$1.2M", time -> "Q3 2027"). NaN / null returns "—" without crashing. |
| `TimepointCard.test.tsx` | Renders `mode === 'turn-loop'` with "Turn N" label; `mode === 'batch-trajectory'` with "T+N" label; `mode === 'batch-point'` with "Forecast" label. Top-3 metric selection picks the three with the largest distance from threshold. Empty `highlights` / `riskFlags` render no extra DOM. |
| `HealthScoreGauge.test.tsx` | radial vs linear variants render distinct DOM shapes. Threshold colors pick correctly. Inverted metric inverts color direction. `size: 'sm'` vs `'lg'` produce different SVG dimensions. |
| `RiskFlagList.test.tsx` | Sort by severity with critical first. Click-to-expand shows `detail` only when `expandable: true`. Empty flags array renders an empty-state placeholder, not nothing. |
| `TrajectoryStrip.test.tsx` | N columns rendered for N timepoints. Primary metric polyline has N points. Risk dots positioned at the right column index. Hover handler fires on column mouseover. |

The dashboard already uses `@testing-library/react`-style assertions in `tests/cli/dashboard/`. Confirm the dep resolves; if not, lighter `render-to-string` + DOM string assertions suffice for the snapshot-shaped tests.

### 4.5 Mode-aware copy

The dashboard's existing `useScenarioLabels()` hook produces `populationNoun` / `settlementNoun` / `timeUnitNoun` from the active scenario. The viz kit reads these for any user-facing string ("3 colonists at risk", "kingdom morale at 65%"). No new label vocabulary is introduced; viz is purely a presentation refactor.

## 5. Out of scope (explicit list)

- T5.4 `paracosm/digital-twin` subpath
- T5.5 `WorldModel.replay`
- T6.1 fast-check property tests on kernel reproducibility
- T6.2 schema breaking-change CI gate
- T6.3 + T6.4 Mars + Lunar real-LLM smoke scripts
- T7.x ecosystem adapters (LangGraph, CrewAI, OpenTelemetry, W&B)
- T8.x docs (cookbook, hook authoring, perf tuning, counterfactual methodology)
- New simulation modes
- New scenario examples (corporate-strategy / policy-rollout / game-design-playtest are deferred to the use-case showcase phase)
- Animation / drilldown / export buttons on viz components
- Mobile responsiveness audit
- Schema bump (no `COMPILE_SCHEMA_VERSION` change)
- Edits to old blog posts, old specs, or old plans

Each deferred item gets its own design pass. None block this push.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `readOwnVersion` fails when paracosm is run from a tarball install where `package.json` does not sit at the expected relative path | The lookup uses `import.meta.url` plus a fixed `../../package.json` traversal that works for both tsx (src/) and dist/ layouts. New init-flow test asserts the resolved version matches `paracosm/package.json` so a layout regression fails fast. |
| Env-var scoping leaks across concurrent /simulate requests | Scoping happens inside a `try / finally` block per request. Two concurrent `/simulate` requests scoping the same env var are an existing footgun in `/compile` too; this push does not solve it, only matches the existing pattern. A follow-up that switches to per-LLM-call provider config is a separate spec. |
| `systems:` -> `metrics:` sed sweep over-matches a string literal | The substitution regex anchors on `\bsystems:` (word-boundary, colon required). Five-minute review of the diff before commit catches any over-match. The test suite is the second backstop: a wrongly-renamed identifier fails compile or fails the test. |
| The new init-generated-project test requires importing user-generated code | Test imports the rendered `run.mjs` string text and asserts shape via regex / AST parse, not by executing it. Avoids a second dependency on the `paracosm/runtime` import resolving in a tmp dir. |
| Viz kit components depend on chart library; bundle inflates | Pure SVG, no chart lib. `<HealthScoreGauge>` is a single SVG arc / rect. `<TrajectoryStrip>` is a polyline. Bundle delta target: under 8 KB gzipped for the kit + integration. |
| `useSSE` reducer was just rewritten in T4.6; viz components consume the new event-type union | The viz components consume `RunArtifact`, not live SSE events. They are post-hoc on the completed artifact. Live updates remain through the existing SSE pipeline; viz only renders the final state. |
| Em-dash sweep misses a unicode em-dash that landed in copy/paste | Mandatory pre-commit sweep on `git diff --name-only HEAD`. Documented in §7. |
| Phase 0 hotfix bundle commit-merges with Phase 1 viz kit and bisect cannot isolate a regression | Phase 0 lands as commits 1-6 in §7 execution order; Phase 1 lands as commits 7-10. Each commit boundary corresponds to one hotfix or one viz component. Bisect resolution: 1 commit. |

## 7. Execution order

10 commits total. Each commit is independently revertable.

1. **docs(audit):** write `docs/superpowers/SESSION_2026-04-25_AUDIT.md`. Anchors the discovery.
2. **fix(cli):** init CLI `paracosmVersion` reads own `package.json`. Add `tests/cli/init-version.test.ts` that asserts the dependency string parses and is non-`1.0.0`.
3. **fix(cli):** init CLI `renderRunMjs` uses `runSimulation(leader, [], { scenario, maxTurns, seed })` with `paracosm/runtime` import. Add `tests/cli/init-generated-runmjs.test.ts` that imports the generated text and asserts against a stub `paracosm/runtime`.
4. **fix(server):** `/simulate` BYO-key scopes `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` via `scopeKey` factor of `scopeCompileKey`. Update `simulate-route.test.ts`. Drop `userApiKey` / `userAnthropicKey` from `SimulateDeps`.
5. **fix(tests):** sweep `systems:` -> `metrics:` in 8 fixture files. Confirm 11 prior failures clear.
6. **docs(arch):** correct sandbox vocabulary in `docs/ARCHITECTURE.md` and `docs/positioning/world-model-mapping.md`. Delete `src/engine/world-model/` empty dir.
7. **feat(dashboard):** viz kit primitives — `metric-color.ts`, `format-metric.ts`, `types.ts` + their tests.
8. **feat(dashboard):** `<HealthScoreGauge>` + `<RiskFlagList>` + their tests.
9. **feat(dashboard):** `<TimepointCard>` + `<TrajectoryStrip>` + their tests.
10. **feat(dashboard):** `ReportView.tsx` integration of batch-trajectory + batch-point branches. Optional preview wiring in QuickstartResults.

Verification gates between commits:

- After commit 5: `npm test` reports 717 / 717 pass.
- After commit 10: `npx tsc --noEmit` clean on root + build configs. `npm test` still 717+ pass (new viz tests add count).
- Before each commit message: em-dash sweep on `git diff --name-only HEAD`.

## 8. Success criteria

The push succeeds when all four conditions hold simultaneously:

1. **Init smoke runs end to end.** From a tmp dir, with `OPENAI_API_KEY` exported from `apps/wilds-ai/.env`, the sequence below produces a valid RunArtifact JSON to stdout. Cost: one `compileFromSeed` + one `generateQuickstartLeaders` + one short `runSimulation`. Roughly $0.20-0.30. Run once before the final commit; capture the output into the 2026-04-25 audit doc.

   ```bash
   cd /tmp && mkdir paracosm-init-smoke-$(date +%s) && cd $_
   set -a && source /Users/johnn/Documents/git/voice-chat-assistant/apps/wilds-ai/.env && set +a
   node --import tsx /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm/src/cli/run.ts \
     init smoke-app \
     --domain "Submarine crew of 8 surviving in deep ocean for 30 days. Resource pressures: oxygen, food, sanity. Three department heads (engineering, medical, navigation) with rotating shift duties." \
     --leaders 3 --force
   cd smoke-app && npm install && node run.mjs > artifact.json
   node -e "const a = JSON.parse(require('fs').readFileSync('artifact.json')); console.log('runId:', a.metadata.runId, 'mode:', a.metadata.mode, 'turns:', a.trajectory?.timepoints?.length)"
   ```

2. **BYO-key billing routes correctly.** Test asserts `process.env.OPENAI_API_KEY === supplied X-API-Key` for the duration of the `runSimulation` call inside `/simulate`. The rate-limiter's BYO-key bypass at server-app.ts no longer grants free runs against the host key.
3. **`npm test` reports zero failures.** Baseline 717 tests today (with 11 failing); after the hotfix sweep + viz additions, the count is approximately 717+24=741, all passing.
4. **Dashboard renders all three modes cleanly.** Hand-load a stored `batch-trajectory` artifact: `<TrajectoryStrip>` shows N columns with the primary metric polyline plus per-timepoint `<TimepointCard>` grid. Hand-load a stored `batch-point` artifact: single `<TimepointCard>` with forecast metrics + risk flags. Hand-load a stored `turn-loop` artifact: existing turn-by-turn rendering plus optional `<HealthScoreGauge>` upgrade for inline metrics. No empty cards. No JSON walls. No console errors.

`tsc --noEmit` clean on both configs is a continuous baseline, not a phase-gate.

## 9. Methodology invariants (carried forward)

- master branch only, never main.
- No commits or pushes without explicit user request.
- agentos / paracosm / wilds-ai are submodules: cd into each, commit, push to its origin, then bump the monorepo pointer.
- No subagents. No worktrees with submodules. No stash / reset / restore.
- Working dir for paracosm: `apps/paracosm/` always.
- No em dashes anywhere.
- HEREDOC for multi-line commit messages with single-quoted EOF.
- Per-task ~5-minute action granularity in plans. Each step has expected output.

## 10. References

- [Spec: structured world model positioning](2026-04-23-structured-world-model-positioning-design.md)
- [Spec: paracosm init CLI](2026-04-24-paracosm-init-cli-design.md)
- [Spec: simulate endpoint](2026-04-24-simulate-endpoint-design.md)
- [Spec: state.systems to state.metrics rename](2026-04-24-state-systems-metrics-rename-design.md)
- [Audit: 2026-04-24 full session](../SESSION_2026-04-24_FULL_AUDIT.md)
- [Handoff: 2026-04-25 next session](../NEXT_SESSION_2026-04-25_HANDOFF.md)
- [Positioning: world-model mapping](../../positioning/world-model-mapping.md)
- [Architecture: paracosm](../../ARCHITECTURE.md)
- [Architecture: agentos emergent capabilities](../../../../../packages/agentos/docs/architecture/EMERGENT_CAPABILITIES.md)

End of design.
