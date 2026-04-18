---
title: "Paracosm Forge Telemetry Rollup"
date: 2026-04-18
status: design — awaiting user review before plan
scope: paracosm runtime + server only (no AgentOS changes, no dashboard work beyond passive consumption)
---

# Paracosm Forge Telemetry Rollup

Live production SSH pull on 2026-04-18 confirms the forge pipeline is working: the judge approves well-formed tools (conf 0.88-0.92 on agriculture hooks), rejects broken ones with actionable reasons (output schema contract violations, logic errors in threshold ordering, clamping inconsistencies), and the retry-with-feedback loop recovers on 3rd attempt. `wrapForgeTool` captures every attempt. `forge_attempt` SSE events fire in real time. Dashboard renders them.

What's missing is aggregate visibility: we have per-forge events and a deduplicated toolbox at the end of the run, but no rolled-up "what % of forges got approved this run" or "what's our approval rate across the last 100 runs". The runtime already exposes `schemaRetries` on every `_cost` SSE payload and the server rings it through `/retry-stats`; forges deserve the same treatment.

## Problem Statement

`allForges: Array<CapturedForge>` in [orchestrator.ts:517](../../../src/runtime/orchestrator.ts#L517) collects every forge attempt with approved/confidence/errorReason. At run completion it lands in [result.forgeAttempts](../../../src/runtime/orchestrator.ts#L1484) and a deduplicated `forgedToolbox` is exposed alongside. But:

1. **No per-run rollup.** A caller reading `result.forgeAttempts` has to compute approval rate, average confidence, rejection reasons on their own. The cost tracker already does this kind of rollup for schemas; forges are treated differently.
2. **No live cost payload integration.** `_cost.schemaRetries` ships on every event so the dashboard can update reliability indicators mid-run. Forges have no such live rollup — the dashboard only knows about individual forge_attempt events, not a running "3/5 approved, avg conf 0.78" summary.
3. **No cross-run /retry-stats bucket.** Production questions like "is gpt-5.4-nano forging worse than gpt-5.4-mini on department code?" need a ring-buffered rollup. Today the answer requires replaying individual runs.
4. **No test for wrapForgeTool's capture callback.** [emergent-setup.test.ts](../../../src/runtime/emergent-setup.test.ts) covers `validateForgeShape` + `inferSchemaFromTestCases` thoroughly but doesn't verify that `wrapForgeTool` invokes `capture(record)` with the expected CapturedForge shape on success, on shape-check rejection, on judge rejection, and on exception paths.

## Goals

1. Add a `ForgeStats` aggregator alongside `cost-tracker.ts`'s schema-retry tracking with identical ergonomics.
2. Include `forgeStats` in every `_cost` SSE payload so dashboard updates live.
3. Snapshot `forgeStats` into the existing `.retry-stats.json` ring buffer and surface via `/retry-stats` under a new top-level key.
4. Add tests for `wrapForgeTool`'s capture behavior covering approved / shape-rejected / judge-rejected / exception paths.

## Non-Goals

- Zod-based forge_tool args pre-validator (bigger effort, separate sub-project)
- AgentOS-side judge rubric parameterization (requires AgentOS PR)
- Dashboard UI card for forge stats (surface via existing cost payload, UI work is follow-on)
- Per-department forge stats (aggregate only at run level; dept-level can be derived from `forgeAttempts[]`)

## Architecture Changes

### Modified modules

- [`src/runtime/cost-tracker.ts`](../../../src/runtime/cost-tracker.ts) — add `ForgeStats` interface and a `recordForgeAttempt(approved: boolean, confidence: number)` method on the tracker. `cost()` and `finalCost()` return the aggregated stats alongside `schemaRetries`.
- [`src/runtime/orchestrator.ts`](../../../src/runtime/orchestrator.ts) — in `captureForge`, call `costTracker.recordForgeAttempt(record.approved, record.confidence)` so every captured forge feeds the rollup.
- [`src/cli/server-app.ts`](../../../src/cli/server-app.ts) — extend `captureRetrySnapshot` to also persist `forgeStats` into the ring buffer. `/retry-stats` response gains a `forges` key.
- [`src/cli/retry-stats.ts`](../../../src/cli/retry-stats.ts) — add `aggregateForgeStats(runs: PerRunForgeStats[]): ForgeStatsRollup`.
- [`src/runtime/emergent-setup.test.ts`](../../../src/runtime/emergent-setup.test.ts) — add 4 tests for the capture callback.

### Unchanged

- `wrapForgeTool` body (already calls capture correctly)
- `CapturedForge` shape
- Dashboard (consumes the new payload shape opportunistically; silent if absent)
- Engine side

## Component Designs

### 1. ForgeStats type

```ts
// In cost-tracker.ts
export interface ForgeStats {
  /** Total forge attempts (approved + rejected combined). */
  attempts: number;
  /** Attempts the judge approved. */
  approved: number;
  /** Attempts the judge rejected (shape-check or judge verdict). */
  rejected: number;
  /** Sum of confidence scores across APPROVED forges. Avg = approvedConfidenceSum / approved. */
  approvedConfidenceSum: number;
}

export type PerRunForgeStats = ForgeStats;
```

### 2. Cost tracker integration

`CostTracker` gains:

```ts
recordForgeAttempt(approved: boolean, confidence: number): void {
  this._forgeStats.attempts += 1;
  if (approved) {
    this._forgeStats.approved += 1;
    this._forgeStats.approvedConfidenceSum += confidence;
  } else {
    this._forgeStats.rejected += 1;
  }
}
```

`cost()` and `finalCost()` include `forgeStats` in the returned object. Existing consumers (which spread or destructure `cost()`) see an additional field — backward compatible.

### 3. Orchestrator wiring

Single-line change in `captureForge`:

```ts
const captureForge = (dept: Department) => (record: CapturedForge) => {
  // ... existing bucket + SSE logic ...
  costTracker.recordForgeAttempt(record.approved, record.confidence);  // NEW
};
```

The SSE's `_cost` payload already ships whatever `costTracker.cost()` returns, so once forgeStats lands in the tracker, it flows to the dashboard automatically.

### 4. Retry-stats persistence

The existing `captureRetrySnapshot` in [server-app.ts:223](../../../src/cli/server-app.ts#L223) scans the event buffer for the last `_cost` payload and pushes `schemaRetries` to the ring. Extend it to also extract `forgeStats` and push a parallel ring:

```ts
// Alongside retryRing (which keeps schemaRetries per run), add:
const forgeRing: PerRunForgeStats[] = (() => {
  // Same persistence pattern as retryRing — load from disk if present,
  // slice to RING_MAX, swallow corrupt files, start empty.
})();
// Write to the same .retry-stats.json (new top-level section) or a
// sibling file — spec choice captured in Open Questions.
```

`/retry-stats` response gains a `forges` key:

```json
{
  "runCount": 42,
  "schemas": { ... existing ... },
  "forges": {
    "totalAttempts": 186,
    "approved": 142,
    "rejected": 44,
    "approvalRate": 0.7634,
    "avgApprovedConfidence": 0.83,
    "runsPresent": 38
  }
}
```

### 5. aggregateForgeStats helper

In `retry-stats.ts`:

```ts
export interface ForgeStatsRollup {
  totalAttempts: number;
  approved: number;
  rejected: number;
  approvalRate: number;   // rounded to 4 decimals
  avgApprovedConfidence: number;  // rounded to 2 decimals
  runsPresent: number;
}

export function aggregateForgeStats(runs: PerRunForgeStats[]): ForgeStatsRollup {
  // Fold; skip runs where attempts === 0 (no forge activity); divide-safely.
}
```

### 6. Capture callback tests

Four new tests in `emergent-setup.test.ts`:

- `wrapForgeTool calls capture with approved record on success`
- `wrapForgeTool calls capture with approved=false on shape-check rejection`
- `wrapForgeTool calls capture with approved=false on judge rejection`
- `wrapForgeTool calls capture with approved=false + errorReason on exception`

Use a stub `ForgeToolMetaTool` with a mocked `execute` returning controlled success/failure shapes. Assert the CapturedForge fields match expectations.

## Data Flow

### Before

```
forge attempt → wrapForgeTool.execute → capture(record) → deptForgeBuckets + forge_attempt SSE
                                                       → (not in cost-tracker)
run complete → result.forgeAttempts[] (caller must rollup themselves)
             → server: NOT persisted to .retry-stats.json
```

### After

```
forge attempt → wrapForgeTool.execute → capture(record)
                                     → deptForgeBuckets + forge_attempt SSE
                                     → costTracker.recordForgeAttempt(approved, confidence)   [NEW]
run event → _cost payload → forgeStats included                                                  [NEW]
run complete → result.forgeAttempts[]   (unchanged)
             → result.cost.forgeStats                                                           [NEW]
             → server captureRetrySnapshot: push forgeStats to ring                             [NEW]
/retry-stats GET → aggregate across ring → { schemas, forges }                                  [NEW]
```

## Error Handling

- If `capture()` throws inside `wrapForgeTool`, the original forge result is still returned to the LLM (capture is defensive telemetry, not on the critical path). Keep the try/catch around the capture call itself.
- The tracker increments are infallible numeric ops; no error handling needed.
- Ring-buffer persistence already swallows corrupt files; same path handles the new forgeStats section.

## Testing Strategy

- `src/runtime/emergent-setup.test.ts`: four new capture tests (see Component Design 6)
- `src/runtime/cost-tracker.test.ts`: two new tests — `recordForgeAttempt increments approved/rejected and confidence sum` and `forgeStats appears on cost() and finalCost() output`
- `src/cli/retry-stats.test.ts`: new test for `aggregateForgeStats` — empty runs produce zero rollup, multiple runs aggregate correctly, divide-by-zero when no approvals is handled
- Manual verification: hit the live `/retry-stats` endpoint after deploy + one real compile/run. Expect `forges` section populated.

## Performance / Cost Impact

- Zero LLM calls. All arithmetic is in-process.
- `_cost` SSE payload grows by ~60 bytes (forgeStats fields). On a 6-turn run with ~200 events, that's ~12KB extra SSE traffic. Negligible.
- `.retry-stats.json` grows by ~80 bytes per run. At 100-run ring, ~8KB extra disk.

## Risks

1. **Cost tracker surface change.** `cost()` return shape gains a field. Every consumer that spreads or destructures the tracker output sees the new key. Should be additive-compatible but worth a grep-check before commit.
2. **Forge count race.** Each forge goes through one capture call, which is itself serial per-dept. The cost tracker is a single mutable object in the run's closure; no cross-run or cross-turn mutation risk.
3. **Confidence averaging on zero approvals.** Divide-by-zero protection in `aggregateForgeStats` — return 0 when `approved === 0`.

## Open Questions

1. Persist forgeStats in the same `.retry-stats.json` (new top-level section) or a sibling `.forge-stats.json`? Proposed: same file to keep operational surface simple.
2. Should `forgeStats` include per-mode breakdown (sandbox vs compose)? Proposed: no, aggregate only; dashboard can drill into `forgeAttempts[]` for detail.
3. Should we track avgConfidence for REJECTED forges too? Proposed: no, rejected confidence is always 0 in current wrapForgeTool code (the judge's confidence in its rejection, not the tool's quality).

## Success Criteria

- `costTracker.cost().forgeStats` appears with `{ attempts, approved, rejected, approvedConfidenceSum }` on every `_cost` SSE payload.
- `result.cost.forgeStats` populated at run end.
- `GET /retry-stats` returns a `forges` key when at least one run has completed since server start.
- Four new `wrapForgeTool` capture tests pass; two new `cost-tracker` forge tests pass; new `retry-stats` aggregation test passes.
- No regressions in the existing 154-test suite.
