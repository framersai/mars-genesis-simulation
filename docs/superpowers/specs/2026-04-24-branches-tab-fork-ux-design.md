# Design: Branches tab + dashboard fork UX (Tier 2 Spec 2B)

**Date:** 2026-04-24
**Status:** Approved for execution. Initiation model **(C)** confirmed: fork appends to the current session; parent view stays put; branches accumulate in a new "Branches" tab.
**Scope:** Dashboard + server surface for paracosm's `WorldModel.fork()` API (Spec 2A, shipped in [`161f1e4d`](../plans/2026-04-23-paracosm-roadmap.md#tier-2-worldmodelforkatturn-spec-2a-shipped-2026-04-24-spec-2b-pending)). Users trigger forks from the Reports tab, pick a new leader in a modal, and see all branches grouped under a "Branches" tab next to the parent run.
**Depends on:** Spec 2A shipped. `WorldModel.forkFromArtifact`, `captureSnapshots`, and `metadata.forkedFrom` are available today.
**Code impact:** Additive. No breaking API changes. No `COMPILE_SCHEMA_VERSION` bump. Extends the existing `/setup` endpoint with two optional fields; adds one optional GET endpoint.

---

## 1. Problem

Spec 2A landed the programmatic fork API but no user-facing path to trigger it. A dashboard user today can see that their run diverges along HEXACO personality lines (the Reports tab + StatsBar make this clear), but they cannot ask "what if THIS leader had decided differently at turn 3" without restarting from turn 0, paying the full run cost, and losing the parent run's state from view.

The CWSM positioning promises counterfactual exploration as a first-class operation. Until a user can click "fork at turn 3, try a different leader, compare" directly in the dashboard, the positioning is ahead of the product.

Spec 2B closes that gap. After this spec ships, any user running paracosm with `captureSnapshots: true` (or through the dashboard UI, which will default to `true`) can branch any past turn with a different leader or seed and see both trajectories in one view.

## 2. Feasibility (verified)

From the audit performed during brainstorming:

- Server already has a `/setup` POST endpoint ([server-app.ts:1448](../../src/cli/server-app.ts#L1448)) that accepts config JSON and launches a simulation via `runSimulation`. Extending its config shape with optional fork fields is additive and safe.
- Dashboard tab routing is open-list: `DASHBOARD_TABS = ['sim', 'viz', 'settings', 'reports', 'chat', 'log', 'about']` ([tab-routing.ts:1](../../src/cli/dashboard/src/tab-routing.ts#L1)). Adding `'branches'` is a one-line change.
- `ReportView` renders per-turn blocks already ([ReportView.tsx:88](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L88)); injecting a "Fork at turn N" button into each turn row is a local component-level edit.
- `WorldModel.forkFromArtifact` is the sole dependency for the server side. All error paths (missing snapshots, out-of-range turn, scenario mismatch) are covered in Spec 2A.
- Run history is already stored server-side in `runHistoryStore` ([server-app.ts:1513](../../src/cli/server-app.ts#L1513)). Fork lookup by `runId` is a method call on the existing store.

Nothing blocks this work.

## 3. Design

Six layers, each with a single responsibility.

### 3.1 Server: extend `/setup` with fork config

Two new optional fields on the setup POST body. No new endpoint; no change to existing fields. **Client-authority model:** the dashboard sends the full parent artifact in the request body rather than having the server look it up. Rationale in the audit note at the end of this section.

```typescript
interface SetupConfig {
  // existing fields: leaders, turns, seed, models, economics, etc.

  /**
   * Optional fork parent. When set, the run resumes from the supplied
   * parent artifact at `atTurn` rather than starting fresh. The server
   * calls `WorldModel.forkFromArtifact(parentArtifact, atTurn)` and
   * runs the forked simulation starting at `atTurn + 1`. The parent
   * artifact must include `scenarioExtensions.kernelSnapshotsPerTurn`
   * (i.e. was run with `captureSnapshots: true`) or the fork fails
   * fast.
   *
   * When set, `leaders` must contain EXACTLY ONE leader (the
   * override for the forked branch). Mixing fork + multi-leader
   * setup in one request is rejected with 400.
   *
   * The body is large (a 6-turn 100-agent parent artifact with
   * snapshots runs ~500 KB). Fine for developer-local dashboards;
   * hosted-demo deployments already rate-limit the endpoint and can
   * additionally gate fork requests by body size.
   */
  forkFrom?: { parentArtifact: RunArtifact; atTurn: number };

  /**
   * Opt-in kernel snapshot capture. Dashboard defaults to `true` for
   * every UI-initiated run (so forks are always possible); direct
   * API consumers can set it explicitly. Off by default on the
   * programmatic side per Spec 2A to keep artifacts lean.
   */
  captureSnapshots?: boolean;
}
```

Server-side flow when `forkFrom` is present:

1. Reject with 400 if `config.leaders.length !== 1`. Forks are single-leader by design.
2. Reject with 400 if `forkFrom.parentArtifact.metadata.scenario.id !== activeScenario.id`. Cross-scenario forks forbidden.
3. Reject with 400 if `forkFrom.parentArtifact.scenarioExtensions?.kernelSnapshotsPerTurn` is missing or empty. Error body includes the `captureSnapshots: true` pointer.
4. Reject with 409 if `simRunning && activeSimAbortController` (per existing active-run guard at [server-app.ts:1550](../../src/cli/server-app.ts#L1550)). Parent must settle before fork.
5. Construct the WorldModel: `const wm = WorldModel.fromScenario(activeScenario)`.
6. Fork: `const forkedWm = await wm.forkFromArtifact(forkFrom.parentArtifact, forkFrom.atTurn)`.
7. Simulate: `await forkedWm.simulate(leader, { maxTurns, seed, captureSnapshots: true, onEvent: (ev) => emit(ev), ... })`.
8. SSE stream emits turn events as normal starting from `atTurn + 1`. Clients that don't understand forks see a normal event stream; clients that do read `metadata.forkedFrom` from the final artifact.

**Audit note on client-authority.** The original spec draft assumed `runHistoryStore.getArtifactByRunId(runId)` would look up the parent server-side. A source audit showed `RunHistoryStore` today stores only `RunRecord` metadata (runId, scenarioId, leaderConfigHash, economicsProfile, sourceMode, createdBy) via `insertRun / listRuns / getRun`, not the full artifact ([run-history-store.ts](../../src/cli/server/run-history-store.ts)). Storing full artifacts server-side would require a persistence-layer rewrite (filesystem blobs, SQLite, or an in-memory cache), which is out of scope for 2B (T4.3 covers it). Client-authority is simpler, narrower, and matches the existing "dashboard holds state; server processes requests" pattern. The dashboard always has the parent artifact in memory when the user clicks Fork (it just finished the run), so the request body is free.

### 3.2 No fork-history endpoint

Originally spec'd `GET /runs/forks?parentRunId=`. Dropped: since the client holds authority over parent + branch artifacts (it created all of them in-session), the Branches tab reads from dashboard-side state, not server state. Reload-across-sessions for branch history is out of scope; the existing Load menu + client-side persistence already cover single-artifact reload, and multi-branch session persistence can land in a T4.3 follow-up when SQLite persistence lands.

### 3.3 Dashboard: "Fork at turn N" button

Location: per-turn row in `ReportView.tsx`, right-rail. Visible only when:
- The current run's artifact has `scenarioExtensions.kernelSnapshotsPerTurn` populated, AND
- The run has reached at least the turn being rendered (can't fork a future turn).

Copy: `↳ Fork at {labels.Time} {turn}`. Uses the existing `useScenarioLabels` hook for the time-unit noun.

Click handler opens the fork modal with `{ parentRunId, atTurn }` preset.

### 3.4 Dashboard: fork modal

New component at `src/cli/dashboard/src/components/reports/ForkModal.tsx`. Opens in-place over the dashboard (using the existing `Tooltip` / modal shell pattern, or a new lightweight overlay; exact choice during implementation).

Fields:

1. **Leader override** (required). Leader picker with three sources:
   - Scenario preset leaders (`scenario.presets[0].leaders`): Visionary, Engineer, etc.
   - Current session's custom leaders from Settings panel (if configured).
   - "Build a new leader" link that opens a mini-form with name + archetype + HEXACO sliders.
2. **Seed override** (optional). Number input; placeholder shows parent's seed.
3. **Custom events** (optional, advanced-collapsed). Text area with format `{turn}: {title}: {description}`, one per line. Parsed client-side before POST.
4. **Cost estimate** (read-only). Computed from `(scenario.setup.defaultTurns - atTurn)` × per-turn rate for current `costPreset`. Updates live as the user changes fields.
5. **Confirm + Cancel**. Confirm POSTs to `/setup` with the fork payload.

### 3.5 Dashboard: "Branches" tab

New tab inserted between `reports` and `chat` in `DASHBOARD_TABS`. Component at `src/cli/dashboard/src/components/branches/BranchesTab.tsx`.

Contents:

- **Parent run card** at top. Shows: scenario name, parent leader (or "original run"), fingerprint, final `metrics`, `statuses`, `environment`, completion timestamp.
- **Branch cards** below, one per forked run, stacked vertically (desktop) or scrolled (mobile). Each card shows:
  - Forked-at-turn badge: `Forked at {labels.Time} {atTurn}`.
  - Leader override: name + archetype.
  - Branch fingerprint.
  - Per-metric delta vs parent, using `formatBagTooltip`-style rendering: `Pop +12, Morale -8%, Tools +2, Citations +4`. Up to 4 deltas on the card; rest in a tooltip.
  - Status badge: `Running` (with live turn count), `Complete`, `Aborted`, or `Error`.
- **Empty state** when no branches yet: short "No branches yet. Fork the parent run from the Reports tab." message.
- **Single-click on a branch card**: loads that branch into the Reports tab (uses the existing load-from-artifact-id pathway) and navigates to `reports`.

No trajectory line charts in 2B. That's T5.1 (dashboard viz kit) territory; this tab is text + deltas.

### 3.6 State wiring

- New context: `BranchesContext` in `App.tsx`. Holds `{ parent?: RunArtifact, branches: RunArtifact[] }`.
- `parent` is the current session's completed run (captured once it reaches terminal state). `branches` is the list of forked runs produced in the same session.
- When the user confirms the fork modal, an optimistic branch entry is inserted immediately (status: `Running`, 0 turns). SSE events from the fork run update it; when the run's final `sim_done` / equivalent terminal event arrives, the entry flips to the authoritative `RunArtifact` that the dashboard assembled from the event stream (existing pattern from `useSSE` + `useGameState`).
- No server polling. All state is client-side.
- Branches tab reads from `BranchesContext`; button + modal use `useDashboardNavigation` to navigate to it on confirm.

### 3.7 Client-side delta computation

A pure helper `src/cli/dashboard/src/components/branches/BranchesTab.helpers.ts`:

```typescript
export interface BranchDelta {
  metric: string;
  parentValue: number | string | boolean;
  branchValue: number | string | boolean;
  /** Numeric diff when both values are numbers; "changed" when mixed type. */
  delta?: number;
  direction?: 'up' | 'down' | 'changed';
}

export function computeBranchDeltas(
  parent: RunArtifact,
  branch: RunArtifact,
): BranchDelta[];
```

Implementation iterates `parent.finalState.metrics` / `statuses` / `environment` and computes deltas against `branch.finalState.*`. Unit-tested in isolation; the render layer consumes the typed output.

## 4. End-to-end data flow

1. User runs a simulation in the dashboard. Server picks up `/setup`, runs with `captureSnapshots: true` (dashboard default), emits SSE events, stores the completed artifact in `runHistoryStore` with per-turn kernel snapshots embedded.
2. User opens the Reports tab, sees per-turn blocks. Each turn has a `↳ Fork at Year 3` button (or Quarter 3 / Day 3 per scenario).
3. User clicks fork on turn 3. Modal opens with `parentRunId` + `atTurn: 3` preset.
4. User picks a different leader from the preset dropdown. Confirms.
5. Modal POSTs to `/setup` with `{ forkFrom: { runId, atTurn: 3 }, leaders: [newLeader], turns: parent.turns, seed: parent.seed, captureSnapshots: true }`.
6. Server looks up parent, validates, calls `WorldModel.forkFromArtifact(parent, 3).simulate(newLeader, ...)`, streams SSE events.
7. Dashboard's `BranchesContext` gets an optimistic entry for the new run (status: `Running`, turn: 0).
8. Turn events arrive, StatsBar animates the new run alongside the parent's final state. `BranchesContext` updates the branch's status + current turn.
9. Run completes. Server inserts artifact into `runHistoryStore`. Dashboard's `useBranches` poll picks it up on next tick. Branch card flips to `Complete` with final fingerprint + deltas rendered.
10. User clicks the branch card. Reports tab loads the branch artifact. User drills into the branch's per-turn detail. Navigates back to Branches tab to compare.

## 5. What's deliberately out of scope

- **Trajectory line charts / divergence visualization.** Deferred to T5.1 dashboard viz kit.
- **Concurrent fork runs.** Current server architecture runs one simulation at a time; fork must wait for parent (or any active run) to finish. Concurrent runs = server rearchitecture, separate spec.
- **Nested forks / fork genealogy tree.** A fork can currently only be rooted at the original parent. Forking a fork is possible (the second fork's `forkedFrom.parentRunId` points at the first fork), but the Branches tab renders a flat list, not a tree.
- **Auto-fork from stored artifact on disk.** User must have the parent in the current session (loaded via Load menu or just-run). Load menu already handles this; no new affordance needed here.
- **Cross-scenario fork.** Server returns 400. Users wanting to compare across scenarios must run separate simulations.
- **Live parent-and-branch side-by-side streaming.** Parent must be complete before fork can start. Dashboard's single-sim state machine enforces this.

## 6. Tests

1. **Server fork route unit** (`tests/cli/server-app-fork.test.ts`):
   - `/setup` with valid `forkFrom` + 1 leader + parent artifact in body → calls `WorldModel.forkFromArtifact` with right args.
   - `/setup` with `forkFrom` + 2 leaders → 400.
   - `/setup` with `forkFrom` where parent artifact has no `kernelSnapshotsPerTurn` → 400 with captureSnapshots pointer.
   - `/setup` with `forkFrom` on wrong-scenario parent artifact → 400.
   - `/setup` with `forkFrom` while a run is already active → 409.
   - Active-run conflict error body carries the current run's runId so the client can surface it.
2. **Modal render helpers** (`tests/cli/dashboard/components/reports/ForkModal.helpers.test.ts`):
   - Cost estimate computes correctly for economy + quality presets.
   - Custom events parser handles valid + invalid lines.
   - Leader preset resolution falls back cleanly when scenario has no presets.
3. **Branches tab delta helper** (`tests/cli/dashboard/components/branches/BranchesTab.helpers.test.ts`):
   - Numeric deltas: `parent.metrics.population = 100, branch = 112` → `{ delta: +12, direction: 'up' }`.
   - String / boolean deltas: `parent.statuses.fundingRound = 'seed', branch = 'series-a'` → `{ direction: 'changed' }`.
   - Omits keys that exist in only one bag.
   - Sorts by absolute delta magnitude descending (largest divergence first).

No real-LLM smokes in 2B; the fork flow's kernel correctness is already covered by Spec 2A's determinism invariant test.

## 7. Docs

- **README**: one-sentence addition to the counterfactual section added in Spec 2A: "The dashboard's Reports tab exposes a `↳ Fork at {Time} N` button on each turn; forked runs accumulate under a Branches tab for side-by-side comparison."
- **Positioning map**: no change; the CWSM section's "The API" bullet from Spec 2A already covers the mechanism. Add one parenthetical about the UI.
- **Roadmap**: move Tier 2 (whole tier, both specs) to Shipped.

No new standalone doc. The feature is small enough that JSDoc + README update is proportional.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| User triggers fork while parent is still running | UI disables fork button until parent completes. Backend enforces: `/setup` with `forkFrom` rejects with 409 if a run is currently active. |
| Fork modal's "build a new leader" can produce invalid HEXACO | Reuse the existing `SettingsPanel` leader builder's validation. No new validation code; share a helper. |
| Request body is large (500 KB for full parent artifact with snapshots) | Acceptable for developer-local dashboard (loopback); hosted-demo deployments already rate-limit `/setup` per-IP and can add a request-size cap. If compression is ever needed, it's server-layer config, not a protocol change. |
| Client loses branch state on reload | Out of scope for 2B. Existing Load menu persists individual artifacts; multi-artifact branch history persistence is T4.3 (SQLite persistence adapter) territory. |
| Branch cards compute deltas on render; expensive for 20+ branches | `computeBranchDeltas` is O(n) in bag-key count and memoized via `useMemo` keyed on artifact pair. Stays under 1ms per card. |
| Optimistic branch entry orphaned if the forked run crashes before first turn | SSE stream emits `sim_aborted` + `provider_error` events; branch entry flips to `Error` status when either arrives. A watchdog timeout (30s without any SSE event) also flips to `Error` with a retry action, matching the existing orchestrator abort-on-disconnect pattern. |

## 9. Success criteria

1. **End-to-end flow works.** User clicks fork → modal → confirm → dashboard shows new run streaming → Branches tab shows the completed branch with deltas. Manual verification with a real scenario (Mars or corporate-quarterly).
2. **Tests pass.** 606 pass / 0 fail / 1 skip → roughly 618+ pass / 0 fail / 1 skip (baseline + ~12 new unit tests across server route + modal helpers + deltas).
3. **`tsc --noEmit` clean.** Only pre-existing Zod-v4 warnings.
4. **`npm run build` exit 0.** New files emit cleanly.
5. **No em-dashes** in any newly authored file.
6. **Dashboard Vite build succeeds.** `npx vite build` inside `src/cli/dashboard/` exits 0 (if environment permits; the earlier session noted a pre-existing tailwindcss install issue unrelated to this work).

## 10. Execution order

Single-commit ship at the end (user's commit-batching preference; CI auto-publishes once per push):

1. Server: extend `/setup` config schema with `forkFrom` + `captureSnapshots`.
2. Server: implement fork path in `/setup` handler (parent-artifact validation, `WorldModel.forkFromArtifact`, simulate). Reuses existing `simRunning` guard.
3. Server tests: 5 fork-route unit tests.
4. Dashboard: add `'branches'` to `DASHBOARD_TABS`. Tab-routing + nav wiring.
5. Dashboard: `BranchesContext` + reducer actions for optimistic insert / SSE update / terminal.
6. Dashboard: `BranchesTab.helpers.ts` with `computeBranchDeltas` + unit tests.
7. Dashboard: `BranchesTab.tsx` component reading from context.
8. Dashboard: `ForkModal.helpers.ts` (cost estimate, custom events parser, leader preset resolver) + unit tests.
9. Dashboard: `ForkModal.tsx` component.
10. Dashboard: `↳ Fork at N` button in Reports tab turn rows.
11. Dashboard: enablement rule (button visible only when `kernelSnapshotsPerTurn` present + parent complete + turn ≤ latest).
12. Dashboard: `captureSnapshots: true` default on all UI-initiated runs (flip wherever the POST body to `/setup` is assembled; Settings panel and TopBar are likely entry points).
13. README section update.
14. Roadmap move to Shipped.
15. Full verification sweep: `npm test`, `tsc --noEmit`, `npm run build`.
16. Em-dash sweep on authored files.
17. Atomic commit.
18. Monorepo submodule pointer bump.

## 11. References

- Spec 2A design: [`2026-04-24-worldmodel-fork-snapshot-api-design.md`](2026-04-24-worldmodel-fork-snapshot-api-design.md)
- Spec 2A implementation plan: [`2026-04-24-worldmodel-fork-snapshot-implementation.md`](../plans/2026-04-24-worldmodel-fork-snapshot-implementation.md)
- Positioning map CWSM section: [`../positioning/world-model-mapping.md`](../../positioning/world-model-mapping.md)
- Kirfel et al, 2025, "When AI meets counterfactuals: the ethical implications of counterfactual world simulation models": [PDF](https://link.springer.com/article/10.1007/s43681-025-00718-4)
- Related academic work on counterfactual LLM simulation: [AXIS, arXiv 2505.17801](https://arxiv.org/html/2505.17801v1), [Counterfactual Effect Decomposition ICML 2025](https://icml.cc/virtual/2025/poster/44311)
- Existing `/setup` endpoint: [server-app.ts:1448](../../src/cli/server-app.ts#L1448)
- Existing tab routing: [tab-routing.ts:1](../../src/cli/dashboard/src/tab-routing.ts#L1)
- Existing ReportView: [ReportView.tsx:88](../../src/cli/dashboard/src/components/reports/ReportView.tsx#L88)
