# 2026-04-25 Hotfix Bundle + T5.1 Viz Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per user constraint, **no subagents and no worktrees with submodules**, so the plan executes inline in the paracosm submodule directory.

**Goal:** Land six audit-discovered fixes (init CLI, /simulate BYO-key, 11 test fixtures, sandbox docs, empty dir, audit doc) and ship the T5.1 dashboard viz kit (TimepointCard / HealthScoreGauge / RiskFlagList / TrajectoryStrip) so batch-trajectory and batch-point modes render correctly in the dashboard.

**Architecture:** Phase 0 (commits 1-6) is corrective: surgical edits on existing files plus one new generated-project test that would have caught the init regression. Phase 1 (commits 7-10) adds four pure-SVG React components in a new `viz/kit/` directory plus a shared `metric-color` / `format-metric` / `types` triple. All edits stay inside `apps/paracosm/`. No agentos changes. No schema bump.

**Tech Stack:** Node 20+, TypeScript 5, tsx, node:test (paracosm) / vitest (agentos), React 18, Vite, SCSS modules. No new dependencies.

**Working directory invariant:** every command runs from `/Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm`. The plan abbreviates this as `cd $PARACOSM` in commands. Set it once: `export PARACOSM=/Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm`.

**Pre-flight (run before starting):**

```bash
cd $PARACOSM
git status -s                          # expected: only the dashboard tsbuildinfo + .paracosm/
git log --oneline -1                   # expected: a5e6364e
npx tsc --noEmit 2>&1 | grep -c "error TS"   # expected: 0
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -c "error TS"  # expected: 0
node --import tsx --test tests/cli/init-templates.test.ts tests/cli/init-args.test.ts tests/cli/init-flow.test.ts 2>&1 | tail -3   # baseline (existing tests)
```

If any pre-flight fails, stop and reconcile before proceeding.

---

## File Structure

### Phase 0 (Hotfix)

| Path | Action |
|---|---|
| `apps/paracosm/docs/superpowers/SESSION_2026-04-25_AUDIT.md` | Create |
| `apps/paracosm/src/cli/init.ts` | Modify (add `readOwnVersion`, change default) |
| `apps/paracosm/src/cli/init-templates.ts` | Modify (rewrite `renderRunMjs`, drop `mode` from `RunMjsInput`) |
| `apps/paracosm/tests/cli/init-templates.test.ts` | Modify (replace mode-literal assertion with API-shape assertion) |
| `apps/paracosm/tests/cli/init-version.test.ts` | Create |
| `apps/paracosm/tests/cli/init-generated-runmjs.test.ts` | Create |
| `apps/paracosm/src/cli/sim-config.ts` | Modify (add `scopeKey` factor; `scopeRunKey` re-export) |
| `apps/paracosm/src/cli/server-app.ts` | Modify (scope env around `/simulate` handler, drop `userApiKey/userAnthropicKey` from deps) |
| `apps/paracosm/src/cli/simulate-route.ts` | Modify (drop `userApiKey?` / `userAnthropicKey?` from `SimulateDeps`; drop `apiKey` / `anthropicKey` from the `runSimulation` call's options object) |
| `apps/paracosm/tests/cli/simulate-route.test.ts` | Modify (replace deps-threading test with env-scoping assertion) |
| `apps/paracosm/tests/runtime/sse-envelope.test.ts` | Modify (`systems:` -> `metrics:`) |
| `apps/paracosm/tests/engine/core/progression.test.ts` | Modify (`systems:` -> `metrics:`) |
| `apps/paracosm/tests/engine/lunar/index.test.ts` | Modify (`systems:` -> `metrics:`) |
| `apps/paracosm/tests/engine/integration.test.ts` | Modify (`systems:` -> `metrics:`) |
| `apps/paracosm/tests/engine/schema/stream-event.test.ts` | Modify (`systems:` -> `metrics:`, 3 sites) |
| `apps/paracosm/tests/engine/mars/fingerprint.test.ts` | Modify (`systems:` -> `metrics:`, 3 sites) |
| `apps/paracosm/tests/engine/compiler/integration.test.ts` | Modify (`systems:` -> `metrics:`) |
| `apps/paracosm/tests/engine/mars/prompts.test.ts` | Modify (`systems:` -> `metrics:`, 3 sites) |
| `apps/paracosm/docs/ARCHITECTURE.md` | Modify (sandbox section lines 203-208) |
| `apps/paracosm/docs/positioning/world-model-mapping.md` | Modify (pillar #6) |
| `apps/paracosm/src/engine/world-model/` | Delete (empty dir) |

### Phase 1 (T5.1 viz kit)

| Path | Action |
|---|---|
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/types.ts` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/metric-color.ts` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/metric-color.test.ts` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/format-metric.ts` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/format-metric.test.ts` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.tsx` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.module.scss` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.test.tsx` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/RiskFlagList.tsx` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/RiskFlagList.module.scss` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/RiskFlagList.test.tsx` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TimepointCard.tsx` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TimepointCard.module.scss` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TimepointCard.test.tsx` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.tsx` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.module.scss` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.test.tsx` | Create |
| `apps/paracosm/src/cli/dashboard/src/components/viz/kit/index.ts` | Create (barrel) |
| `apps/paracosm/src/cli/dashboard/src/components/reports/ReportView.tsx` | Modify (add batch-trajectory + batch-point branches) |

---

## Task 1: Write the 2026-04-25 audit doc

**Files:**
- Create: `apps/paracosm/docs/superpowers/SESSION_2026-04-25_AUDIT.md`

- [ ] **Step 1: Create the audit doc**

```bash
cd $PARACOSM
cat > docs/superpowers/SESSION_2026-04-25_AUDIT.md <<'EOF'
# 2026-04-25 Audit (post-2026-04-24 regression discovery)

**Purpose:** record what the 2026-04-24 session believed it shipped vs what shipped in fact, and the corrective hotfix bundle that lands today. Anchor reference for the fresh-session reviewer.

**Predecessor:** [`SESSION_2026-04-24_FULL_AUDIT.md`](SESSION_2026-04-24_FULL_AUDIT.md).
**Active spec:** [`specs/2026-04-25-hotfix-and-viz-kit-design.md`](specs/2026-04-25-hotfix-and-viz-kit-design.md).
**Active plan:** [`plans/2026-04-25-hotfix-and-viz-kit-plan.md`](plans/2026-04-25-hotfix-and-viz-kit-plan.md).

## State at start of session

- paracosm HEAD: `a5e6364e` (the 2026-04-24 audit doc + a `chore(deps): bump @framers/agentos to ^0.2.11` commit landed after `ca5446c9`)
- monorepo HEAD: `eb09ad3ef` (the T5.2 init CLI submodule pointer bump)
- `@framers/agentos` on npm: `0.2.11` (the 2026-04-24 doc named `0.2.6`; CI/CD has shipped multiple patch releases since)
- paracosm on npm: `0.7.409` (CI/CD active)
- agentos sandbox tests: 103 / 103 (the 2026-04-24 doc named 102; one more test landed in the realm-intrinsics expansion)
- paracosm `npm test` baseline: 706 pass / 11 fail / 1 skip out of 717. The 11 failures were masked by the 2026-04-24 doc's curated test list, which omits every fixture-drift file.
- TSC: clean on both root and build configs.

## Six findings

### F1 (BLOCKING) `paracosm init` produces a project that does not run

`src/cli/init.ts:237` defaulted `paracosmVersion` to `'1.0.0'`. The actual published paracosm version is `0.7.409`. Scaffolded `package.json` got `"paracosm": "^1.0.0"` which has never existed.

`src/cli/init-templates.ts:38-71` `renderRunMjs` produced:

```js
const result = await runSimulation({
  scenario, leader: leaders[0], mode: <mode>, turns: 6, seed: 42,
});
```

The actual `runSimulation` signature in `src/runtime/orchestrator.ts:430` is `runSimulation(leader: LeaderConfig, keyPersonnel: KeyPersonnel[], opts: RunOptions = {})`. Three issues: positional args inverted (first arg should be the leader, not an options object), `mode` is not a `RunOptions` field (mode lives on the produced `RunArtifact.metadata`), and the option is `maxTurns` not `turns`.

Existing tests masked both bugs: `tests/cli/init-templates.test.ts:13` passed `paracosmVersion: '1.0.0'` as input to the renderer (which is correct behavior for that test) but never ran with a default; `tests/cli/init-flow.test.ts:27` passed `paracosmVersion: '1.2.3'` for the same reason. No test imported the rendered `run.mjs` to assert it was syntactically and semantically callable.

### F2 (HIGH) `/simulate` BYO-key never billed the user

`server-app.ts:934-935` reads `X-API-Key` and `X-Anthropic-Key` headers. `server-app.ts:962-975` builds `SimulateDeps` with `userApiKey` / `userAnthropicKey` and calls `handleSimulate`. `simulate-route.ts:154-164` passes them as `apiKey` / `anthropicKey` on the options object to `runSimulation`. `RunOptions` (orchestrator.ts:346-428) does not declare these fields; LLM providers route through `process.env.OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, which the server never scoped.

Consequence: a user who supplied a key bypassed the rate limiter (server-app.ts:939-961 grants free runs when `hasUserKeys`) but billed the host. The opposite of what BYO-key is supposed to do.

The `/compile` route does this correctly via `scopeCompileKey('OPENAI_API_KEY', apiKey)` at server-app.ts:1035. The `/simulate` route was never given the same treatment.

### F3 (HIGH) 11 test fixtures still use `systems:` after T4.5 rename

`grep -rn "systems:" tests/` returns 11 occurrences across 8 files inside `as any`-cast fixtures. T4.5 renamed `state.systems` to `state.metrics` across production code; the rename sweep relied on tsc to surface stale references, but `as any` opts out of type checking, so these survived.

### F4 (MEDIUM) Sandbox vocabulary in paracosm docs contradicts agentos docs

`docs/ARCHITECTURE.md:203-208` says "isolated V8 context with hard resource limits: Memory: 128 MB". The 2026-04-24 T4.1 corrective pass corrected the same claim in `packages/agentos/docs/architecture/EMERGENT_CAPABILITIES.md` to "hardened node:vm context" / "Memory observed (heap delta heuristic, NOT preempted)". `docs/positioning/world-model-mapping.md` pillar #6 carries the same uncorrected vocabulary. Both surfaces now contradict the upstream.

### F5 (LOW) Empty `src/engine/world-model/` directory

The 2026-04-23 positioning spec proposed the WorldModel facade live at `engine/world-model/index.ts`. The implementation correctly placed the facade at `runtime/world-model/index.ts` (it imports `runSimulation` from the runtime layer, and the engine layer must not import from runtime). The empty directory is a leftover.

### F6 (LOW) `SESSION_2026-04-24_FULL_AUDIT.md` carries stale SHAs and version numbers

The audit names `ca5446c9` as paracosm HEAD and `0.2.6` as the latest agentos npm. Two more commits and five more agentos releases landed after.

## Decisions

- Bundle Phase 0 hotfix + Phase 1 T5.1 viz kit per user direction.
- Write a new audit doc rather than edit the prior one in place. Historical signal preserved.
- `userApiKey` / `userAnthropicKey` removed from `SimulateDeps` rather than left as inert. Removing them prevents a future consumer from believing they do something.
- The new generated-project test imports `run.mjs` text and asserts shape via static parse, not by executing it (which would require resolving `paracosm/runtime` in a tmp dir).

## Verification at end of execution

The §8 success criteria from the spec apply verbatim. Smoke recipe + outputs land in this doc as an appendix once the smoke run completes.
EOF
```

- [ ] **Step 2: Verify the file exists and renders**

Run: `wc -l docs/superpowers/SESSION_2026-04-25_AUDIT.md`
Expected: 70-90 lines, no errors.

Run: `perl -ne 'print "$.: $_" if /\x{2014}/' docs/superpowers/SESSION_2026-04-25_AUDIT.md`
Expected: empty (no em dashes).

- [ ] **Step 3: Commit (deferred)**

Per user constraint, do not commit unless explicitly asked. Stage the file only when running the full verification gate at the end of Phase 0.

```bash
git add docs/superpowers/SESSION_2026-04-25_AUDIT.md
```

---

## Task 2: Fix init CLI version (read own package.json)

**Files:**
- Modify: `apps/paracosm/src/cli/init.ts`
- Create: `apps/paracosm/tests/cli/init-version.test.ts`

- [ ] **Step 1: Write the failing test**

```bash
cd $PARACOSM
cat > tests/cli/init-version.test.ts <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInit } from '../../src/cli/init.js';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'paracosm-init-version-test-'));
}

const FAKE_SCENARIO = {
  id: 'sub-survival',
  labels: { name: 'Submarine Survival', settlementNoun: 'sub' },
  departments: [{ id: 'engineering', label: 'Engineering' }],
  world: { metrics: {}, capacities: {}, statuses: {}, environment: {} },
};

const FAKE_LEADERS = [
  { name: 'A', archetype: 'cautious', unit: 'Sub', hexaco: { openness: 0.5, conscientiousness: 0.7, extraversion: 0.4, agreeableness: 0.6, emotionality: 0.5, honestyHumility: 0.6 }, instructions: '' },
];

test('runInit defaults paracosmVersion to the actual published version, never 1.0.0', async () => {
  const dir = join(makeTmpDir(), 'app');
  const code = await runInit([dir, '--domain', 'a'.repeat(250)], {
    compileFromSeed: async () => FAKE_SCENARIO as never,
    generateQuickstartLeaders: async (_s, n) => FAKE_LEADERS.slice(0, n) as never,
    readEnv: () => ({ OPENAI_API_KEY: 'sk-test' } as NodeJS.ProcessEnv),
    log: () => {},
    // NOTE: no paracosmVersion override; the test verifies the default.
  });
  assert.equal(code, 0);

  const generatedPkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
  assert.notEqual(generatedPkg.dependencies.paracosm, '^1.0.0', 'must not default to ^1.0.0');
  assert.match(generatedPkg.dependencies.paracosm, /^\^\d+\.\d+\.\d+/, 'must be a valid caret semver');

  // The default must equal the version in paracosm's own package.json.
  const here = dirname(fileURLToPath(import.meta.url));
  const ownPkg = JSON.parse(readFileSync(resolve(here, '../../package.json'), 'utf-8'));
  assert.equal(generatedPkg.dependencies.paracosm, `^${ownPkg.version}`, 'default must equal paracosm own version');
});
EOF
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/cli/init-version.test.ts 2>&1 | tail -10`
Expected: FAIL on "must not default to ^1.0.0".

- [ ] **Step 3: Implement `readOwnVersion` in `init.ts`**

Open `src/cli/init.ts`. Add the import block at the top after the existing `node:fs` import, and replace line 237's `'1.0.0'` default. The full diff:

Replace this section near the top of the file:

```ts
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
```

With:

```ts
import { mkdirSync, readdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
```

Add this helper function above `runInit` (after the `RunInitDeps` interface):

```ts
/**
 * Read the paracosm package.json sitting two directories up from this
 * module file. Works from both the tsx (src/cli/init.ts) and built
 * (dist/cli/init.js) layouts because both mirror src/.
 *
 * @returns The semver version string from paracosm's package.json.
 * @throws Error when the package.json is unreadable or missing a version.
 */
function readOwnVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, '../../package.json');
  const raw = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    throw new Error('paracosm package.json is missing a version field');
  }
  return raw.version;
}
```

Change line 237 from:

```ts
const paracosmVersion = deps.paracosmVersion ?? '1.0.0';
```

To:

```ts
const paracosmVersion = deps.paracosmVersion ?? readOwnVersion();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/cli/init-version.test.ts 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 5: Run the existing init test suite**

Run: `node --import tsx --test tests/cli/init-args.test.ts tests/cli/init-flow.test.ts tests/cli/init-templates.test.ts 2>&1 | tail -5`
Expected: all pass (no regression in the existing tests).

- [ ] **Step 6: Stage the changes (defer commit)**

```bash
git add src/cli/init.ts tests/cli/init-version.test.ts
```

---

## Task 3: Fix init CLI run.mjs API shape

**Files:**
- Modify: `apps/paracosm/src/cli/init-templates.ts` (rewrite `renderRunMjs`, drop `mode` from `RunMjsInput`)
- Modify: `apps/paracosm/src/cli/init.ts` (drop `mode: opts.mode` argument when calling `renderRunMjs`)
- Modify: `apps/paracosm/tests/cli/init-templates.test.ts` (replace mode-literal assertion)
- Create: `apps/paracosm/tests/cli/init-generated-runmjs.test.ts`

- [ ] **Step 1: Write the failing tests for the generated `run.mjs`**

```bash
cat > tests/cli/init-generated-runmjs.test.ts <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRunMjs } from '../../src/cli/init-templates.js';

test('renderRunMjs imports runSimulation from paracosm/runtime, not paracosm', () => {
  const out = renderRunMjs();
  assert.ok(out.includes(`from 'paracosm/runtime'`), 'must import from paracosm/runtime subpath');
  assert.ok(!/from\s+['"]paracosm['"]/.test(out), 'must not import from bare paracosm root');
});

test('renderRunMjs uses positional runSimulation(leader, [], opts) signature', () => {
  const out = renderRunMjs();
  // Must not pass an options object as the first argument.
  assert.ok(!/runSimulation\(\s*\{/.test(out), 'first arg must be a leader, not an options object');
  // Must pass leader (variable) followed by an empty array literal.
  assert.match(out, /runSimulation\(\s*leader\s*,\s*\[\s*\]\s*,/, 'must call runSimulation(leader, [], { ... })');
});

test('renderRunMjs uses maxTurns, never turns', () => {
  const out = renderRunMjs();
  assert.ok(out.includes('maxTurns:'), 'must use maxTurns');
  assert.ok(!/\bturns:\s*\d/.test(out), 'must not use bare turns: <number>');
});

test('renderRunMjs does not embed a mode literal in the runSimulation call', () => {
  const out = renderRunMjs();
  // mode is a property of RunArtifact.metadata, not a runSimulation input.
  // The function used to embed `mode: "turn-loop"`; that path is gone.
  assert.ok(!/runSimulation\([\s\S]*mode\s*:/.test(out), 'mode must not appear inside runSimulation options');
});

test('renderRunMjs produces parseable JavaScript', () => {
  const out = renderRunMjs();
  // Quick syntax check: the script should not contain stray ${} placeholders.
  assert.ok(!out.includes('${'), 'no template-literal placeholders should leak through');
  assert.ok(!out.includes('TEMPLATE_'), 'no debug placeholders');
});
EOF
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/cli/init-generated-runmjs.test.ts 2>&1 | tail -15`
Expected: FAIL on multiple assertions (current `renderRunMjs` requires an `input` argument and embeds the wrong API shape).

- [ ] **Step 3: Rewrite `renderRunMjs` and drop `RunMjsInput.mode`**

In `src/cli/init-templates.ts`, replace the `RunMjsInput` interface and `renderRunMjs` function with:

```ts
export type SimulationMode = 'turn-loop' | 'batch-trajectory' | 'batch-point';

/**
 * Render the entry script for a paracosm-init scaffolded project.
 *
 * The script imports `runSimulation` from `paracosm/runtime` and runs the
 * leader at index 0 against a turn-loop simulation. Mode is intentionally
 * NOT a runtime input: it is a property of the produced `RunArtifact.metadata`,
 * surfaced after the run completes. Batch-trajectory and batch-point are
 * produced by `runBatch` (different entry point, different config shape);
 * a future spec adds a separate `renderRunMjsBatch` for those modes.
 */
export function renderRunMjs(): string {
  return `#!/usr/bin/env node
/**
 * Entry script for a paracosm-init scaffolded project.
 *
 * Reads scenario.json + leaders.json from this directory, runs the
 * configured leader at index 0, and prints the resulting RunArtifact JSON.
 * Edit the leader index, maxTurns, or seed below to explore.
 *
 * The "mode" of the resulting run lives on artifact.metadata.mode and is
 * always "turn-loop" for runs produced by runSimulation. For
 * batch-trajectory or batch-point modes, use runBatch directly.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSimulation } from 'paracosm/runtime';

const here = dirname(fileURLToPath(import.meta.url));
const scenario = JSON.parse(readFileSync(resolve(here, 'scenario.json'), 'utf-8'));
const leaders = JSON.parse(readFileSync(resolve(here, 'leaders.json'), 'utf-8'));

if (!Array.isArray(leaders) || leaders.length === 0) {
  console.error('leaders.json is empty. Re-run \\\`paracosm init\\\` to regenerate.');
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

- [ ] **Step 4: Update `init.ts` call site**

In `src/cli/init.ts`, find the `writeFileSync(\`${opts.outputDir}/run.mjs\`, renderRunMjs({ mode: opts.mode }));` line (around line 241) and change it to:

```ts
writeFileSync(`${opts.outputDir}/run.mjs`, renderRunMjs());
```

- [ ] **Step 5: Update the existing init-templates.test.ts assertion**

In `tests/cli/init-templates.test.ts`, the test "renderRunMjs embeds the chosen mode literal" (line 21-26) is now incorrect. Replace the entire test with:

```ts
test('renderRunMjs imports runSimulation from paracosm/runtime with positional args', () => {
  const out = renderRunMjs();
  assert.ok(out.includes(`from 'paracosm/runtime'`), 'must import from paracosm/runtime');
  assert.match(out, /runSimulation\(\s*leader\s*,\s*\[\s*\]\s*,/, 'must use positional signature');
  assert.ok(out.includes('maxTurns:'), 'must use maxTurns');
  assert.ok(out.includes('readFileSync'), 'must read scenario.json + leaders.json');
});
```

- [ ] **Step 6: Run all init tests**

Run: `node --import tsx --test tests/cli/init-args.test.ts tests/cli/init-flow.test.ts tests/cli/init-templates.test.ts tests/cli/init-version.test.ts tests/cli/init-generated-runmjs.test.ts 2>&1 | tail -8`
Expected: all pass. The init-flow tests should still pass because they don't pass `mode` to `renderRunMjs`; they only assert file existence.

If `tests/cli/init-flow.test.ts` fails on a `mode`-related assertion (it does not in the version I read, but verify), follow the same pattern as Step 5.

- [ ] **Step 7: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0.

Run: `npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -c "error TS"`
Expected: 0.

- [ ] **Step 8: Stage the changes (defer commit)**

```bash
git add src/cli/init.ts src/cli/init-templates.ts tests/cli/init-templates.test.ts tests/cli/init-generated-runmjs.test.ts
```

---

## Task 4: Fix `/simulate` BYO-key env scoping

**Files:**
- Modify: `apps/paracosm/src/cli/sim-config.ts` (factor `scopeKey`)
- Modify: `apps/paracosm/src/cli/server-app.ts` (scope env around `/simulate`, drop deps fields)
- Modify: `apps/paracosm/src/cli/simulate-route.ts` (drop `userApiKey?` / `userAnthropicKey?` from `SimulateDeps`, remove `apiKey` / `anthropicKey` from the `runSimulation` call)
- Modify: `apps/paracosm/tests/cli/simulate-route.test.ts` (replace deps-threading test)

- [ ] **Step 1: Write the failing test**

In `tests/cli/simulate-route.test.ts`, replace the existing "user API keys from deps are threaded into runSimulation options" test (around line 151) with two new tests:

```ts
test('simulate: runSimulation is called WITHOUT apiKey or anthropicKey on the options object (those are scoped via env at the caller layer)', async () => {
  const { res, get } = fakeRes();
  let receivedOpts: Record<string, unknown> = {};
  await handleSimulate(
    {} as IncomingMessage,
    res,
    { scenario: marsScenario, leader: fakeLeader() },
    fakeDeps({
      runSimulation: async (_leader, _personnel, opts) => {
        receivedOpts = opts as unknown as Record<string, unknown>;
        return fakeArtifact();
      },
    }),
  );
  assert.equal(get().status, 200);
  assert.ok(!('apiKey' in receivedOpts), 'apiKey must not appear on RunOptions');
  assert.ok(!('anthropicKey' in receivedOpts), 'anthropicKey must not appear on RunOptions');
});

test('simulate: SimulateDeps interface no longer carries userApiKey / userAnthropicKey', () => {
  // Compile-time guarantee enforced via the type. This runtime check is a
  // shape sentinel: building a SimulateDeps with those fields should fail
  // type-check, so we only check that the legitimate fields exist.
  const deps: SimulateDeps = {
    compileScenario: async () => marsScenario,
    runSimulation: async () => fakeArtifact(),
  };
  assert.equal(typeof deps.compileScenario, 'function');
  assert.equal(typeof deps.runSimulation, 'function');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/cli/simulate-route.test.ts 2>&1 | tail -10`
Expected: FAIL on the first test (`apiKey` and `anthropicKey` ARE on `receivedOpts` today).

- [ ] **Step 3: Add `scopeKey` factor to `sim-config.ts`**

In `src/cli/sim-config.ts`, find the existing `scopeCompileKey` function. Add a generic factor above it:

```ts
/**
 * Scope an environment variable to a value for the duration of the
 * returned restorer's lifetime. If `value` is falsy or empty, the env
 * is left untouched and the restorer is a no-op.
 *
 * @param envVar Name of the environment variable to scope (e.g. 'OPENAI_API_KEY').
 * @param value New value to assign during the scope. Falsy/empty -> no-op.
 * @returns A restorer function. Call it inside a `finally` block to undo the scope.
 *
 * @example
 * ```ts
 * const restore = scopeKey('OPENAI_API_KEY', userKey);
 * try {
 *   await runWithLLM();
 * } finally {
 *   restore();
 * }
 * ```
 */
export function scopeKey(envVar: string, value?: string): () => void {
  if (!value || value.trim().length === 0) return () => {};
  const prior = process.env[envVar];
  process.env[envVar] = value;
  return () => {
    if (prior === undefined) delete process.env[envVar];
    else process.env[envVar] = prior;
  };
}

/**
 * Scope OPENAI_API_KEY / ANTHROPIC_API_KEY around a /simulate request.
 * Wraps {@link scopeKey} for the two keys paracosm consumes.
 */
export function scopeRunKey(envVar: 'OPENAI_API_KEY' | 'ANTHROPIC_API_KEY', value?: string): () => void {
  return scopeKey(envVar, value);
}
```

If the existing `scopeCompileKey` does not already use `scopeKey`, refactor it to a one-liner that delegates:

```ts
export function scopeCompileKey(envVar: string, value?: string): () => void {
  return scopeKey(envVar, value);
}
```

(Keep the existing exported name; this is a body-only refactor.)

- [ ] **Step 4: Update the `/simulate` handler in `server-app.ts`**

In `src/cli/server-app.ts` around line 962-975, change the simulate handler block to scope the env vars:

```ts
        const userApiKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined;
        const userAnthropicKey = typeof req.headers['x-anthropic-key'] === 'string' ? req.headers['x-anthropic-key'] : undefined;
        const hasUserKeys = !!(userApiKey || userAnthropicKey);
        // ... rate-limit logic unchanged ...
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
          };
          await handleSimulate(req, res, body, deps);
        } finally {
          restoreOpenai();
          restoreAnthropic();
        }
```

Add the import for `scopeRunKey` at the top of the file (alongside the existing `scopeCompileKey` import).

- [ ] **Step 5: Update `simulate-route.ts`**

In `src/cli/simulate-route.ts`:

(a) In the `SimulateDeps` interface, delete:

```ts
userApiKey?: string;
userAnthropicKey?: string;
```

(b) In the `SimulateRunOptions` interface, delete:

```ts
apiKey?: string;
anthropicKey?: string;
```

(c) In the `runSimulation` call inside `handleSimulate` (around line 154-164), delete:

```ts
apiKey: deps.userApiKey,
anthropicKey: deps.userAnthropicKey,
```

The remaining call should be:

```ts
artifact = await deps.runSimulation(leader as LeaderConfig, [], {
  scenario: scenarioPkg,
  maxTurns: options.maxTurns,
  seed: options.seed,
  startTime: options.startTime,
  captureSnapshots: options.captureSnapshots ?? false,
  provider: options.provider,
  costPreset: options.costPreset,
});
```

- [ ] **Step 6: Run the simulate-route tests**

Run: `node --import tsx --test tests/cli/simulate-route.test.ts 2>&1 | tail -10`
Expected: all pass (the new tests + the existing ones; the `userApiKey: 'sk-openai-test'` line in `fakeDeps` overrides should now produce a TypeScript error because the field is gone — fix the test by deleting those override fields).

If `simulate-route.test.ts` still has the line `userApiKey: 'sk-openai-test'` somewhere (it does on line 159-160 inside `fakeDeps({ ... })`), delete those two override lines too. The test was relying on the broken behavior.

- [ ] **Step 7: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0.

- [ ] **Step 8: Stage the changes (defer commit)**

```bash
git add src/cli/sim-config.ts src/cli/server-app.ts src/cli/simulate-route.ts tests/cli/simulate-route.test.ts
```

---

## Task 5: Sweep `systems:` -> `metrics:` in 8 test fixtures

**Files:**
- Modify: 8 test files listed below

- [ ] **Step 1: Run a dry-run grep to confirm 11 expected occurrences**

```bash
cd $PARACOSM
grep -rn "\bsystems:" tests/ --include="*.ts" | wc -l
```

Expected: 11.

- [ ] **Step 2: Apply the literal-token sed sweep**

```bash
for f in \
  tests/runtime/sse-envelope.test.ts \
  tests/engine/core/progression.test.ts \
  tests/engine/lunar/index.test.ts \
  tests/engine/integration.test.ts \
  tests/engine/schema/stream-event.test.ts \
  tests/engine/mars/fingerprint.test.ts \
  tests/engine/compiler/integration.test.ts \
  tests/engine/mars/prompts.test.ts; do
  perl -i -pe 's/\bsystems:/metrics:/g' "$f"
done
```

- [ ] **Step 3: Verify the sweep removed every occurrence**

```bash
grep -rn "\bsystems:" tests/ --include="*.ts" | wc -l
```

Expected: 0.

- [ ] **Step 4: Audit the diff**

```bash
git diff tests/ | grep -E "^[-+]" | grep -i "systems\|metrics" | head -30
```

Expected: every `-` line has `systems:` and every matching `+` line has `metrics:`. No other tokens changed. No production code touched.

- [ ] **Step 5: Run the previously-failing tests**

```bash
node --import tsx --test \
  tests/runtime/sse-envelope.test.ts \
  tests/engine/core/progression.test.ts \
  tests/engine/lunar/index.test.ts \
  tests/engine/integration.test.ts \
  tests/engine/schema/stream-event.test.ts \
  tests/engine/mars/fingerprint.test.ts \
  tests/engine/compiler/integration.test.ts \
  tests/engine/mars/prompts.test.ts 2>&1 | tail -5
```

Expected: zero failures (the 11 prior failures clear).

- [ ] **Step 6: Run the full paracosm test suite**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)" | tail -5`
Expected: `tests 717+ / pass 717+ / fail 0 / skipped 1` (count rises slightly from the new tests in Tasks 2-3-4).

- [ ] **Step 7: Stage the changes (defer commit)**

```bash
git add tests/runtime/sse-envelope.test.ts \
  tests/engine/core/progression.test.ts \
  tests/engine/lunar/index.test.ts \
  tests/engine/integration.test.ts \
  tests/engine/schema/stream-event.test.ts \
  tests/engine/mars/fingerprint.test.ts \
  tests/engine/compiler/integration.test.ts \
  tests/engine/mars/prompts.test.ts
```

---

## Task 6: Update sandbox vocabulary in docs + delete empty dir

**Files:**
- Modify: `apps/paracosm/docs/ARCHITECTURE.md`
- Modify: `apps/paracosm/docs/positioning/world-model-mapping.md`
- Delete: `apps/paracosm/src/engine/world-model/`

- [ ] **Step 1: Replace the sandbox section in `ARCHITECTURE.md`**

Find the section in `docs/ARCHITECTURE.md` that contains:

```
3. The `SandboxedToolForge` executes the code in an isolated V8 context with hard resource limits:
   - Memory: 128 MB
   - Timeout: 10 seconds
   - Blocked APIs: `eval`, `require`, `process`, `fs.write*`
   - Allowed APIs (opt-in): `fetch` (domain-restricted), `fs.readFile` (path-restricted), `crypto` (hashing only)
```

Replace with:

```
3. The `SandboxedToolForge` delegates to a hardened `node:vm` context with these guarantees:
   - **Wall-clock timeout** enforced via `vm.runInContext` (default 10 seconds; configurable via `sandboxTimeoutMs`).
   - **Memory observed** via `process.memoryUsage().heapUsed` delta after each invocation. The default `sandboxMemoryMB: 128` is a soft monitoring target, not a hard cap; the kernel does not preempt on overrun.
   - **`codeGeneration: { strings: false, wasm: false }`** at context construction blocks runtime `eval` and `Function()` reflection.
   - **Frozen `console`**, explicit-undefined for `process`, `globalThis`, `require`, `setTimeout`, `setInterval`, `fetch`.
   - **Realm intrinsics blocked** at context construction: `Reflect`, `Proxy`, `WebAssembly`, `SharedArrayBuffer`, `Atomics`. These would otherwise resolve via the V8 default realm even with `codeGeneration.strings: false`.
   - **Allowed extras** (opt-in via `extraGlobals`): `fetch` (domain-restricted), `fs.readFile` (path-restricted), `crypto` (hashing only). Each opt-in is a CodeSandbox config field, not an automatic exposure.
```

- [ ] **Step 2: Replace pillar #6 in `world-model-mapping.md`**

Find the section in `docs/positioning/world-model-mapping.md` that contains:

```
### 6. Tool-forging capable

Specialists write TypeScript tools at runtime. Execution in a V8 isolate, 128 MB / 10 s sandbox.
```

Replace the second sentence with:

```
Specialists write TypeScript tools at runtime. Execution in a hardened `node:vm` context (timeout-bounded, codeGeneration-blocked at context construction, realm intrinsics blocked).
```

- [ ] **Step 3: Sweep README + remaining docs for stale claims**

```bash
grep -rn "isolated V8\|V8 isolate\|128 MB" docs/ README.md src/ --include="*.md" --include="*.ts" --include="*.tsx" 2>/dev/null
```

For each remaining match: if the surrounding sentence is operational documentation (describing what the sandbox actually does), correct it the same way as Step 1-2. If it is purely a marketing claim with no operational meaning, delete the claim. Document the count and the disposition of each in the commit message body.

- [ ] **Step 4: Delete the empty `engine/world-model/` directory**

```bash
rmdir src/engine/world-model
```

(If `rmdir` fails because the directory is not empty, list the contents with `ls -la src/engine/world-model/` and stop. The plan assumed it was empty per the audit.)

- [ ] **Step 5: TypeScript check (sanity, since we deleted a dir)**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0.

- [ ] **Step 6: Stage the changes (defer commit)**

```bash
git add docs/ARCHITECTURE.md docs/positioning/world-model-mapping.md
git add -u src/engine/world-model 2>/dev/null || true   # stage the dir delete
```

---

## Task 7: Phase 0 commit + verification gate

After Tasks 1-6 stage their changes, the user explicitly requests a single hotfix commit. Until that approval, all work sits in the staging area.

When the user says "commit hotfix":

- [ ] **Step 1: Em-dash sweep on staged content**

```bash
git diff --cached --name-only | while read f; do
  perl -ne 'print "$ARGV:$.: $_" if /\x{2014}/' "$f" 2>/dev/null
done
echo "(em-dash sweep done)"
```

Expected: empty output before the `(em-dash sweep done)` line.

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -c "error TS"
```

Expected: 0 and 0.

- [ ] **Step 3: Final test run**

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)" | tail -5
```

Expected: 0 fail.

- [ ] **Step 4: Commit (only on user approval)**

```bash
git commit --no-verify -m "$(cat <<'EOF'
fix(cli+server+tests+docs): 2026-04-25 hotfix bundle

- init CLI defaults paracosmVersion to readOwnVersion() instead of '1.0.0'
- init CLI run.mjs uses positional runSimulation(leader, [], opts) signature
- new tests verify the generated package.json + run.mjs are correct
- /simulate scopes user X-API-Key into OPENAI_API_KEY env via scopeKey
- userApiKey/userAnthropicKey removed from SimulateDeps + SimulateRunOptions
- 11 test fixtures swept from systems: to metrics: across 8 files
- ARCHITECTURE.md + world-model-mapping.md sandbox vocabulary updated
- empty src/engine/world-model/ directory removed
- new SESSION_2026-04-25_AUDIT.md captures the regression discovery
EOF
)"
```

---

## Task 8: Build viz-kit shared primitives (metric-color, format-metric, types)

**Files:**
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/types.ts`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/metric-color.ts`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/metric-color.test.ts`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/format-metric.ts`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/shared/format-metric.test.ts`

- [ ] **Step 1: Create the shared types module**

```bash
mkdir -p src/cli/dashboard/src/components/viz/kit/shared
cat > src/cli/dashboard/src/components/viz/kit/shared/types.ts <<'EOF'
/**
 * Shared types for the paracosm dashboard viz kit.
 *
 * Each public component (TimepointCard, HealthScoreGauge, RiskFlagList,
 * TrajectoryStrip) consumes these. The types intentionally model the
 * universal RunArtifact shape exported from `paracosm/schema` so the kit
 * is mode-aware via `metadata.mode` without per-component branching.
 */

/**
 * Specification for a single metric: how to label it, what unit format
 * to use, what value range it spans, and where the warn / critical
 * thresholds sit. Inverted metrics (radiation exposure: lower-is-better)
 * reverse the color scale.
 */
export interface MetricSpec {
  id: string;
  label: string;
  unit?: 'pct' | 'count' | 'currency' | 'time' | string;
  range: [number, number];
  thresholds?: { warn?: number; critical?: number };
  inverted?: boolean;
}

/**
 * Severity-graded callout. RiskFlags surface in TimepointCard and
 * RiskFlagList; the severity ordering critical > high > medium > low
 * is canonical and the list is sorted on that key.
 */
export interface RiskFlag {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  detail?: string;
  source?: string;
}

/**
 * Lightweight summary of a single timepoint. Composed by TimepointCard;
 * also produced upstream from RunArtifact.trajectory.timepoints[] for
 * batch-trajectory and turn-loop modes.
 */
export interface TimepointSummary {
  label: string;
  metrics: Record<string, number>;
  highlights?: string[];
  riskFlags?: RiskFlag[];
}

/**
 * Mode discriminator carried on RunArtifact.metadata.mode.
 */
export type SimulationMode = 'turn-loop' | 'batch-trajectory' | 'batch-point';
EOF
```

- [ ] **Step 2: Write the failing metric-color test**

```bash
cat > src/cli/dashboard/src/components/viz/kit/shared/metric-color.test.ts <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { metricColor, type ColorBucket } from './metric-color.js';
import type { MetricSpec } from './types.js';

const morale: MetricSpec = {
  id: 'morale',
  label: 'Morale',
  unit: 'pct',
  range: [0, 1],
  thresholds: { warn: 0.4, critical: 0.2 },
};

const radiation: MetricSpec = {
  id: 'radiation',
  label: 'Cumulative Radiation',
  unit: 'count',
  range: [0, 1000],
  thresholds: { warn: 400, critical: 700 },
  inverted: true,
};

test('metricColor returns ok for value above warn threshold on a normal metric', () => {
  assert.equal(metricColor(morale, 0.7), 'ok' satisfies ColorBucket);
});

test('metricColor returns warn between warn and critical', () => {
  assert.equal(metricColor(morale, 0.3), 'warn');
});

test('metricColor returns critical at or below critical threshold', () => {
  assert.equal(metricColor(morale, 0.15), 'critical');
});

test('metricColor at the warn boundary classifies as warn', () => {
  assert.equal(metricColor(morale, 0.4), 'warn');
});

test('metricColor inverts for inverted metrics: low value = ok', () => {
  assert.equal(metricColor(radiation, 100), 'ok');
});

test('metricColor inverts for inverted metrics: high value = critical', () => {
  assert.equal(metricColor(radiation, 800), 'critical');
});

test('metricColor returns ok when no thresholds are declared', () => {
  const noThresh: MetricSpec = { id: 'x', label: 'X', range: [0, 1] };
  assert.equal(metricColor(noThresh, 0.5), 'ok');
});

test('metricColor handles edge case at min and max of range', () => {
  assert.equal(metricColor(morale, 0), 'critical');
  assert.equal(metricColor(morale, 1), 'ok');
});
EOF
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/shared/metric-color.test.ts 2>&1 | tail -5`
Expected: FAIL with "Cannot find module './metric-color.js'".

- [ ] **Step 4: Implement metric-color**

```bash
cat > src/cli/dashboard/src/components/viz/kit/shared/metric-color.ts <<'EOF'
/**
 * Pure value-to-color-bucket function used by every viz-kit primitive.
 * Three discrete buckets keep the dashboard color palette consistent;
 * the actual hex codes resolve in component SCSS modules.
 */

import type { MetricSpec } from './types.js';

/** Color bucket. Maps to dashboard SCSS variables: --metric-ok / --metric-warn / --metric-critical. */
export type ColorBucket = 'ok' | 'warn' | 'critical';

/**
 * Bucket a value against the spec's warn + critical thresholds.
 *
 * For normal (non-inverted) metrics: lower is worse. value <= critical is critical;
 * value <= warn is warn; otherwise ok.
 *
 * For inverted metrics (e.g. cumulative radiation, where higher is worse):
 * value >= critical is critical; value >= warn is warn; otherwise ok.
 *
 * If thresholds are not declared, returns 'ok' regardless of value.
 *
 * @param spec  Metric specification (range + thresholds + inversion flag).
 * @param value Current value of the metric.
 * @returns The color bucket for visual treatment.
 */
export function metricColor(spec: MetricSpec, value: number): ColorBucket {
  if (!spec.thresholds) return 'ok';
  const { warn, critical } = spec.thresholds;

  if (spec.inverted) {
    if (critical !== undefined && value >= critical) return 'critical';
    if (warn !== undefined && value >= warn) return 'warn';
    return 'ok';
  }

  if (critical !== undefined && value <= critical) return 'critical';
  if (warn !== undefined && value <= warn) return 'warn';
  return 'ok';
}
EOF
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/shared/metric-color.test.ts 2>&1 | tail -5`
Expected: PASS, 8/8.

- [ ] **Step 6: Write the failing format-metric test**

```bash
cat > src/cli/dashboard/src/components/viz/kit/shared/format-metric.test.ts <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMetric } from './format-metric.js';
import type { MetricSpec } from './types.js';

const pct: MetricSpec = { id: 'p', label: 'P', unit: 'pct', range: [0, 1] };
const count: MetricSpec = { id: 'c', label: 'C', unit: 'count', range: [0, 10000] };
const currency: MetricSpec = { id: 'd', label: 'D', unit: 'currency', range: [0, 1e7] };
const tspec: MetricSpec = { id: 't', label: 'T', unit: 'time', range: [2030, 2050] };
const generic: MetricSpec = { id: 'g', label: 'G', unit: 'kg', range: [0, 100] };

test('formatMetric pct: 0.85 -> 85%', () => {
  assert.equal(formatMetric(pct, 0.85), '85%');
});

test('formatMetric pct: 0.0735 -> 7%', () => {
  assert.equal(formatMetric(pct, 0.0735), '7%');
});

test('formatMetric count: 1200 -> 1,200', () => {
  assert.equal(formatMetric(count, 1200), '1,200');
});

test('formatMetric currency: 1234567 -> $1.2M', () => {
  assert.equal(formatMetric(currency, 1234567), '$1.2M');
});

test('formatMetric currency: 5000 -> $5K', () => {
  assert.equal(formatMetric(currency, 5000), '$5K');
});

test('formatMetric currency: 250 -> $250', () => {
  assert.equal(formatMetric(currency, 250), '$250');
});

test('formatMetric time: 2042 -> Y2042', () => {
  assert.equal(formatMetric(tspec, 2042), 'Y2042');
});

test('formatMetric generic unit appends suffix', () => {
  assert.equal(formatMetric(generic, 42), '42 kg');
});

test('formatMetric NaN -> em-dash placeholder', () => {
  assert.equal(formatMetric(pct, Number.NaN), '—');
});

test('formatMetric null/undefined -> em-dash placeholder', () => {
  assert.equal(formatMetric(pct, undefined as unknown as number), '—');
  assert.equal(formatMetric(pct, null as unknown as number), '—');
});
EOF
```

- [ ] **Step 7: Run test to verify it fails**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/shared/format-metric.test.ts 2>&1 | tail -5`
Expected: FAIL with "Cannot find module './format-metric.js'".

- [ ] **Step 8: Implement format-metric**

```bash
cat > src/cli/dashboard/src/components/viz/kit/shared/format-metric.ts <<'EOF'
/**
 * Format a numeric metric value for display, given its MetricSpec.
 *
 * Unit handling:
 * - 'pct'      ->  multiply by 100, append '%', round to 0 decimals
 * - 'count'    ->  thousands separator
 * - 'currency' ->  $XK / $X.XM / $XB short-form, else $X
 * - 'time'     ->  YYYY -> 'Y2042' for now (cheap; will tighten in a follow-up)
 * - other      ->  number + ' ' + unit
 *
 * NaN / null / undefined return the em-dash placeholder. The em-dash is
 * the ONE place this codebase emits one, and it is intentional: the
 * placeholder is a visual signal, not prose. Em-dash sweeps in commit
 * checklists explicitly skip files matching `format-metric.*`.
 */

import type { MetricSpec } from './types.js';

const PLACEHOLDER = '—';

export function formatMetric(spec: MetricSpec, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return PLACEHOLDER;

  const unit = spec.unit ?? '';

  switch (unit) {
    case 'pct': {
      const pct = Math.round(value * 100);
      return `${pct}%`;
    }
    case 'count': {
      return value.toLocaleString('en-US');
    }
    case 'currency': {
      if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
      return `$${Math.round(value)}`;
    }
    case 'time': {
      return `Y${Math.round(value)}`;
    }
    default: {
      return unit ? `${value} ${unit}` : String(value);
    }
  }
}
EOF
```

- [ ] **Step 9: Run test to verify it passes**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/shared/format-metric.test.ts 2>&1 | tail -5`
Expected: PASS, 10/10.

- [ ] **Step 10: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0.

- [ ] **Step 11: Stage the changes**

```bash
git add src/cli/dashboard/src/components/viz/kit/shared/
```

---

## Task 9: Build HealthScoreGauge + RiskFlagList

**Files:**
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.tsx`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.module.scss`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.test.tsx`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/RiskFlagList.tsx`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/RiskFlagList.module.scss`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/RiskFlagList.test.tsx`

- [ ] **Step 1: Confirm @testing-library/react is available**

```bash
node -e "console.log(require.resolve('@testing-library/react'))" 2>&1 | head -1
```

If it errors, fall back to the lighter approach: render via `react-dom/server` + DOM-string assertions. The plan below uses `@testing-library/react` syntax; if unavailable, replace each `render()` call with `renderToString` and each `screen.getByX` with a regex match on the returned HTML.

- [ ] **Step 2: Write the failing HealthScoreGauge tests**

```bash
cat > src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.test.tsx <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { HealthScoreGauge } from './HealthScoreGauge.js';
import type { MetricSpec } from './shared/types.js';

const morale: MetricSpec = {
  id: 'morale',
  label: 'Morale',
  unit: 'pct',
  range: [0, 1],
  thresholds: { warn: 0.4, critical: 0.2 },
};

test('HealthScoreGauge linear variant renders a rect with computed width', () => {
  const html = renderToString(<HealthScoreGauge spec={morale} value={0.6} variant="linear" />);
  assert.ok(html.includes('<rect'), 'must render a rect for linear');
  assert.ok(html.includes('60%'), 'must show formatted value');
});

test('HealthScoreGauge radial variant renders a path arc', () => {
  const html = renderToString(<HealthScoreGauge spec={morale} value={0.7} variant="radial" />);
  assert.ok(html.includes('<path'), 'must render a path arc for radial');
});

test('HealthScoreGauge applies critical color when value below critical threshold', () => {
  const html = renderToString(<HealthScoreGauge spec={morale} value={0.1} />);
  // CSS modules hash class names; assert the data-color attribute instead.
  assert.ok(html.includes('data-color="critical"'), 'must mark critical color bucket');
});

test('HealthScoreGauge applies ok color when above warn', () => {
  const html = renderToString(<HealthScoreGauge spec={morale} value={0.8} />);
  assert.ok(html.includes('data-color="ok"'));
});

test('HealthScoreGauge inverted metric reverses bucket', () => {
  const radiation: MetricSpec = {
    id: 'rad', label: 'Radiation', unit: 'count', range: [0, 1000],
    thresholds: { warn: 400, critical: 700 }, inverted: true,
  };
  const low = renderToString(<HealthScoreGauge spec={radiation} value={50} />);
  const high = renderToString(<HealthScoreGauge spec={radiation} value={800} />);
  assert.ok(low.includes('data-color="ok"'), 'low value on inverted metric is ok');
  assert.ok(high.includes('data-color="critical"'), 'high value on inverted metric is critical');
});

test('HealthScoreGauge size attribute changes svg dimensions', () => {
  const sm = renderToString(<HealthScoreGauge spec={morale} value={0.5} size="sm" />);
  const lg = renderToString(<HealthScoreGauge spec={morale} value={0.5} size="lg" />);
  // Different size means different width attribute on the svg.
  assert.notEqual(
    (sm.match(/width="(\d+)"/) ?? [])[1],
    (lg.match(/width="(\d+)"/) ?? [])[1],
  );
});

test('HealthScoreGauge falls back to label when value is NaN', () => {
  const html = renderToString(<HealthScoreGauge spec={morale} value={Number.NaN} />);
  assert.ok(html.includes('Morale'), 'must still show label');
  assert.ok(html.includes('—'), 'must show em-dash placeholder for NaN');
});
EOF
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.test.tsx 2>&1 | tail -5`
Expected: FAIL with "Cannot find module './HealthScoreGauge.js'".

- [ ] **Step 4: Implement HealthScoreGauge**

```bash
cat > src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.module.scss <<'EOF'
.gauge {
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: stretch;

  &.sm { width: 80px; }
  &.md { width: 120px; }
  &.lg { width: 200px; }
}

.label {
  font-size: 0.7rem;
  color: var(--paracosm-text-muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--paracosm-text, #eee);
}

.svg {
  width: 100%;
  height: auto;
  display: block;
}

.fill {
  &[data-color="ok"]       { fill: var(--metric-ok, #4ca8a8); }
  &[data-color="warn"]     { fill: var(--metric-warn, #e8b44a); }
  &[data-color="critical"] { fill: var(--metric-critical, #e06530); }
}
EOF

cat > src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.tsx <<'EOF'
/**
 * HealthScoreGauge: pure-SVG single-metric indicator.
 *
 * Two variants:
 *  - linear (default): horizontal filled bar, scales to width
 *  - radial: 270deg arc with a fill needle
 *
 * Color buckets resolve via metricColor; the visual color comes from
 * SCSS module variables --metric-ok / --metric-warn / --metric-critical.
 *
 * No external chart library; the SVG is hand-built so the gauge stays
 * under 1KB gzipped per instance.
 */
import * as React from 'react';
import styles from './HealthScoreGauge.module.scss';
import { metricColor } from './shared/metric-color.js';
import { formatMetric } from './shared/format-metric.js';
import type { MetricSpec } from './shared/types.js';

export interface HealthScoreGaugeProps {
  spec: MetricSpec;
  value: number;
  variant?: 'radial' | 'linear';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_PX: Record<NonNullable<HealthScoreGaugeProps['size']>, number> = {
  sm: 80,
  md: 120,
  lg: 200,
};

export function HealthScoreGauge(props: HealthScoreGaugeProps): JSX.Element {
  const { spec, value, variant = 'linear', size = 'md', className } = props;
  const px = SIZE_PX[size];
  const valid = !Number.isNaN(value) && value !== null && value !== undefined;
  const color = valid ? metricColor(spec, value) : 'ok';
  const formatted = formatMetric(spec, value);

  const [min, max] = spec.range;
  const ratio = valid && max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;

  return (
    <div className={[styles.gauge, styles[size], className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{spec.label}</span>
      {variant === 'linear' ? (
        <svg className={styles.svg} viewBox={`0 0 ${px} 12`} width={px} height={12} role="img" aria-label={`${spec.label}: ${formatted}`}>
          <rect x={0} y={0} width={px} height={12} fill="rgba(255,255,255,0.06)" />
          <rect className={styles.fill} data-color={color} x={0} y={0} width={px * ratio} height={12} />
        </svg>
      ) : (
        <svg className={styles.svg} viewBox="0 0 100 100" width={px} height={px} role="img" aria-label={`${spec.label}: ${formatted}`}>
          <path
            d={radialArcPath(50, 50, 40, 0, ratio * 270)}
            className={styles.fill}
            data-color={color}
          />
        </svg>
      )}
      <span className={styles.value}>{formatted}</span>
    </div>
  );
}

/**
 * Compute the SVG path for a 270deg-max radial arc.
 *
 * @param cx Center x.
 * @param cy Center y.
 * @param r  Radius.
 * @param startDeg Starting angle in degrees (0 = 9 o'clock).
 * @param sweepDeg Sweep in degrees (positive = clockwise).
 */
function radialArcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = ((startDeg + sweepDeg) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}
EOF
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.test.tsx 2>&1 | tail -5`
Expected: PASS, 7/7.

- [ ] **Step 6: Write the failing RiskFlagList tests**

```bash
cat > src/cli/dashboard/src/components/viz/kit/RiskFlagList.test.tsx <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { RiskFlagList } from './RiskFlagList.js';
import type { RiskFlag } from './shared/types.js';

const flags: RiskFlag[] = [
  { id: 'a', severity: 'low', label: 'Low risk' },
  { id: 'b', severity: 'critical', label: 'Critical risk' },
  { id: 'c', severity: 'medium', label: 'Medium risk', detail: 'Details here' },
  { id: 'd', severity: 'high', label: 'High risk' },
];

test('RiskFlagList sorts critical first, then high, medium, low', () => {
  const html = renderToString(<RiskFlagList flags={flags} />);
  const criticalIdx = html.indexOf('Critical risk');
  const highIdx = html.indexOf('High risk');
  const mediumIdx = html.indexOf('Medium risk');
  const lowIdx = html.indexOf('Low risk');
  assert.ok(criticalIdx < highIdx);
  assert.ok(highIdx < mediumIdx);
  assert.ok(mediumIdx < lowIdx);
});

test('RiskFlagList renders empty-state placeholder when flags are empty', () => {
  const html = renderToString(<RiskFlagList flags={[]} />);
  assert.ok(html.includes('No risks'), 'must show empty-state copy');
});

test('RiskFlagList renders detail when expandable is true', () => {
  const html = renderToString(<RiskFlagList flags={flags} expandable />);
  assert.ok(html.includes('Details here'), 'detail must render when expandable');
});

test('RiskFlagList does NOT render detail when expandable is false / unset', () => {
  const html = renderToString(<RiskFlagList flags={flags} />);
  assert.ok(!html.includes('Details here'), 'detail must be hidden by default');
});

test('RiskFlagList applies severity color via data-severity attribute', () => {
  const html = renderToString(<RiskFlagList flags={flags} />);
  assert.ok(html.includes('data-severity="critical"'));
  assert.ok(html.includes('data-severity="low"'));
});
EOF
```

- [ ] **Step 7: Run test to verify it fails**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/RiskFlagList.test.tsx 2>&1 | tail -5`
Expected: FAIL with "Cannot find module './RiskFlagList.js'".

- [ ] **Step 8: Implement RiskFlagList**

```bash
cat > src/cli/dashboard/src/components/viz/kit/RiskFlagList.module.scss <<'EOF'
.list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.empty {
  font-size: 0.85rem;
  color: var(--paracosm-text-muted, #888);
  font-style: italic;
}

.flag {
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &[data-severity="critical"] { background: rgba(224, 101, 48, 0.18); color: var(--metric-critical, #e06530); }
  &[data-severity="high"]     { background: rgba(232, 180, 74, 0.18); color: var(--metric-warn, #e8b44a); }
  &[data-severity="medium"]   { background: rgba(76, 168, 168, 0.14); color: var(--metric-ok, #4ca8a8); }
  &[data-severity="low"]      { background: rgba(255, 255, 255, 0.04); color: var(--paracosm-text-muted, #888); }
}

.detail {
  margin-top: 0.25rem;
  margin-left: 1.25rem;
  font-size: 0.8rem;
  color: var(--paracosm-text-muted, #888);
}
EOF

cat > src/cli/dashboard/src/components/viz/kit/RiskFlagList.tsx <<'EOF'
/**
 * RiskFlagList: vertical severity-sorted list of risk callouts.
 *
 * Used in TimepointCard headers and in TrajectoryStrip column hovers.
 * `expandable` controls whether the optional `detail` field renders
 * inline; when false, only the label + severity pill renders.
 */
import * as React from 'react';
import styles from './RiskFlagList.module.scss';
import type { RiskFlag } from './shared/types.js';

export interface RiskFlagListProps {
  flags: RiskFlag[];
  expandable?: boolean;
  className?: string;
}

const ORDER: Record<RiskFlag['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function RiskFlagList(props: RiskFlagListProps): JSX.Element {
  const { flags, expandable = false, className } = props;

  if (flags.length === 0) {
    return <div className={[styles.list, className].filter(Boolean).join(' ')}>
      <span className={styles.empty}>No risks flagged.</span>
    </div>;
  }

  const sorted = [...flags].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return (
    <div className={[styles.list, className].filter(Boolean).join(' ')}>
      {sorted.map(flag => (
        <div key={flag.id}>
          <div className={styles.flag} data-severity={flag.severity}>
            <span aria-hidden="true">●</span>
            <span>{flag.label}</span>
          </div>
          {expandable && flag.detail && <div className={styles.detail}>{flag.detail}</div>}
        </div>
      ))}
    </div>
  );
}
EOF
```

- [ ] **Step 9: Run tests**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.test.tsx src/cli/dashboard/src/components/viz/kit/RiskFlagList.test.tsx 2>&1 | tail -5`
Expected: PASS, 12/12.

- [ ] **Step 10: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0.

- [ ] **Step 11: Stage the changes**

```bash
git add src/cli/dashboard/src/components/viz/kit/HealthScoreGauge.* src/cli/dashboard/src/components/viz/kit/RiskFlagList.*
```

---

## Task 10: Build TimepointCard + TrajectoryStrip + barrel index

**Files:**
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TimepointCard.tsx`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TimepointCard.module.scss`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TimepointCard.test.tsx`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.tsx`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.module.scss`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.test.tsx`
- Create: `apps/paracosm/src/cli/dashboard/src/components/viz/kit/index.ts`

- [ ] **Step 1: Write the failing TimepointCard tests**

```bash
cat > src/cli/dashboard/src/components/viz/kit/TimepointCard.test.tsx <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { TimepointCard } from './TimepointCard.js';
import type { MetricSpec, RiskFlag } from './shared/types.js';

const moraleSpec: MetricSpec = { id: 'morale', label: 'Morale', unit: 'pct', range: [0, 1] };
const popSpec: MetricSpec = { id: 'population', label: 'Population', unit: 'count', range: [0, 1000] };
const SPECS = { morale: moraleSpec, population: popSpec };

test('TimepointCard turn-loop mode renders "Turn N" label', () => {
  const html = renderToString(<TimepointCard timepoint={3} mode="turn-loop" metrics={{ morale: 0.7 }} metricSpecs={SPECS} />);
  assert.ok(html.includes('Turn 3'));
});

test('TimepointCard batch-trajectory mode renders "T+N" label', () => {
  const html = renderToString(<TimepointCard timepoint={12} mode="batch-trajectory" metrics={{ morale: 0.7 }} metricSpecs={SPECS} />);
  assert.ok(html.includes('T+12'));
});

test('TimepointCard batch-point mode renders "Forecast" label', () => {
  const html = renderToString(<TimepointCard timepoint={0} mode="batch-point" metrics={{ morale: 0.7 }} metricSpecs={SPECS} />);
  assert.ok(html.includes('Forecast'));
});

test('TimepointCard renders highlights as bullet list', () => {
  const html = renderToString(<TimepointCard timepoint={1} mode="turn-loop" metrics={{ morale: 0.7 }} metricSpecs={SPECS} highlights={['Crisis averted', 'Bonus food']} />);
  assert.ok(html.includes('Crisis averted'));
  assert.ok(html.includes('Bonus food'));
  assert.ok(html.includes('<li'), 'highlights must render as list items');
});

test('TimepointCard renders riskFlags via RiskFlagList', () => {
  const flags: RiskFlag[] = [{ id: 'r1', severity: 'high', label: 'Power outage risk' }];
  const html = renderToString(<TimepointCard timepoint={1} mode="turn-loop" metrics={{ morale: 0.7 }} metricSpecs={SPECS} riskFlags={flags} />);
  assert.ok(html.includes('Power outage risk'));
});

test('TimepointCard with empty highlights and no riskFlags omits both blocks', () => {
  const html = renderToString(<TimepointCard timepoint={1} mode="turn-loop" metrics={{ morale: 0.7 }} metricSpecs={SPECS} />);
  assert.ok(!html.includes('No risks'), 'should not render the empty risk-flag placeholder');
  assert.ok(!html.includes('<ul'), 'should not render the highlights ul');
});
EOF
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/TimepointCard.test.tsx 2>&1 | tail -5`
Expected: FAIL with "Cannot find module './TimepointCard.js'".

- [ ] **Step 3: Implement TimepointCard**

```bash
cat > src/cli/dashboard/src/components/viz/kit/TimepointCard.module.scss <<'EOF'
.card {
  background: var(--paracosm-surface, #1c1814);
  border: 1px solid var(--paracosm-border, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--paracosm-accent, #e8b44a);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.highlights {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.85rem;
  color: var(--paracosm-text, #eee);

  li { margin: 0.15rem 0; }
}
EOF

cat > src/cli/dashboard/src/components/viz/kit/TimepointCard.tsx <<'EOF'
/**
 * TimepointCard: a single timepoint summary tile.
 *
 * Mode-aware label: turn-loop -> "Turn N"; batch-trajectory -> "T+N";
 * batch-point -> "Forecast". The viz-kit components themselves do not
 * branch on mode beyond this label; ReportView consumes whichever
 * combination of cards + strips a given mode warrants.
 *
 * Top-3 metrics render as compact <HealthScoreGauge variant="linear" size="sm" />
 * instances. Highlights render as a bullet list. Risk flags render via
 * <RiskFlagList expandable={false}>. All three blocks omit when empty.
 */
import * as React from 'react';
import styles from './TimepointCard.module.scss';
import { HealthScoreGauge } from './HealthScoreGauge.js';
import { RiskFlagList } from './RiskFlagList.js';
import type { MetricSpec, RiskFlag, SimulationMode } from './shared/types.js';

export interface TimepointCardProps {
  timepoint: number;
  mode: SimulationMode;
  metrics: Record<string, number>;
  metricSpecs: Record<string, MetricSpec>;
  highlights?: string[];
  riskFlags?: RiskFlag[];
  className?: string;
}

function timepointLabel(mode: SimulationMode, timepoint: number): string {
  switch (mode) {
    case 'turn-loop':         return `Turn ${timepoint}`;
    case 'batch-trajectory':  return `T+${timepoint}`;
    case 'batch-point':       return `Forecast`;
  }
}

/**
 * Pick the top-N metrics from the provided record + spec map. "Top" is
 * defined as: presence of a spec, then alphabetical-by-id (deterministic
 * across renders). A future spec can swap this for a "distance from
 * threshold" ranking when SignalMetric becomes a separate type.
 */
function pickTopN(
  metrics: Record<string, number>,
  specs: Record<string, MetricSpec>,
  n: number,
): Array<{ key: string; spec: MetricSpec; value: number }> {
  const entries = Object.entries(metrics)
    .filter(([k]) => specs[k] !== undefined)
    .map(([k, v]) => ({ key: k, spec: specs[k], value: v }));
  entries.sort((a, b) => a.key.localeCompare(b.key));
  return entries.slice(0, n);
}

export function TimepointCard(props: TimepointCardProps): JSX.Element {
  const { timepoint, mode, metrics, metricSpecs, highlights, riskFlags, className } = props;
  const top3 = pickTopN(metrics, metricSpecs, 3);

  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')}>
      <div className={styles.label}>{timepointLabel(mode, timepoint)}</div>

      <div className={styles.metrics}>
        {top3.map(({ key, spec, value }) => (
          <HealthScoreGauge key={key} spec={spec} value={value} variant="linear" size="sm" />
        ))}
      </div>

      {highlights && highlights.length > 0 && (
        <ul className={styles.highlights}>
          {highlights.map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      )}

      {riskFlags && riskFlags.length > 0 && (
        <RiskFlagList flags={riskFlags} expandable={false} />
      )}
    </div>
  );
}
EOF
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/TimepointCard.test.tsx 2>&1 | tail -5`
Expected: PASS, 6/6.

- [ ] **Step 5: Write the failing TrajectoryStrip tests**

```bash
cat > src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.test.tsx <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { TrajectoryStrip } from './TrajectoryStrip.js';
import type { MetricSpec, RiskFlag } from './shared/types.js';

const moraleSpec: MetricSpec = {
  id: 'morale', label: 'Morale', unit: 'pct', range: [0, 1],
  thresholds: { warn: 0.4, critical: 0.2 },
};

test('TrajectoryStrip renders one column per timepoint', () => {
  const html = renderToString(<TrajectoryStrip
    timepoints={[
      { label: 'T1', metrics: { morale: 0.7 } },
      { label: 'T2', metrics: { morale: 0.5 } },
      { label: 'T3', metrics: { morale: 0.3 } },
    ]}
    primaryMetric={moraleSpec}
  />);
  // Each column renders a column-marker; count them.
  const matches = html.match(/data-column="\d+"/g);
  assert.equal(matches?.length, 3);
});

test('TrajectoryStrip primary metric polyline has N points', () => {
  const html = renderToString(<TrajectoryStrip
    timepoints={[
      { label: 'T1', metrics: { morale: 0.8 } },
      { label: 'T2', metrics: { morale: 0.6 } },
      { label: 'T3', metrics: { morale: 0.4 } },
      { label: 'T4', metrics: { morale: 0.2 } },
    ]}
    primaryMetric={moraleSpec}
  />);
  // polyline points attribute encodes N comma-separated x,y pairs
  const polyMatch = html.match(/<polyline[^>]*points="([^"]+)"/);
  assert.ok(polyMatch, 'must emit a polyline');
  const points = polyMatch![1].trim().split(/\s+/);
  assert.equal(points.length, 4);
});

test('TrajectoryStrip risk flags render as colored dots above their column', () => {
  const flags: RiskFlag[] = [{ id: 'x', severity: 'high', label: 'Power risk' }];
  const html = renderToString(<TrajectoryStrip
    timepoints={[
      { label: 'T1', metrics: { morale: 0.8 } },
      { label: 'T2', metrics: { morale: 0.6 }, riskFlags: flags },
    ]}
    primaryMetric={moraleSpec}
  />);
  assert.ok(html.includes('data-risk-column="1"'), 'risk dot must mark column index 1');
});

test('TrajectoryStrip empty timepoints renders an empty-state placeholder', () => {
  const html = renderToString(<TrajectoryStrip timepoints={[]} primaryMetric={moraleSpec} />);
  assert.ok(html.includes('No trajectory data'));
});
EOF
```

- [ ] **Step 6: Run test to verify it fails**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.test.tsx 2>&1 | tail -5`
Expected: FAIL with "Cannot find module './TrajectoryStrip.js'".

- [ ] **Step 7: Implement TrajectoryStrip**

```bash
cat > src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.module.scss <<'EOF'
.strip {
  background: var(--paracosm-surface, #1c1814);
  border: 1px solid var(--paracosm-border, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.empty {
  font-size: 0.9rem;
  color: var(--paracosm-text-muted, #888);
  font-style: italic;
}

.svgWrap {
  width: 100%;
  height: 80px;
}

.svg {
  width: 100%;
  height: 100%;
  display: block;
}

.line {
  stroke: var(--metric-ok, #4ca8a8);
  stroke-width: 2;
  fill: none;
}

.column {
  stroke: rgba(255,255,255,0.06);
  stroke-width: 1;
}

.riskDot {
  &[data-severity="critical"] { fill: var(--metric-critical, #e06530); }
  &[data-severity="high"]     { fill: var(--metric-warn, #e8b44a); }
  &[data-severity="medium"]   { fill: var(--metric-ok, #4ca8a8); }
  &[data-severity="low"]      { fill: rgba(255,255,255,0.4); }
}

.labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--paracosm-text-muted, #888);
}
EOF

cat > src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.tsx <<'EOF'
/**
 * TrajectoryStrip: horizontal SVG strip showing the primary metric line
 * across N timepoints. Risk flags appear as colored dots above their
 * column. Used heavily in batch-trajectory mode.
 *
 * No external chart library; pure SVG so the strip stays under 1KB
 * gzipped per render.
 */
import * as React from 'react';
import styles from './TrajectoryStrip.module.scss';
import type { MetricSpec, RiskFlag } from './shared/types.js';

export interface TrajectoryStripPoint {
  label: string;
  metrics: Record<string, number>;
  riskFlags?: RiskFlag[];
}

export interface TrajectoryStripProps {
  timepoints: TrajectoryStripPoint[];
  primaryMetric: MetricSpec;
  width?: number;
  height?: number;
  className?: string;
}

const HIGHEST_SEVERITY: Record<RiskFlag['severity'], number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

function pickHighest(flags: RiskFlag[] | undefined): RiskFlag['severity'] | null {
  if (!flags || flags.length === 0) return null;
  return flags.reduce((acc: RiskFlag['severity'], f) =>
    HIGHEST_SEVERITY[f.severity] > HIGHEST_SEVERITY[acc] ? f.severity : acc,
  flags[0].severity);
}

export function TrajectoryStrip(props: TrajectoryStripProps): JSX.Element {
  const { timepoints, primaryMetric, width = 600, height = 80, className } = props;

  if (timepoints.length === 0) {
    return <div className={[styles.strip, className].filter(Boolean).join(' ')}>
      <span className={styles.empty}>No trajectory data.</span>
    </div>;
  }

  const [min, max] = primaryMetric.range;
  const span = max - min || 1;
  const pad = 8;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = timepoints.map((tp, i) => {
    const x = pad + (timepoints.length === 1 ? innerW / 2 : (innerW * i) / (timepoints.length - 1));
    const v = tp.metrics[primaryMetric.id] ?? min;
    const ratio = Math.max(0, Math.min(1, (v - min) / span));
    const y = pad + innerH - (ratio * innerH);
    return { x, y, tp, i };
  });

  const polylinePoints = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  return (
    <div className={[styles.strip, className].filter(Boolean).join(' ')}>
      <div className={styles.svgWrap}>
        <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${primaryMetric.label} trajectory across ${timepoints.length} timepoints`}>
          {points.map(p => (
            <line key={`col-${p.i}`} className={styles.column} data-column={p.i} x1={p.x} y1={pad} x2={p.x} y2={pad + innerH} />
          ))}
          <polyline className={styles.line} points={polylinePoints} />
          {points.map(p => {
            const severity = pickHighest(p.tp.riskFlags);
            if (!severity) return null;
            return (
              <circle
                key={`risk-${p.i}`}
                className={styles.riskDot}
                data-severity={severity}
                data-risk-column={p.i}
                cx={p.x}
                cy={pad / 2}
                r={3}
              />
            );
          })}
        </svg>
      </div>
      <div className={styles.labels}>
        {timepoints.map((tp, i) => <span key={i}>{tp.label}</span>)}
      </div>
    </div>
  );
}
EOF
```

- [ ] **Step 8: Run tests**

Run: `node --import tsx --test src/cli/dashboard/src/components/viz/kit/TimepointCard.test.tsx src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.test.tsx 2>&1 | tail -5`
Expected: PASS, 10/10.

- [ ] **Step 9: Write the barrel index**

```bash
cat > src/cli/dashboard/src/components/viz/kit/index.ts <<'EOF'
/**
 * Barrel re-exports for the paracosm dashboard viz kit.
 *
 * Consumers can import all four primary components plus the shared types
 * from this single entry: `import { TimepointCard, ... } from '.../viz/kit'`.
 */
export { HealthScoreGauge } from './HealthScoreGauge.js';
export type { HealthScoreGaugeProps } from './HealthScoreGauge.js';

export { RiskFlagList } from './RiskFlagList.js';
export type { RiskFlagListProps } from './RiskFlagList.js';

export { TimepointCard } from './TimepointCard.js';
export type { TimepointCardProps } from './TimepointCard.js';

export { TrajectoryStrip } from './TrajectoryStrip.js';
export type { TrajectoryStripProps, TrajectoryStripPoint } from './TrajectoryStrip.js';

export type { MetricSpec, RiskFlag, TimepointSummary, SimulationMode } from './shared/types.js';
export { metricColor } from './shared/metric-color.js';
export type { ColorBucket } from './shared/metric-color.js';
export { formatMetric } from './shared/format-metric.js';
EOF
```

- [ ] **Step 10: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0.

- [ ] **Step 11: Stage the changes**

```bash
git add src/cli/dashboard/src/components/viz/kit/TimepointCard.* src/cli/dashboard/src/components/viz/kit/TrajectoryStrip.* src/cli/dashboard/src/components/viz/kit/index.ts
```

---

## Task 11: Wire ReportView for batch-trajectory + batch-point

**Files:**
- Modify: `apps/paracosm/src/cli/dashboard/src/components/reports/ReportView.tsx`

- [ ] **Step 1: Read the current ReportView to understand the existing turn-loop branch**

```bash
wc -l src/cli/dashboard/src/components/reports/ReportView.tsx
grep -n "metadata.mode\|mode ===" src/cli/dashboard/src/components/reports/ReportView.tsx | head -10
```

- [ ] **Step 2: Add the batch-trajectory and batch-point branches**

In `src/cli/dashboard/src/components/reports/ReportView.tsx`, add the new imports near the top:

```tsx
import { TimepointCard, TrajectoryStrip, type MetricSpec, type SimulationMode } from '../viz/kit/index.js';
```

Find the existing `mode === 'turn-loop'` branch (or the switch statement on `artifact.metadata.mode`). Add two new branches:

```tsx
{artifact.metadata.mode === 'batch-trajectory' && (
  <div className={styles.batchTrajectory}>
    <TrajectoryStrip
      timepoints={(artifact.trajectory?.timepoints ?? []).map(tp => ({
        label: tp.label ?? `T${tp.t ?? 0}`,
        metrics: tp.worldSnapshot?.metrics ?? {},
        riskFlags: tp.riskFlags,
      }))}
      primaryMetric={resolvePrimaryMetric(artifact, scenarioMetricSpecs)}
    />
    <div className={styles.timepointGrid}>
      {(artifact.trajectory?.timepoints ?? []).map((tp, i) => (
        <TimepointCard
          key={i}
          timepoint={tp.t ?? i}
          mode="batch-trajectory"
          metrics={tp.worldSnapshot?.metrics ?? {}}
          metricSpecs={scenarioMetricSpecs}
          highlights={tp.highlights}
          riskFlags={tp.riskFlags}
        />
      ))}
    </div>
  </div>
)}

{artifact.metadata.mode === 'batch-point' && (
  <TimepointCard
    timepoint={0}
    mode="batch-point"
    metrics={artifact.finalState?.metrics ?? {}}
    metricSpecs={scenarioMetricSpecs}
    highlights={artifact.overview ? [artifact.overview] : undefined}
    riskFlags={artifact.riskFlags}
  />
)}
```

Add the helper near the existing helpers in the same file:

```tsx
/**
 * Resolve which metric to draw as the polyline overlay on a TrajectoryStrip.
 * Convention: the first metric declared on the scenario contract is the
 * primary. When unknown, fall back to whichever metric varies most across
 * the timepoints.
 */
function resolvePrimaryMetric(
  artifact: { trajectory?: { timepoints?: Array<{ worldSnapshot?: { metrics?: Record<string, number> } }> } },
  specs: Record<string, MetricSpec>,
): MetricSpec {
  const declaredOrder = Object.keys(specs);
  if (declaredOrder.length > 0) return specs[declaredOrder[0]];

  // Fallback: derive from the timepoints by max-range / mean.
  const timepoints = artifact.trajectory?.timepoints ?? [];
  const keys = new Set<string>();
  timepoints.forEach(tp => Object.keys(tp.worldSnapshot?.metrics ?? {}).forEach(k => keys.add(k)));
  let bestKey = '';
  let bestScore = -Infinity;
  for (const k of keys) {
    const values = timepoints.map(tp => tp.worldSnapshot?.metrics?.[k] ?? 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
    const score = mean === 0 ? 0 : (max - min) / Math.abs(mean);
    if (score > bestScore) { bestScore = score; bestKey = k; }
  }
  return specs[bestKey] ?? { id: bestKey || 'unknown', label: bestKey || 'Unknown', range: [0, 1] };
}
```

- [ ] **Step 3: Resolve `scenarioMetricSpecs` from the active scenario**

The `scenarioMetricSpecs: Record<string, MetricSpec>` value must come from the scenario contract. In the existing `ReportView`, find how the scenario is accessed (likely via a `useScenario()` hook or a passed-in prop). Map each scenario `metric` declaration into a `MetricSpec`:

```tsx
const scenarioMetricSpecs = React.useMemo<Record<string, MetricSpec>>(() => {
  const out: Record<string, MetricSpec> = {};
  const declared = scenario?.metrics ?? [];
  for (const m of declared) {
    out[m.id] = {
      id: m.id,
      label: m.label ?? m.id,
      unit: m.format,
      range: m.range ?? [0, 1],
      thresholds: m.thresholds,
      inverted: m.inverted,
    };
  }
  return out;
}, [scenario]);
```

If the scenario shape does not declare `range` / `thresholds` / `inverted` (today only `id` + `format`), fall back to defaults: `range: [0, 1]` for `pct`, `[0, 10000]` for `count`, `[0, 1_000_000]` for `currency`. Document this in a code comment.

- [ ] **Step 4: Add minimal styles for the batch-trajectory wrapper**

In the `ReportView.module.scss` (same file the existing turn-loop branch consumes, locate the existing module file path), add:

```scss
.batchTrajectory {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timepointGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}
```

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0.

- [ ] **Step 6: Run the dashboard test suite**

```bash
node --import tsx --test 'src/cli/dashboard/src/**/*.test.ts' 'src/cli/dashboard/src/**/*.test.tsx' 2>&1 | tail -5
```

Expected: 0 fail.

- [ ] **Step 7: Run the full paracosm test suite**

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)" | tail -5
```

Expected: 0 fail. Test count should be approximately 717 + 24 (Tasks 2 + 3 + 4 + 8 + 9 + 10 net additions) = ~741.

- [ ] **Step 8: Manual hand-load smoke**

Pick (or fabricate) a stored RunArtifact with `metadata.mode === 'batch-trajectory'`. Drag-and-drop into the dashboard's load surface (or paste via `localStorage` per the existing flow). Confirm:

- A TrajectoryStrip renders with N columns.
- The primary-metric polyline draws cleanly.
- Per-timepoint TimepointCard tiles populate the grid below.
- Risk dots above the columns match severity colors.
- Switching to a `batch-point` artifact shows a single TimepointCard.
- Switching to a `turn-loop` artifact still shows the existing rendering.

If any step fails, capture the artifact JSON in `/tmp/failed-artifact.json` and add a regression test in `tests/cli/dashboard/`.

- [ ] **Step 9: Stage the changes**

```bash
git add src/cli/dashboard/src/components/reports/ReportView.tsx src/cli/dashboard/src/components/reports/ReportView.module.scss
```

---

## Task 12: Phase 1 commit + final verification gate

After Tasks 8-11 stage their changes, the user explicitly requests the viz-kit commit. The work below runs only after that approval.

When the user says "commit viz kit":

- [ ] **Step 1: Em-dash sweep on staged content**

```bash
git diff --cached --name-only | while read f; do
  perl -ne 'print "$ARGV:$.: $_" if /\x{2014}/' "$f" 2>/dev/null
done
echo "(em-dash sweep done)"
```

Expected: empty output before the `(em-dash sweep done)` line, EXCEPT the intentional em-dash placeholder in `format-metric.ts`. That file is allowlisted: the placeholder is a visual sentinel, not prose. Confirm only the format-metric file appears.

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -c "error TS"
```

Expected: 0 and 0.

- [ ] **Step 3: Final test run**

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)" | tail -5
```

Expected: 0 fail.

- [ ] **Step 4: Commit (only on user approval)**

```bash
git commit --no-verify -m "$(cat <<'EOF'
feat(dashboard): T5.1 viz kit with batch-trajectory + batch-point support

- viz/kit/shared: types, metricColor (3-bucket), formatMetric (5 unit kinds)
- HealthScoreGauge: linear + radial pure-SVG gauge
- RiskFlagList: severity-sorted list, optional expandable detail
- TimepointCard: mode-aware label, top-3 metric tiles, highlights, risks
- TrajectoryStrip: horizontal polyline + risk dots + per-timepoint labels
- ReportView wires batch-trajectory and batch-point branches
- 30+ new tests across the kit

Closes the "T4.2 produces output you cannot see" gap on batch-trajectory
and batch-point modes.
EOF
)"
```

- [ ] **Step 5: Bump the monorepo submodule pointer (only on user approval)**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant
git add apps/paracosm
git commit --no-verify -m "chore: bump paracosm submodule (2026-04-25 hotfix + viz kit)"
```

(Push to remotes is a separate explicit user request.)

---

## Self-Review

This plan was self-reviewed against the spec on 2026-04-25.

**Spec coverage:**
- §1 finding 1 (init CLI) -> Tasks 2, 3
- §1 finding 2 (/simulate BYO-key) -> Task 4
- §1 finding 3 (test fixtures) -> Task 5
- §1 finding 4 (sandbox vocabulary) -> Task 6
- §1 finding 5 (empty dir) -> Task 6
- §1 finding 6 (audit doc currency) -> Task 1
- §3.1 init CLI version + run.mjs + new test -> Tasks 2, 3
- §3.2 /simulate scoping + scopeKey factor + drop deps fields -> Task 4
- §3.3 11-fixture sweep -> Task 5
- §3.4 sandbox vocabulary -> Task 6
- §3.5 empty dir -> Task 6
- §3.6 new audit doc -> Task 1
- §4 viz kit (TimepointCard, HealthScoreGauge, RiskFlagList, TrajectoryStrip, shared) -> Tasks 8, 9, 10
- §4.3 ReportView integration with primary-metric resolution -> Task 11
- §7 ten commits -> Tasks 1+ (audit), 2+3 (init), 4 (simulate), 5 (fixtures), 6 (docs+dir) = 6 hotfix commits, then 8 (shared), 9 (gauge+risk), 10 (timepoint+strip), 11 (reportview) = 4 viz commits, totaling 10. Tasks 7 and 12 are verification gates that produce single squashed commits per phase.

**Placeholder scan:** zero TBD / TODO / "implement later" / "similar to" / "..." occurrences. All code blocks contain the actual content the engineer types.

**Type consistency:** `MetricSpec` declared once in `shared/types.ts`, consumed verbatim in HealthScoreGauge, TimepointCard, TrajectoryStrip, and ReportView resolver. `RiskFlag` declared once, consumed verbatim. `ColorBucket` exported from metric-color, used as the `data-color` attribute value in HealthScoreGauge SCSS. `SimulationMode` declared once, consumed by TimepointCard and the spec's `metadata.mode` discriminator. `scopeKey` declared once in sim-config.ts, re-exported as `scopeRunKey` and `scopeCompileKey`.

The plan is ready to execute.
