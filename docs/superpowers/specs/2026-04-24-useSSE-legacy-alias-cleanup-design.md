---
date: 2026-04-24
status: design
related:
  - paracosm T4.6 (Dashboard useSSE.ts legacy alias cleanup)
---

# Dashboard useSSE Legacy Alias Cleanup

## Problem

In paracosm 0.6.0, the runtime renamed five SSE event types to align with universal vocab:

| Legacy | New (wire format since 0.6.0) |
|---|---|
| `dept_start` | `specialist_start` |
| `dept_done` | `specialist_done` |
| `commander_deciding` | `decision_pending` |
| `commander_decided` | `decision_made` |
| `drift` | `personality_drift` |

The dashboard's internal reducers, components, type unions, fixtures, and tests were never migrated. To keep the dashboard working without touching ~91 references, `useSSE.ts` interposes a `NEW_TO_LEGACY_EVENT_TYPE` alias map that rewrites incoming wire-format events back to the legacy names so the dashboard's internal dispatch keeps working unchanged.

This is the "future cleanup pass" the alias docstring anticipated.

## Decision (per user, 2026-04-24)

Drop the alias entirely. No back-compat for pre-0.6.0 saved runs or stale demo data caches. Live SSE in 0.6.0+ already emits the new names; saved runs from prior versions are not load-bearing.

## Architecture

None. Pure mechanical refactor. Five string renames swept across `src/cli/dashboard/src/`, then drop the alias map and legacy types in `useSSE.ts`.

## Files affected

| File | Estimated refs | Notes |
|---|---:|---|
| `src/cli/dashboard/src/hooks/useSSE.ts` | varies | Drop alias map, function, call site, legacy union members |
| `src/cli/dashboard/src/components/tour/demoData.ts` | 32 | Demo fixture event stream |
| `src/cli/dashboard/src/components/log/EventLogPanel.helpers.test.ts` | 10 | Test fixtures |
| `src/cli/dashboard/src/hooks/useGameState.ts` | 5 | Reducer / dispatch |
| `src/cli/dashboard/src/components/sim/EventCard.tsx` | 6 | Per-event UI rendering |
| `src/cli/dashboard/src/components/log/EventLogPanel.tsx` | 4 | Log filter / icon mapping |
| `src/cli/dashboard/src/components/sim/SimView.tsx` | 3 | Stream subscription |
| `src/cli/dashboard/src/components/reports/ReportView.tsx` | 3 | Report rendering |
| `src/cli/dashboard/src/components/tour/GuidedTour.tsx` | 2 | Tour-step matching |
| `src/cli/dashboard/src/hooks/useToolRegistry.ts` | 4 | Tool ledger updates |
| `src/cli/dashboard/src/hooks/useCitationRegistry.ts` | 3 | Citation collection |
| `src/cli/dashboard/src/components/shared/ToolboxSection.tsx` | 2 | Forge display |
| `src/cli/dashboard/src/components/shared/ReferencesSection.tsx` | 1 | Citation display |
| `src/cli/dashboard/src/components/viz/SwarmViz.tsx` | 1 | Swarm-state update |
| `src/cli/dashboard/src/components/viz/grid/TurnProgress.tsx` | 1 | Turn-progress bar |
| `src/cli/dashboard/src/components/viz/TurnBanner.tsx` | 1 | Turn announcement |
| `src/cli/dashboard/src/components/reports/CommanderTrajectoryCard.tsx` | 1 | Commander trajectory chart |

Approximately 91 reference sites total across 17 files (counting `useSSE.ts` once). Per-file counts are best-effort from `grep -c` and may shift slightly as the renames reveal nested references.

## Implementation order

1. Sweep `dept_start` to `specialist_start` and `dept_done` to `specialist_done` across `src/cli/dashboard/src/`. Verify tsc and dashboard tests still pass.
2. Sweep `commander_deciding` to `decision_pending` and `commander_decided` to `decision_made`. Verify.
3. Sweep `'drift'` (single-quoted form only) to `'personality_drift'`. Verify the unquoted word `drift` is untouched (no false positives in identifiers like `drifting`).
4. Edit `useSSE.ts`: drop the `NEW_TO_LEGACY_EVENT_TYPE` const, the `aliasNewToLegacyEventTypes` function, and its call site at line 451 (formerly aliasing inbound events). Update the `SimEventType` union to drop the five legacy names.
5. Run full verification: `npx tsc --noEmit` (root), targeted dashboard tests, em-dash sweep on touched files.

## Testing

No new tests. Success criteria:

- `npx tsc --noEmit` stays at 0 errors (T4.4 baseline)
- All dashboard tests pass (`EventLogPanel.helpers.test.ts` is the main one with legacy-name fixtures)
- `grep` confirms no remaining occurrence of any of the 5 legacy strings in `src/cli/dashboard/src/`

## Out of scope

- The separate `migrateLegacyEventShape` helper handles pre-0.5.0 shape migrations (`colony` to `systems`, etc.). Different concern. Untouched.
- The `SimEventType` union references in published `paracosm/runtime` types. Live runtime already emits new names; no consumer-facing change needed.
- Pre-0.6.0 saved runs in `.paracosm/cache/`. Per user direction, not load-bearing; expected to break (silently render fewer events).

## Migration

None. Single-commit ship in the paracosm submodule plus a monorepo pointer bump. No npm publish, no consumer dep changes.

## Roadmap update

Roadmap T4.6 row gets SHIPPED status in the same commit.
