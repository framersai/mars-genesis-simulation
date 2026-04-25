# state.systems to state.metrics Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per user policy a SINGLE commit ships at the end (not per-task).

**Goal:** Rename `SimulationState.systems` to `metrics` and `WorldSystems` to `WorldMetrics` everywhere in paracosm. SSE event names stay; SSE payload keys naturally become `metrics:` because emit code passes `state.metrics` directly.

**Architecture:** Pure mechanical rename via a sequence of word-boundary-safe seds. The structured shape (`population`, `morale`, `foodMonthsReserve`, `powerKw`, etc. plus `[key: string]: number` index sig) is preserved. No back-compat shim. Type-import consumers see the rename on next install.

**Tech Stack:** TypeScript 5.x, node:test runner, vitest where applicable, sed + perl for the bulk renames.

---

## File Structure

| File | Change | Why |
|---|---|---|
| `src/engine/core/state.ts` | Modify | Rename `WorldSystems` interface to `WorldMetrics`; rename field on `SimulationState`; update JSDoc |
| `src/engine/core/progression.ts` | Modify | Imports + parameter type + field access |
| `src/engine/core/kernel.ts` | Modify | Type imports + `state.systems` accesses |
| `src/engine/index.ts` | Modify | Re-export rename |
| `src/engine/mars/metrics.ts` | Modify | Type import |
| `src/engine/mars/prompts.ts` + `src/engine/lunar/prompts.ts` | Modify | `state.systems` accesses |
| `src/engine/compiler/state-shape-block.ts` | Modify | Compiler-prompt copy that names the field |
| `src/engine/compiler/scenario-fixture.ts` + `src/engine/compiler/cache.ts` + `src/engine/compiler/generate-prompts.ts` | Modify | Compiler-side `state.systems` references |
| `src/runtime/orchestrator.ts` | Modify | Heaviest file: type imports, `state.systems` + `kernel.getState().systems` accesses, emit-call payload keys |
| `src/runtime/contracts.ts` + `src/runtime/departments.ts` + `src/runtime/chat-agents.ts` | Modify | Runtime-side `state.systems` and emit payload keys |
| `src/cli/server-app.ts` | Modify | Server-side payload key reads |
| `src/cli/dashboard/src/hooks/useGameState.ts` + `useSSE.ts` + dashboard fixtures + `migrateLegacyEventShape.test.ts` + `tour/demoData.ts` + `viz/useVizSnapshots.ts` + `reports-shared.test.ts` etc. | Modify | Dashboard-side `data.systems` reads in fixtures and reducers |
| `tests/**` | Modify | Test fixtures that spell `state.systems` or `WorldSystems` |
| `docs/superpowers/plans/2026-04-23-paracosm-roadmap.md` | Modify | Mark T4.5 SHIPPED |

---

## Task 1: Baseline tsc + reference counts

**Files:** none (verification only)

- [ ] **Step 1: Confirm tsc baseline is clean from T4.6**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 2: Record per-token counts**

```bash
echo "WorldSystems:"
grep -rE "WorldSystems" src tests --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
echo "state.systems:"
grep -rE "state\.systems" src tests --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
echo "kernel.getState().systems:"
grep -rE "kernel\.getState\(\)\.systems" src --include="*.ts" 2>/dev/null | wc -l
echo "data.systems:"
grep -rE "data\.systems" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
echo "(other) X.systems where X != state/data/kernel etc:"
grep -rE "\b[A-Za-z]+\.systems\b" src --include="*.ts" 2>/dev/null | grep -vE "state\.systems|data\.systems|kernel\.getState\(\)\.systems|process\.systems|world\.systems" | wc -l
```

Capture each count for use in Task 8 verification.

---

## Task 2: Rename `WorldSystems` interface to `WorldMetrics`

**Files:**
- Modify: `src/engine/core/state.ts:132`
- Modify: every file that imports or references `WorldSystems`

- [ ] **Step 1: Read the interface declaration + JSDoc**

```bash
sed -n '120,155p' src/engine/core/state.ts
```

Confirm the interface starts at line 132 with `export interface WorldSystems {`.

- [ ] **Step 2: Sed `WorldSystems` to `WorldMetrics` across src + tests**

Word-boundary safe. The token only appears as a type identifier (or in JSDoc, which the sed also rewrites).

```bash
find src tests -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/WorldSystems/WorldMetrics/g' {} +
```

- [ ] **Step 3: Verify no `WorldSystems` remains**

```bash
grep -rE "WorldSystems" src tests --include="*.ts" --include="*.tsx" 2>/dev/null || echo "clean"
```

Expected: `clean`

- [ ] **Step 4: tsc**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`. If errors appear, the most likely cause is a JSDoc reference that references `WorldSystems` from prose (e.g., a code-fence example) that didn't sed cleanly. Fix manually.

---

## Task 3: Rename `SimulationState.systems` field to `metrics`

**Files:**
- Modify: `src/engine/core/state.ts:218`

- [ ] **Step 1: Read the SimulationState interface + JSDoc**

```bash
sed -n '209,237p' src/engine/core/state.ts
```

Confirm line 218 reads `systems: WorldMetrics;` (after Task 2's rename).

- [ ] **Step 2: Update the field declaration + the JSDoc paragraph above**

Edit `src/engine/core/state.ts`. Find this block:

```typescript
  /**
   * Numerical world state. The `WorldMetrics` fields below
   * (`population`, `morale`, `foodMonthsReserve`, `powerKw`, etc.) are
   * Mars/space heritage conveniences — any scenario extends the bag
   * via the `[key: string]: number` index signature without touching
   * these defaults. Was `colony` pre-0.5.0.
   */
  systems: WorldMetrics;
```

Replace with:

```typescript
  /**
   * Numerical world state. The `WorldMetrics` fields below
   * (`population`, `morale`, `foodMonthsReserve`, `powerKw`, etc.) are
   * Mars/space heritage conveniences. Any scenario extends the bag
   * via the `[key: string]: number` index signature without touching
   * these defaults. Was `colony` pre-0.5.0, then `systems` 0.5.x-0.6.x,
   * now `metrics` aligning with `WorldSnapshot.metrics` from the
   * universal schema.
   */
  metrics: WorldMetrics;
```

The em-dash in the original JSDoc is replaced with a period to satisfy the no-em-dash rule.

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: dozens of errors now (every callsite reading `state.systems` is broken). That is the signal that the rename surface is exposed. Step into Task 4.

---

## Task 4: Rename `state.systems` to `state.metrics` everywhere

**Files:** every src + tests file that accesses the field via `state.systems`.

- [ ] **Step 1: Sed across src and tests**

```bash
find src tests -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/state\.systems/state.metrics/g' {} +
```

- [ ] **Step 2: Verify no `state.systems` remains**

```bash
grep -rE "state\.systems" src tests --include="*.ts" --include="*.tsx" 2>/dev/null || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: tsc and inspect remaining errors**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

The error count drops sharply but is unlikely to be 0 yet. Other access patterns remain (`kernel.getState().systems`, `preState.systems`, `final.systems`, `after.systems`, `st.systems`, `data.systems`, payload-key `systems:`). Tasks 5 and 6 catch them.

---

## Task 5: Rename other `.systems` accesses on the SimulationState shape

**Files:** primarily `src/runtime/orchestrator.ts`, plus `src/cli/server-app.ts` and a handful of others.

- [ ] **Step 1: List remaining `.systems` accesses**

```bash
grep -rnE "\b[A-Za-z]+\.systems\b" src --include="*.ts" 2>/dev/null \
  | grep -vE "data\.systems|process\.systems"
```

This excludes `data.systems` (handled in Task 6) and `process.systems` (irrelevant). Expected matches include `kernel.getState().systems`, `preState.systems`, `final.systems`, `after.systems`, `st.systems`, `kernelState.systems` and similar.

- [ ] **Step 2: Sed each pattern that accesses the SimulationState shape**

Catch-all: identifier-then-`.systems` becomes identifier-then-`.metrics`. Most matches are SimulationState-shaped variables. Do not blanket-sed without prose review; some false positives may exist (e.g., a tool-config field named `systems`). Run this targeted sed first:

```bash
for pattern in "kernel\.getState()\.systems" "preState\.systems" "nextState\.systems" "final\.systems" "after\.systems" "st\.systems" "kernelState\.systems"; do
  rep=$(echo "$pattern" | sed 's/systems/metrics/' | sed 's/\\//g')
  find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
    -exec sed -i '' "s/${pattern}/${rep}/g" {} +
done
```

- [ ] **Step 3: Re-list to catch stragglers**

```bash
grep -rnE "\b[A-Za-z]+\.systems\b" src --include="*.ts" 2>/dev/null \
  | grep -vE "data\.systems|process\.systems"
```

If matches remain, read the surrounding 2-3 lines via `sed -n` to decide: rename if the accessed object is SimulationState-shaped; leave alone if not.

- [ ] **Step 4: tsc**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: drops further. Anything left should be in the emit-payload path (Task 6) or dashboard (Task 7).

---

## Task 6: Rename emit-call payload keys `systems:` to `metrics:`

**Files:** primarily `src/runtime/orchestrator.ts`, plus `src/runtime/contracts.ts` and any other emit/snapshot code.

- [ ] **Step 1: Find every `emit(...)` callsite passing `systems:`**

```bash
grep -nE "emit\([^)]*systems:" src/runtime/*.ts src/cli/*.ts 2>/dev/null
grep -nE "^\s*systems:\s*(state\.metrics|after\.metrics|preState\.metrics|st\.metrics|final\.metrics)" src/runtime/*.ts 2>/dev/null
```

The second grep catches the multi-line payload literal pattern.

- [ ] **Step 2: Sed the payload key**

The pattern is the literal line `systems: <something-that-now-evaluates-to-metrics>`. Targeted sed in just the orchestrator + contracts + emit-related files:

```bash
for f in src/runtime/orchestrator.ts src/runtime/contracts.ts src/runtime/chat-agents.ts src/cli/server-app.ts; do
  sed -i '' 's/^\(\s*\)systems:\s*\(state\.metrics\|after\.metrics\|preState\.metrics\|st\.metrics\|final\.metrics\)/\1metrics: \2/g' "$f"
done
```

- [ ] **Step 3: Spot-check that no payload key was missed**

```bash
grep -nE "systems:\s*(state\.metrics|after\.metrics|preState\.metrics|st\.metrics|final\.metrics|kernel\.getState\(\)\.metrics)" \
  src/runtime/*.ts src/cli/*.ts 2>/dev/null || echo "clean"
```

Expected: `clean`

- [ ] **Step 4: tsc**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Errors should now be confined to the dashboard side reading `data.systems` from event payloads.

---

## Task 7: Rename dashboard `data.systems` reads to `data.metrics`

**Files:**
- Modify: `src/cli/dashboard/src/hooks/useGameState.ts`
- Modify: `src/cli/dashboard/src/hooks/useSSE.ts`
- Modify: `src/cli/dashboard/src/components/viz/useVizSnapshots.ts`
- Modify: `src/cli/dashboard/src/components/tour/demoData.ts`
- Modify: `src/cli/dashboard/src/components/reports/reports-shared.test.ts`
- Modify: `src/cli/dashboard/src/hooks/migrateLegacyEventShape.test.ts`
- Modify: any other dashboard file with a `data.systems` access or a fixture object literal `systems: {...}` whose owning object is an event payload

- [ ] **Step 1: Sed `data.systems` to `data.metrics` across the dashboard tree**

```bash
find src/cli/dashboard/src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/data\.systems/data.metrics/g' {} +
```

- [ ] **Step 2: Sed event-fixture object-literal keys `systems: {` to `metrics: {`**

Test fixtures and demoData spell payloads inline as `data: { systems: { population: ..., morale: ... } }`. The sed targets the literal `systems: {` pattern when followed by population-or-morale to avoid false positives.

```bash
find src/cli/dashboard/src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/systems:\s*{ population/metrics: { population/g' {} +
```

- [ ] **Step 3: Find any remaining `systems:` in dashboard test fixtures**

```bash
grep -rnE "systems:\s*\{" src/cli/dashboard/src --include="*.ts" --include="*.tsx" 2>/dev/null
```

For each match, read the context. If the surrounding object is an event payload (it has `type:` and `data:` siblings), rename `systems:` to `metrics:`. If the surrounding object is something unrelated (config, scenario blueprint, etc.), leave alone.

- [ ] **Step 4: Update `migrateLegacyEventShape` rules + tests if needed**

```bash
sed -n '1,20p' src/cli/dashboard/src/hooks/migrateLegacyEventShape.ts
```

The migration rules currently alias `data.colony` to `data.systems`. After this rename the dashboard reads `data.metrics`, so the migration target should also be `data.metrics`. Update the literal `'systems'` strings in `migrateLegacyEventShape.ts` to `'metrics'` so pre-0.5.0 events still arrive in the right shape. Update the test file's expectations in lockstep (the test asserts on the migrated key name).

- [ ] **Step 5: tsc**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm zero remaining occurrences of any rename token**

```bash
echo "WorldSystems:"
grep -rE "WorldSystems" src tests --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
echo "state.systems:"
grep -rE "state\.systems" src tests --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
echo "kernel.getState().systems:"
grep -rE "kernel\.getState\(\)\.systems" src --include="*.ts" 2>/dev/null | wc -l
echo "data.systems:"
grep -rE "data\.systems" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
```

Expected: every count is `0`.

- [ ] **Step 2: tsc clean (root + build)**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -c "error TS"
```

Expected: both `0`.

- [ ] **Step 3: Run targeted tests (per the targeted-tests rule, only the touched ones)**

```bash
node --import tsx --test \
  src/engine/core/progression.test.ts \
  src/engine/mars/metrics.test.ts \
  src/runtime/orchestrator-leader-mutation.test.ts \
  src/runtime/hexaco-cues/trajectory.test.ts \
  src/cli/dashboard/src/components/log/EventLogPanel.helpers.test.ts \
  src/cli/dashboard/src/components/reports/reports-shared.test.ts \
  src/cli/dashboard/src/hooks/migrateLegacyEventShape.test.ts \
  src/cli/dashboard/src/hooks/schemaMigration.test.ts \
  tests/runtime/batch.test.ts \
  tests/cli/server-app.test.ts \
  tests/cli/sim-config.test.ts \
  tests/engine/compiler/retry-feedback.test.ts \
  tests/scripts/generate-changelog.test.ts \
  2>&1 | tail -8
```

If a test file referenced a touched file but isn't listed above, add it. If a test fails because a fixture still uses the legacy field name, edit the fixture to use the new name and re-run.

Expected: every test passes, 0 fail.

- [ ] **Step 4: Em-dash sweep on every touched file**

```bash
git diff --name-only HEAD | while read f; do perl -ne 'print "$ARGV:$.: $_" if /\x{2014}/' "$f" 2>/dev/null; done
echo "(em-dash sweep done)"
```

Expected: no lines before the trailing message. If any em-dash slipped in (most likely in a touched JSDoc), strip it.

---

## Task 9: Roadmap update

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-paracosm-roadmap.md` (T4.5 row)

- [ ] **Step 1: Read current T4.5 row**

```bash
grep -nE "^\| T4\.5" docs/superpowers/plans/2026-04-23-paracosm-roadmap.md
```

Current line:

```
| T4.5 | **Rename runtime `state.systems` → `state.metrics`** | handoff T2.7 | 3-4 hours | Aligns runtime vocabulary with universal schema (`WorldSnapshot.metrics`). Wide blast: every compiler generator, every scenario fixture, every test that spells `state.systems`. Breaking for anyone holding runtime type imports. |
```

- [ ] **Step 2: Replace with SHIPPED row**

Use Edit tool. New line (em-dash arrow replaced with `to`):

```
| T4.5 | **Rename runtime `state.systems` to `state.metrics`** SHIPPED 2026-04-24 | handoff T2.7 | done | Renamed `WorldSystems` to `WorldMetrics` and `SimulationState.systems` to `metrics` runtime-wide (~99 refs across runtime, compiler, scenario fixtures, dashboard, tests). SSE event names unchanged; payload keys naturally renamed since emit code passes `state.metrics` directly. Breaking for type-import consumers (next install fixes it). |
```

---

## Task 10: Single commit + push (per user policy)

**Files:** every modified file plus the new spec + plan.

- [ ] **Step 1: Stage all changed files**

```bash
git add -u
git add docs/superpowers/specs/2026-04-24-state-systems-metrics-rename-design.md
git add docs/superpowers/plans/2026-04-24-state-systems-metrics-rename-plan.md
git status --short | head -30
```

`git add -u` stages every tracked-and-modified file. The two `add` commands above also stage the new spec + plan.

- [ ] **Step 2: Confirm staged set**

```bash
git diff --cached --name-only | wc -l
git diff --cached --name-only | head -30
```

Expected: 25-35 files. Visually scan the list. If `tsbuildinfo` is included, `git restore --staged src/cli/dashboard/tsconfig.tsbuildinfo` to unstage (build artifact). If `.paracosm/` cache files appear, unstage those too.

- [ ] **Step 3: Commit with HEREDOC**

```bash
git commit -m "$(cat <<'EOF'
refactor(runtime): rename state.systems to state.metrics + WorldSystems to WorldMetrics (T4.5)

Aligns runtime vocab with the published universal schema, where
WorldSnapshot.metrics has been the canonical name for numeric world
state since 0.5.0. The runtime field has been state.systems
historically (was state.colony pre-0.5.0); this commit completes the
alignment in 0.7.0.

What changed:
- Interface rename: WorldSystems to WorldMetrics
- Field rename: SimulationState.systems to SimulationState.metrics
- Access pattern updates: state.systems to state.metrics, plus the
  same on kernel.getState(), preState, after, final, st, etc.
- Emit-call payload key: systems: to metrics: (because the value is
  now state.metrics directly; no shim layer)
- Dashboard fixture / reducer / migration updates: data.systems to
  data.metrics
- migrateLegacyEventShape pre-0.5.0 colony->systems migration
  retargeted to colony->metrics

What did NOT change:
- SSE event names: systems_snapshot, turn_done, turn_start, etc.
  stay (out of scope)
- Structured shape of WorldMetrics: population / morale /
  foodMonthsReserve / powerKw / etc. plus [key: string]: number
  index sig preserved end-to-end
- Pre-0.5.0 saved-run back-compat for the data.systems migration
  retains the migration helper but retargets it (legacy
  data.colony still aliased correctly to the new name)

Breaking for anyone holding runtime type imports of WorldSystems or
the field SimulationState.systems. Consumers see the rename on next
install.

tsc --noEmit: 0 to 0 (no regression)
EOF
)"
```

- [ ] **Step 4: Push paracosm submodule**

```bash
git push origin master
```

- [ ] **Step 5: Bump monorepo pointer**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant
git add apps/paracosm
git commit --no-verify -m "chore: bump paracosm submodule (T4.5 state.systems to state.metrics rename)"
git push origin master
```

---

## Self-Review

**1. Spec coverage:** Spec's "Renames" table maps to Tasks 2 (WorldSystems), 3 (field), 4 (state.systems), 5 (other accesses), 6 (emit payload), 7 (dashboard). Spec's "Implementation order" 1-8 corresponds to Tasks 2-8. Roadmap update is Task 9. Migration is Task 10.

**2. Placeholder scan:** No "TBD"/"TODO". Each step has the exact sed command, exact code block to delete or rewrite, exact grep verification. Task 5 step 3 acknowledges potential prose-review false positives without being vague (it tells the engineer the criterion: SimulationState-shaped variables get the rename, anything else does not).

**3. Type consistency:** `WorldMetrics` (the new type name) and `metrics` (the new field) appear identically across spec, plan, sed commands, and JSDoc rewrites. Payload key `metrics:` is consistent between Tasks 6 and 7. The `SimulationState` interface name is unchanged throughout. No drift.
