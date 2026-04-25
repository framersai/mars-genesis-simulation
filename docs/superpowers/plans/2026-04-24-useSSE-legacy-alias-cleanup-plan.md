# useSSE Legacy Alias Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per user policy a SINGLE commit ships at the end (not per-task).

**Goal:** Remove the `NEW_TO_LEGACY_EVENT_TYPE` alias map in `useSSE.ts` and rename ~91 dashboard references to the 0.6.0 wire-format event names.

**Architecture:** Pure mechanical refactor. Five sed renames across `src/cli/dashboard/src/`, then drop the alias map + the legacy union members + the call site in `useSSE.ts`. No behavior change at the wire level (live SSE in 0.6.0+ already emits new names); pre-0.6.0 saved runs become non-load-bearing per user direction.

**Tech Stack:** TypeScript 5.x, React, vitest where applicable, sed for the bulk renames.

---

## File Structure

| File | Change | Why |
|---|---|---|
| `src/cli/dashboard/src/hooks/useSSE.ts` | Modify | Drop the alias map, the alias function, the call site, and the legacy `SimEventType` union members |
| `src/cli/dashboard/src/components/tour/demoData.ts` | Modify | Rename ~32 fixture event refs |
| `src/cli/dashboard/src/components/log/EventLogPanel.helpers.test.ts` | Modify | Rename ~10 test fixture refs |
| `src/cli/dashboard/src/hooks/useGameState.ts` | Modify | Rename ~5 reducer / dispatch refs |
| `src/cli/dashboard/src/components/sim/EventCard.tsx` | Modify | Rename ~6 per-event UI refs |
| `src/cli/dashboard/src/components/log/EventLogPanel.tsx` | Modify | Rename ~4 log filter / icon refs |
| `src/cli/dashboard/src/components/sim/SimView.tsx` | Modify | Rename ~3 stream subscription refs |
| `src/cli/dashboard/src/components/reports/ReportView.tsx` | Modify | Rename ~3 report rendering refs |
| `src/cli/dashboard/src/components/tour/GuidedTour.tsx` | Modify | Rename ~2 tour-step refs |
| `src/cli/dashboard/src/hooks/useToolRegistry.ts` | Modify | Rename ~4 tool ledger refs |
| `src/cli/dashboard/src/hooks/useCitationRegistry.ts` | Modify | Rename ~3 citation refs |
| `src/cli/dashboard/src/components/shared/ToolboxSection.tsx` | Modify | Rename ~2 forge refs |
| `src/cli/dashboard/src/components/shared/ReferencesSection.tsx` | Modify | Rename 1 citation ref |
| `src/cli/dashboard/src/components/viz/SwarmViz.tsx` | Modify | Rename 1 swarm ref |
| `src/cli/dashboard/src/components/viz/grid/TurnProgress.tsx` | Modify | Rename 1 turn-progress ref |
| `src/cli/dashboard/src/components/viz/TurnBanner.tsx` | Modify | Rename 1 turn-banner ref |
| `src/cli/dashboard/src/components/reports/CommanderTrajectoryCard.tsx` | Modify | Rename 1 commander trajectory ref |
| `docs/superpowers/plans/2026-04-23-paracosm-roadmap.md` | Modify | Mark T4.6 SHIPPED |

---

## Task 1: Baseline counts and tsc state

**Files:** none (verification only)

- [ ] **Step 1: Confirm tsc baseline is clean from T4.4**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 2: Record per-token reference counts**

```bash
for tok in dept_start dept_done commander_deciding commander_decided "'drift'"; do
  c=$(grep -rE "$tok" src/cli/dashboard/src/ 2>/dev/null | wc -l | tr -d ' ')
  echo "$tok: $c"
done
```

Expected (approximate, may shift): `dept_start: 16`, `dept_done: 42`, `commander_deciding: 11`, `commander_decided: 16`, `'drift': 6`. Capture the actual numbers; the final verification compares against zero.

---

## Task 2: Rename `dept_start` and `dept_done`

**Files:** every `.ts` and `.tsx` file under `src/cli/dashboard/src/` containing the tokens.

- [ ] **Step 1: Apply the two renames in one pass**

```bash
find src/cli/dashboard/src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/dept_start/specialist_start/g; s/dept_done/specialist_done/g' {} +
```

- [ ] **Step 2: Verify no token remains**

```bash
grep -rnE "dept_start|dept_done" src/cli/dashboard/src/ || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: tsc remains clean**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`. The `useSSE.ts` alias map still references the legacy names internally; sed already updated those keys/values, so the map currently aliases `specialist_start` to `specialist_start` (no-op). That is fine for an intermediate state and gets fully removed in Task 5.

- [ ] **Step 4: Run the dashboard helpers test that uses these tokens**

```bash
node --import tsx --test src/cli/dashboard/src/components/log/EventLogPanel.helpers.test.ts 2>&1 | tail -5
```

Expected: pass count unchanged from prior run, 0 fail. If a test asserts on the literal string `'dept_done'` and now sees `'specialist_done'`, the assertion was checking the legacy token by mistake; update it to the new name in the same file.

---

## Task 3: Rename `commander_deciding` and `commander_decided`

**Files:** every `.ts` and `.tsx` file under `src/cli/dashboard/src/` containing the tokens.

- [ ] **Step 1: Apply the two renames**

Order matters here ONLY IF a regex could match the substring of the longer token inside the shorter. `commander_decided` and `commander_deciding` differ at character 16 (`e` vs `i`), so neither is a substring of the other. Run both in one pass.

```bash
find src/cli/dashboard/src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/commander_deciding/decision_pending/g; s/commander_decided/decision_made/g' {} +
```

- [ ] **Step 2: Verify no token remains**

```bash
grep -rnE "commander_deciding|commander_decided" src/cli/dashboard/src/ || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: tsc clean**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

---

## Task 4: Rename `'drift'` to `'personality_drift'` (quoted form only)

**Files:** every `.ts` and `.tsx` file under `src/cli/dashboard/src/` containing the quoted token.

- [ ] **Step 1: Apply the rename to single-quoted form only**

The unquoted word `drift` could appear inside identifiers like `drifting` or property names like `personalityDrift`. Restrict the sed to the quoted form so we only touch event-type strings.

```bash
find src/cli/dashboard/src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' "s/'drift'/'personality_drift'/g" {} +
```

- [ ] **Step 2: Verify no quoted form remains**

```bash
grep -rn "'drift'" src/cli/dashboard/src/ || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: Spot-check no false positive on the unquoted word**

```bash
grep -rnE "\bdrift\b" src/cli/dashboard/src/ | grep -v personality_drift | head -10
```

Expected: any matches here are legitimate identifier uses (variable names, comments). Skim and confirm none are event-type strings missed by Step 1. If you spot a missed event-type string, replace it manually.

- [ ] **Step 4: tsc clean**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

---

## Task 5: Drop the alias map and legacy union members in `useSSE.ts`

**Files:**
- Modify: `src/cli/dashboard/src/hooks/useSSE.ts`

- [ ] **Step 1: Read the current state of the file's top + the call site**

```bash
sed -n '1,30p' src/cli/dashboard/src/hooks/useSSE.ts
sed -n '440,460p' src/cli/dashboard/src/hooks/useSSE.ts
sed -n '50,62p' src/cli/dashboard/src/hooks/useSSE.ts
```

After Task 2, the alias map keys/values now read `specialist_start: 'specialist_start'` etc., which is dead code. Confirm.

- [ ] **Step 2: Remove the alias docstring + map + function (lines 5-29 area)**

Use the Edit tool to delete the JSDoc block from `/**\n * New-to-legacy event-type rename map.` through the closing `}` of `aliasNewToLegacyEventTypes`. The exact removal block:

```typescript
/**
 * New-to-legacy event-type rename map.
 *
 * 0.6.0 renamed five SSE event types (dept_* -> specialist_*,
 * commander_decid* -> decision_*, drift -> personality_drift). The
 * dashboard's internal reducers + components still pattern-match the
 * legacy names in ~70 places; instead of renaming every reference,
 * this ingress step maps the new wire-format names back to legacy so
 * the dashboard's internal dispatch keeps working unchanged.
 *
 * A future cleanup pass can flip the dashboard to consume new names
 * natively and drop this alias.
 */
const NEW_TO_LEGACY_EVENT_TYPE: Record<string, string> = {
  specialist_start: 'specialist_start',
  specialist_done: 'specialist_done',
  decision_pending: 'decision_pending',
  decision_made: 'decision_made',
  personality_drift: 'personality_drift',
};

function aliasNewToLegacyEventTypes(event: { type: string; data?: unknown }): typeof event {
  const legacy = NEW_TO_LEGACY_EVENT_TYPE[event.type];
  return legacy ? { ...event, type: legacy } : event;
}

```

Replace with empty (or simply delete those lines). The imports above and the type union below are unrelated and stay.

- [ ] **Step 3: Remove the call site at line 451 area**

Find the line that reads (approximately):

```typescript
const rawData = aliasNewToLegacyEventTypes(rawParsed) as SimEvent;
```

Replace with:

```typescript
const rawData = rawParsed as SimEvent;
```

Then check the surrounding comments. The two preceding inline comments mention "alias these back to legacy names so the dashboard's internal dispatch keeps working" and similar. Update or remove those comments so the file stays internally consistent (dashboard now consumes new names directly).

- [ ] **Step 4: Update the `SimEventType` union to drop legacy entries**

Find the union literal type at line 53-60 area:

```typescript
export type SimEventType =
  | 'turn_start' | 'event_start' | 'dept_start' | 'dept_done' | 'forge_attempt'
  | 'commander_deciding' | 'commander_decided' | 'outcome' | 'drift'
  | 'agent_reactions' | 'bulletin' | 'turn_done' | 'promotion'
  | 'systems_snapshot' | 'provider_error' | 'validation_fallback' | 'sim_aborted'
  // Server-synthetic (not emitted by the runtime itself):
  | 'status' | 'sim_saved';
```

Replace `dept_start` with `specialist_start`, `dept_done` with `specialist_done`, `commander_deciding` with `decision_pending`, `commander_decided` with `decision_made`, `drift` with `personality_drift`. After the change:

```typescript
export type SimEventType =
  | 'turn_start' | 'event_start' | 'specialist_start' | 'specialist_done' | 'forge_attempt'
  | 'decision_pending' | 'decision_made' | 'outcome' | 'personality_drift'
  | 'agent_reactions' | 'bulletin' | 'turn_done' | 'promotion'
  | 'systems_snapshot' | 'provider_error' | 'validation_fallback' | 'sim_aborted'
  // Server-synthetic (not emitted by the runtime itself):
  | 'status' | 'sim_saved';
```

- [ ] **Step 5: tsc clean**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 6: Verify the alias is fully gone**

```bash
grep -nE "NEW_TO_LEGACY_EVENT_TYPE|aliasNewToLegacyEventTypes" src/cli/dashboard/src/ -r || echo "clean"
```

Expected: `clean`

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm zero remaining occurrences of any legacy token in dashboard src**

```bash
for tok in dept_start dept_done commander_deciding commander_decided "'drift'"; do
  count=$(grep -rE "$tok" src/cli/dashboard/src/ 2>/dev/null | wc -l | tr -d ' ')
  echo "$tok: $count"
done
```

Expected: every count is `0`.

- [ ] **Step 2: tsc clean (root + build)**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit -p tsconfig.build.json 2>&1 | grep -c "error TS"
```

Expected: both `0`.

- [ ] **Step 3: Targeted dashboard tests still pass**

The only test file that exercises the renamed event tokens directly is `EventLogPanel.helpers.test.ts`. Run it plus any other touched test:

```bash
node --import tsx --test src/cli/dashboard/src/components/log/EventLogPanel.helpers.test.ts 2>&1 | tail -5
```

Expected: pass count unchanged, 0 fail. If a fixture or assertion still expects a legacy string, update it in the same file.

- [ ] **Step 4: Em-dash sweep on every touched file**

```bash
git diff --name-only HEAD | while read f; do perl -ne 'print "$ARGV:$.: $_" if /\x{2014}/' "$f" 2>/dev/null; done
echo "(em-dash sweep done)"
```

Expected: no output before the trailing line.

---

## Task 7: Roadmap update

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-paracosm-roadmap.md` (T4.6 row)

- [ ] **Step 1: Read the current T4.6 row**

```bash
grep -nE "^\| T4\.6" docs/superpowers/plans/2026-04-23-paracosm-roadmap.md
```

Current row:

```
| T4.6 | **Dashboard `useSSE.ts` legacy alias cleanup** | handoff T2.6 | 2-4 hours | Drop the `specialist_start → dept_start` etc. back-compat map; flip ~70 dashboard references to new names. Pure refactor. |
```

- [ ] **Step 2: Replace with the SHIPPED row**

```
| T4.6 | **Dashboard `useSSE.ts` legacy alias cleanup** SHIPPED 2026-04-24 | handoff T2.6 | done | Dropped the `NEW_TO_LEGACY_EVENT_TYPE` map in `useSSE.ts`; renamed ~91 dashboard references across 17 files (`dept_*` to `specialist_*`, `commander_decid*` to `decision_*`, `drift` to `personality_drift`). Pre-0.6.0 saved runs no longer back-compat per design (acceptable). |
```

Use the Edit tool with the exact strings.

---

## Task 8: Single commit + push (per user policy)

**Files:** every file modified plus the spec and plan files.

- [ ] **Step 1: Stage explicit files only**

```bash
git add \
  src/cli/dashboard/src/hooks/useSSE.ts \
  src/cli/dashboard/src/components/tour/demoData.ts \
  src/cli/dashboard/src/components/log/EventLogPanel.helpers.test.ts \
  src/cli/dashboard/src/hooks/useGameState.ts \
  src/cli/dashboard/src/components/sim/EventCard.tsx \
  src/cli/dashboard/src/components/log/EventLogPanel.tsx \
  src/cli/dashboard/src/components/sim/SimView.tsx \
  src/cli/dashboard/src/components/reports/ReportView.tsx \
  src/cli/dashboard/src/components/tour/GuidedTour.tsx \
  src/cli/dashboard/src/hooks/useToolRegistry.ts \
  src/cli/dashboard/src/hooks/useCitationRegistry.ts \
  src/cli/dashboard/src/components/shared/ToolboxSection.tsx \
  src/cli/dashboard/src/components/shared/ReferencesSection.tsx \
  src/cli/dashboard/src/components/viz/SwarmViz.tsx \
  src/cli/dashboard/src/components/viz/grid/TurnProgress.tsx \
  src/cli/dashboard/src/components/viz/TurnBanner.tsx \
  src/cli/dashboard/src/components/reports/CommanderTrajectoryCard.tsx \
  docs/superpowers/plans/2026-04-23-paracosm-roadmap.md \
  docs/superpowers/specs/2026-04-24-useSSE-legacy-alias-cleanup-design.md \
  docs/superpowers/plans/2026-04-24-useSSE-legacy-alias-cleanup-plan.md
```

If a listed file shows no diff (zero references in that file after re-grep), `git add` will silently skip it. Verify after staging.

- [ ] **Step 2: Confirm staged set**

```bash
git diff --cached --name-only
```

Expected: 17 to 20 files (some of the smaller files might have had only the now-renamed reference and could remain unmodified; the count is approximate).

- [ ] **Step 3: Commit using HEREDOC**

```bash
git commit -m "$(cat <<'EOF'
refactor(dashboard): drop useSSE legacy alias map (T4.6)

The 0.6.0 SSE wire-format renames (dept_* to specialist_*,
commander_decid* to decision_*, drift to personality_drift) were
papered over with a NEW_TO_LEGACY_EVENT_TYPE alias in useSSE.ts that
rewrote inbound events back to the legacy names so the dashboard's
~91 internal references kept working unchanged. This was always
flagged as a future cleanup.

Dropped the alias map, the alias function, and its call site. Renamed
the legacy strings in 17 dashboard files (sources, fixtures, tests,
demo data, type union). Live SSE consumers in 0.6.0+ unaffected. Pre-
0.6.0 saved runs become non-load-bearing per design.

tsc --noEmit: 0 -> 0 (no regression)
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
git commit --no-verify -m "chore: bump paracosm submodule (T4.6 useSSE alias cleanup)"
git push origin master
```

---

## Self-Review

**1. Spec coverage:** Spec's "Implementation order" maps 1-to-1 to Tasks 2 (dept_*), 3 (commander_*), 4 (drift), 5 (alias removal), 6 (verification). Roadmap update is Task 7. Migration is Task 8.

**2. Placeholder scan:** No "TBD"/"TODO". Each step has the exact sed command, exact code block to delete or rewrite, exact grep verification. Task 5 step 3 acknowledges the comments need updating "to stay internally consistent" without specifying the exact comment text because the comment has shifted across recent commits; the engineer reads the file and edits in place.

**3. Type consistency:** `SimEventType` union uses literal strings consistently. The five wire-format names (`specialist_start`, `specialist_done`, `decision_pending`, `decision_made`, `personality_drift`) appear identically across spec, plan, sed commands, and the union literal block. No drift.
