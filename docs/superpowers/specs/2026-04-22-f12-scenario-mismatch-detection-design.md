# F12 — Scenario-mismatch detection on load

**Status:** design, awaiting approval
**Date:** 2026-04-22
**Scope:** dashboard-only. Fourth and final spec of the JSON-load UX bundle. Depends on [F9](./2026-04-22-f9-json-load-preview-modal-design.md) (preview modal) and [F11](./2026-04-22-f11-schema-version-gate-design.md) (schema-version gate). Parallel-shippable with F10.

---

## Motivation

A saved run carries per-event data that only makes sense against the scenario it was generated under. Mars events use Mars department ids, reference `boneDensityPct` / `cumulativeRadiationMsv` health fields, quote Mars labels (`populationNoun: "colonists"`). Load a Mars file into a dashboard whose active scenario is Submarine and:

- `labels.settlementNoun` in the UI reads "habitat" but events say "colony"
- Viz colors and metric axes assume Submarine's metric set
- Department names in the reports tab don't exist in the current scenario's configuration
- The scenario editor panel shows Submarine JSON while the timeline shows Mars events

No warning fires. The user sees a slow-burn "something is off" that only resolves by re-picking a file or swapping the active scenario.

F12 detects the mismatch at load time and surfaces it in F9's preview modal. User gets a clear choice: load anyway (degraded render), or swap the active scenario to match the file (clean render).

---

## Architecture

**Scenario identity on saved files.** F9 opportunistically adds `GameData.scenario?: { id: string; version: string; shortName: string }`. F12 makes that field the primary source of truth for the match check. When present, compare to the current `useScenarioContext()` value. When absent (older saves), fall back to the heuristic below.

**Heuristic fallback for files without `scenario` field.** Infer the file's scenario from signals in the event stream:
1. First event with `data.scenario.name` — the director emits this on turn 1
2. First event's `data.scenarioId` if emitted
3. `results[0].leader.unit` matching a known scenario's leader config
4. None of the above → render `"unknown scenario"` badge, no mismatch check (can't compare what we can't identify)

The inference is pure — lives alongside `extractPreviewMetadata` from F9 as a helper function `inferScenarioIdentity(data: GameData) → { id?, name?, source: 'declared' | 'inferred' | 'unknown' }`.

**Match states.**

| Condition | Match state | Modal behaviour |
|---|---|---|
| File's scenario id === current scenario id | `match` | No warning row. Standard modal. |
| File's scenario id !== current scenario id | `mismatch` | Warning row + action: "Swap to `<file-scenario>` before loading" |
| File's scenario unknown (heuristic returned nothing) | `unknown` | Info row: "Scenario unclear; load proceeds with current settings." |
| File has `scenario` field but its id is not in the dashboard's scenario catalog | `unavailable` | Warning: "This file was saved under `<name>` which is not in this dashboard's catalog. Loading will render with approximate labels." Confirm still enabled. |

---

## Swap-to-scenario action

A secondary button in the preview modal when state is `mismatch`: **Swap scenario then load**.

Click behaviour:

```
user clicks "Swap scenario then load"
    │
    ▼
  findScenarioInCatalog(file.scenario.id)
    │
    ├──► found in scenarioCatalog (built-in) → setActiveScenario(id); then dispatch normal confirm
    │
    ├──► found in customScenarioCatalog → setActiveScenario(id); then dispatch normal confirm
    │
    └──► not found → fallback to mismatch warning path, disable swap button with tooltip
           "Scenario <id> is not in your catalog. Import the scenario JSON first."
```

The "swap before load" flow avoids the halfway state where events mount against a mismatched scenario. Implementation: do the swap, wait one tick for `ScenarioContext` to propagate, then call `sse.loadEvents`. A `useEffect` in the `useLoadPreview` hook waits on `scenario.id` changing to the target value before triggering the dispatch.

---

## Data flow

```
parseFile → GameData  (from F9 + F11)
    │
    ▼
inferScenarioIdentity(data) → { id?, name?, source }
    │
    ▼
  compare to useScenarioContext().id
    │
    ▼
matchState: 'match' | 'mismatch' | 'unknown' | 'unavailable'
    │
    ▼
  include in previewMetadata → LoadPreviewModal renders accordingly
    │
    ▼
user click:
  - Load          → sse.loadEvents (current scenario stays)
  - Swap and load → setActiveScenario(target); useEffect → sse.loadEvents
  - Cancel        → no-op
```

---

## UI additions to F9's preview modal

When `matchState === 'mismatch'`:

```
  ┌──────────────────────────────────┐
  │ Scenario    Mars Genesis         │  ← file's scenario (extracted)
  │             ≠ current: Submarine │  ← mismatch indicator, red text
  │ Leaders     Aria Chen · Vik Voss │
  │ ...                              │
  └──────────────────────────────────┘

  ⚠  This file was saved under Mars Genesis.
     Your dashboard's active scenario is Submarine.
     Labels, colors, and department names will not match.

  [ Cancel ]  [ Load anyway ]  [ Swap to Mars Genesis and load ]
```

The tri-button row replaces F9's bi-button row only in the `mismatch` case. In `match` / `unknown` / `unavailable` cases, the bi-button row stays.

Styling: warning row uses the same pattern as F9's "This will replace..." warning (same warning color + icon). Swap button uses the primary-action accent color; Load anyway uses a muted neutral to gently discourage.

---

## Files

**Modified.**
- `src/cli/dashboard/src/hooks/useGamePersistence.ts` — `save()` writes `scenario: { id, version, shortName }` unconditionally (takes current `scenario` prop as input)
- `src/cli/dashboard/src/hooks/useLoadPreview.ts` — add `inferScenarioIdentity` + compute `matchState` in preview metadata
- `src/cli/dashboard/src/hooks/useLoadPreview.test.ts` — extend tests for match / mismatch / unknown / unavailable
- `src/cli/dashboard/src/components/layout/LoadPreviewModal.tsx` — branch the buttons row on `matchState`, add warning row, add swap handler
- `src/cli/dashboard/src/components/layout/LoadPreviewModal.module.scss` — swap-button variant + mismatch warning styling
- `src/cli/dashboard/src/App.tsx` — pass `setActiveScenario` callback into the preview hook's swap path

**No new files.** Layered onto F9 + F11.

---

## Rollout sequence

1. Extend `save()` to always write the `scenario` field (harmless addition — older dashboards just ignore it)
2. Add `inferScenarioIdentity` helper in the preview hook
3. Compute `matchState` in the metadata extractor
4. Update `LoadPreviewModal` to render based on `matchState`
5. Wire `setActiveScenario` through to the swap handler
6. Tests for each match state
7. Manual smoke:
   - Load a Mars save while active scenario is Mars → `match`, no warning
   - Load a Mars save while active scenario is Submarine → `mismatch`, three-button row, swap works
   - Load a Mars save while active scenario is a custom Submarine in `customScenarioCatalog` → `mismatch`, swap-button text still shows target name
   - Load a legacy save (pre-F9 scenario field) → `unknown`, single warning row, confirm stays enabled
   - Load a save with a `scenario.id` that isn't in this dashboard's catalog → `unavailable`, warning, swap disabled

---

## Testing

**Unit: inferScenarioIdentity**
- File with declared `data.scenario` → `{ id, name, source: 'declared' }`
- File without `scenario`, with first event `data.scenario.name: 'Mars Genesis'` → `{ name: 'Mars Genesis', source: 'inferred' }`
- File with neither → `{ source: 'unknown' }`

**Unit: matchState computation**
- declared match → `'match'`
- declared mismatch, target in catalog → `'mismatch'`
- declared mismatch, target NOT in catalog → `'unavailable'`
- inferred mismatch → `'mismatch'` with inferred scenario id
- unknown → `'unknown'`

**Component: LoadPreviewModal**
- Renders bi-button row in `match` / `unknown` / `unavailable`
- Renders tri-button row in `mismatch`
- Swap button click → `setActiveScenario(targetId)` called, then `onConfirm` fires after scenario context updates
- Load-anyway click in mismatch → `onConfirm` fires immediately without scenario change

---

## Acceptance criteria

- Saved files carry `scenario: { id, version, shortName }` from F12 forward
- Loading matched file → no warning, identical to F9 baseline
- Loading mismatched file → red warning row, three action buttons, swap action swaps the scenario then loads events cleanly
- Loading legacy / unknown-scenario file → soft info row, single confirm button, no hard block
- Loading file whose scenario isn't in the catalog → amber warning, swap disabled, Load-anyway still works
- Tests pass for all four match states
- SCSS module used; no inline styles
- Existing 77/77 dashboard tests still pass

---

## Out of scope

- **Auto-import the file's scenario JSON into the catalog** when the save embeds a full scenario definition. Possible future feature: save files could optionally carry the compiled `ScenarioPackage`; loading could offer "Import the scenario and load the run". Separate spec; too much surface for F12.
- **Partial compatibility matching.** "Mars v1.0" vs "Mars v1.1" — no semver-aware match; exact id match only. Version skew inside the same scenario family isn't a UX problem today.
- **Scenario version checks.** `scenario.version` is written + displayed but not used to block. A file saved under Mars v0.9 loads against Mars v1.0 without warning. That's fine; scenario hooks are forward-compatible within a minor range.

---

## Risks + notes

- **Scenario catalog shape.** `customScenarioCatalog` is user-state in localStorage. The swap-to-custom path needs to query the catalog at click time, not at preview-open time, so a scenario imported between preview-open and click is available. Implementation: pass the catalog lookup as a callback, resolved at swap time.
- **One-tick async between swap and dispatch.** The `useEffect` pattern is mildly racy if the user cancels during that tick. Guard with a local `pendingSwap` state that aborts the dispatch on cancel. Covered in the state-machine tests.
- **Legacy saves proliferate forever.** Files saved before F12 lands never carry the `scenario` field. The heuristic fallback handles them indefinitely; no cleanup required.
- **Two builtin scenarios today** (Mars, Lunar). Both scenarios write `scenario.id` of `mars-genesis` and `lunar-outpost` respectively. Inference from event payloads should match these exact ids.
