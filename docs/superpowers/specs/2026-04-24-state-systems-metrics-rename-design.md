---
date: 2026-04-24
status: design
related:
  - paracosm T4.5 (Rename runtime state.systems to state.metrics)
---

# Runtime state.systems to state.metrics Rename

## Problem

The runtime `SimulationState` carries numeric world state in a field named `systems` of type `WorldSystems`. The published universal schema (`WorldSnapshot`) uses `metrics` for the same conceptual data. The vocab mismatch costs cognitive load every time someone moves between runtime code and schema-facing code (compilers, scenario fixtures, type imports).

T4.5 aligns the runtime vocab with the schema. Pure rename, no shape change.

## Decision (per user, 2026-04-24)

Scope B: rename runtime field + type. SSE event names stay (`systems_snapshot`, `turn_done`, etc.). SSE payload key naturally renames from `systems:` to `metrics:` because the emit code passes `state.metrics` directly. No back-compat shim.

## Renames

| Old | New |
|---|---|
| `SimulationState.systems` (field) | `SimulationState.metrics` |
| `WorldSystems` (interface name) | `WorldMetrics` |
| `state.systems` (access pattern) | `state.metrics` |
| Emit-code payload key `systems:` (where value is `state.metrics`) | `metrics:` |
| Dashboard read `data.systems` (in event payloads) | `data.metrics` |

Untouched on this pass:
- SSE event names: `systems_snapshot`, `turn_done`, `turn_start`, etc.
- The pre-0.5.0 `migrateLegacyEventShape` helper that aliases `data.colony` to `data.systems` (the legacy migration becomes irrelevant after this rename but is left alone to avoid scope creep. a separate cleanup pass can drop it)

## Architecture

None. Pure rename. The structured shape of the data (`population`, `morale`, `foodMonthsReserve`, `powerKw`, etc. plus the `[key: string]: number` index signature) is preserved end-to-end.

## Reference counts (verified)

| Token | Refs in src + tests |
|---|---:|
| `WorldSystems` | 17 |
| `state.systems` | 52 |
| Other `.systems` access patterns (data.systems in dashboard fixtures + emit code payload keys) | ~30 |
| Total touched references | ~99 |

Touches an estimated 25-30 files across runtime, dashboard, compiler, schema-emit code, scenario fixtures, and tests.

## Implementation order

1. Rename `WorldSystems` interface declaration in `src/engine/core/state.ts` to `WorldMetrics`. Update the field declaration on `SimulationState` from `systems: WorldSystems` to `metrics: WorldMetrics`. Update the JSDoc paragraph that references both.
2. Sed `WorldSystems` to `WorldMetrics` across `src/` and `tests/` (word-boundary safe; the token only appears as a type identifier or in JSDoc).
3. Sed `state.systems` to `state.metrics` across `src/` and `tests/`. The sed targets the literal pattern; only access through a variable named `state` is renamed.
4. Sed `kernel.getState().systems` to `kernel.getState().metrics` in `src/runtime/orchestrator.ts` and any other call site that goes through the kernel API. Two helpers also exist (`preState.systems`, `final.systems`, `after.systems`, `st.systems`) that need the same rename. Catch all of them with `[A-Za-z]+\.systems` then narrow by prose review.
5. Sed payload keys `systems:` to `metrics:` in `src/runtime/orchestrator.ts` emit-call sites only (where value reads from `state.metrics`). Confirm no false positives in JSDoc comments or unrelated configuration.
6. Sed dashboard `data.systems` to `data.metrics` across `src/cli/dashboard/src/` test fixtures and demo data.
7. Run tsc, dashboard helpers tests, broader runtime tests, em-dash sweep.
8. Commit + push paracosm submodule, then monorepo pointer bump.

## Testing

No new tests. Success criteria:

- `tsc --noEmit` returns 0 (T4.6 baseline)
- All target test files pass (run only the touched ones per targeted-tests rule)
- `grep` confirms zero remaining occurrences of `WorldSystems` and `state.systems` in `src/` and `tests/`
- Em-dash sweep clean on touched files

## Out of scope

- SSE event names (`systems_snapshot` etc.). wire-format consumers stay stable on event names; only payload key inside the data object changes
- Dropping the pre-0.5.0 `migrateLegacyEventShape` legacy aliases. separate cleanup pass
- The Zod schema `WorldSnapshotSchema`. already uses `metrics` (this rename brings runtime into alignment with that)

## Migration

None. Single-commit ship in the paracosm submodule plus a monorepo pointer bump. No npm publish, no consumer dep changes (paracosm is consumed via the monorepo workspace; type-import consumers see the rename on next install).

## Roadmap update

T4.5 row marked SHIPPED in the same commit.
