# F11 — Schema-version gate on load

**Status:** design, awaiting approval
**Date:** 2026-04-22
**Scope:** dashboard-only. Third spec of the JSON-load UX bundle. Depends on [F9](./2026-04-22-f9-json-load-preview-modal-design.md) landing first (integrates into `parseFile` + the preview modal). Parallel-shippable with F10.

---

## Motivation

`useGamePersistence.save()` has been writing `schemaVersion: 2` on every export since the 0.5.0 rename. `load()` never reads it. The migration helper `migrateLegacyEventShape` transparently aliases pre-0.5 shapes (`leader.colony → .unit`, `event.data.colony → .systems`, `'colony_snapshot' → 'systems_snapshot'`) and that has kept old files working. Two failure modes aren't covered:

1. **Forward incompatibility.** A 0.6.0 file (with the F23 time-units rename: `year → time`, `startYear → startTime`, etc.) loaded into a 0.5.x dashboard renders with undefined metrics, missing timeline markers, and no warning. The migration only knows the pre-0.5→0.5 path.
2. **Silent corruption at schema-version-boundary-plus-one.** If someone loads a `schemaVersion: 3` file into a build that only knows `schemaVersion: 2`, every new field is silently dropped.

F11 adds a read gate: on load, inspect `schemaVersion`, route to the matching migration path, and surface a clear error when the file is too new. Pairs with the F9 preview modal — the version badge renders inline in the modal today, and a forward-incompatible file blocks the confirm button.

---

## Architecture

**Constants and versioning.** A single `CURRENT_SCHEMA_VERSION` constant in `useGamePersistence.ts` is the source of truth. Today's value: `2`. Bumped to `3` when the F23 time-units rename ships. `save()` writes it as `schemaVersion`. `parseFile()` reads it.

**Migration chain.** Chain-of-responsibility: each migration converts version N → N+1. The dispatcher picks the right starting point based on the file's declared version and runs the chain up to `CURRENT_SCHEMA_VERSION`.

```ts
type MigrationFn = (data: GameData) => GameData;

const migrations: Record<number, MigrationFn> = {
  // undefined → 2 (applies to pre-0.5.0 files that never wrote schemaVersion)
  1: data => ({
    ...data,
    events: migrateLegacyEventShape(data.events, data.results).events as SimEvent[],
    results: migrateLegacyEventShape(data.events, data.results).results ?? data.results,
    schemaVersion: 2,
  }),
  // 2 → 3 (placeholder for F23 time-units rename; not active today)
  2: data => data,  // identity until F23 lands
};

function runMigrationChain(data: GameData): GameData {
  const from = data.schemaVersion ?? 1;
  if (from > CURRENT_SCHEMA_VERSION) {
    throw new SchemaVersionTooNewError(from, CURRENT_SCHEMA_VERSION);
  }
  let current = data;
  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (!step) {
      throw new SchemaVersionGapError(v);  // missing migration — should not happen
    }
    current = step(current);
  }
  return { ...current, schemaVersion: CURRENT_SCHEMA_VERSION };
}
```

**Error types.** Two narrow error classes:

```ts
export class SchemaVersionTooNewError extends Error {
  constructor(public readonly fileVersion: number, public readonly dashboardVersion: number) {
    super(`Save file is schema v${fileVersion}; this dashboard supports up to v${dashboardVersion}.`);
  }
}

export class SchemaVersionGapError extends Error {
  constructor(public readonly missingFromVersion: number) {
    super(`No migration from schema v${missingFromVersion}; this is a bug.`);
  }
}
```

Only `SchemaVersionTooNewError` is user-facing. `SchemaVersionGapError` is a development-only invariant; if it fires we've shipped with a gap.

**Why chain-of-responsibility** over a single if-else ladder: new migrations are localized to a single `migrations[N]` entry plus a single `CURRENT_SCHEMA_VERSION` bump. The rest of the code doesn't need to know the version graph.

**Version surface in the preview modal.**

The modal's F9 "Schema" row already renders as a chip: `v2` (green, current) or `legacy (pre-0.5.0)` (blue, migrated). F11 leaves the happy-path UI unchanged — the migration chain's transparent lift from v1 → current is what the blue `legacy` chip already represents.

**Too-new case: actionable toast, no modal.** When a file declares a schemaVersion newer than this dashboard supports, the flow surfaces an error toast with version-specific copy (`"This file was saved under schema v3; this dashboard supports up to v2. Update the dashboard to load it."`) and no modal opens. A disabled-confirm modal was considered but rejected: it would let the user see metadata they can't act on, and the actionable path (update the dashboard) is already one click outside the app. Toast is simpler + better UX.

---

## Files

**Modified.**
- `src/cli/dashboard/src/hooks/useGamePersistence.ts` — add `CURRENT_SCHEMA_VERSION`, migration chain, error types, version gate in `parseFile`
- `src/cli/dashboard/src/components/layout/LoadPreviewModal.tsx` (from F9) — branch the Schema row into the badge variants; disable confirm button when `tooNew` flag is set
- `src/cli/dashboard/src/hooks/useLoadPreview.ts` (from F9) — propagate the migration outcome + `tooNew` flag into the preview metadata

**New.**
- `src/cli/dashboard/src/hooks/useGamePersistence.test.ts` (extension) — test migration chain, test error cases
- Extend `useLoadPreview.test.ts` with schema-version badge cases

No new files. Layered onto F9's hook + modal.

---

## Data flow

```
pickFile → File
    │
    ▼
parseFile(file)
    │
    ▼
  JSON.parse
    │
    ▼
  runMigrationChain(data)
    │
    ├──► SchemaVersionTooNewError → return { ok: false, reason: 'too-new', fileVersion, dashboardVersion }
    │
    └──► migrated GameData → return { ok: true, data, migrated: (fromVersion < CURRENT) }
    │
    ▼
useLoadPreview holds { data, migrated, tooNew }
    │
    ▼
LoadPreviewModal renders the badge variant
    │
    ▼
confirm → sse.loadEvents(data)  (only if not tooNew)
```

`parseFile` becomes return-shape: `{ ok: boolean, data?, reason?, fileVersion?, dashboardVersion? }`. Today's `Promise<GameData | null>` was binary; the new shape carries enough for the modal to render the three badge variants without re-parsing.

---

## Rollout sequence

Single commit.

1. Declare `CURRENT_SCHEMA_VERSION = 2` + error classes in `useGamePersistence.ts`
2. Add the migration table + `runMigrationChain` function
3. Update `parseFile` to return the new structured result shape (breaking internal API; consumers are `useLoadPreview` + the back-compat `load()`)
4. Back-compat `load()` returns `null` when `ok === false` so existing call sites (pre-F9 paths if any) keep their current tolerant behaviour
5. Propagate `{ migrated, tooNew }` through `useLoadPreview` into preview metadata
6. Update `LoadPreviewModal` schema-row rendering — badge variants + conditional disable on confirm
7. Tests: migration chain unit tests + preview-modal badge render tests

**Ordering note re F9.** F9 and F11 land in the same PR branch; F11 is a small edit after F9's foundation. Conceptually separate specs so each has a focused acceptance gate; practically they're commit 2 and commit 3 on the same feature branch.

---

## Testing

**Unit: migration chain**
- `runMigrationChain({ schemaVersion: 2, events: [...] })` → identity (no migration needed)
- `runMigrationChain({ events: [...] })` (undefined schemaVersion) → legacy migration runs, returns `schemaVersion: 2`
- `runMigrationChain({ schemaVersion: 99, events: [...] })` → throws `SchemaVersionTooNewError`
- When we add the `2 → 3` migration for F23: parameterized test confirms both starting-from-2 and starting-from-legacy arrive at 3

**Unit: parseFile result shape**
- Valid current-version file → `{ ok: true, migrated: false }`
- Valid legacy file → `{ ok: true, migrated: true }`
- File with `schemaVersion: 99` → `{ ok: false, reason: 'too-new', fileVersion: 99, dashboardVersion: 2 }`
- Malformed JSON → `{ ok: false, reason: 'parse-failed' }`
- Empty events → `{ ok: false, reason: 'empty' }`

**Component: LoadPreviewModal**
- current-version fixture → schema chip text `v2`, color green, confirm enabled
- legacy fixture → chip text `legacy → v2 (migrated)`, color blue, confirm enabled
- too-new fixture → chip text `v3 (unsupported)`, color red, confirm disabled + sub-copy "This file requires a newer paracosm"

---

## Acceptance criteria

- `CURRENT_SCHEMA_VERSION` is defined once in `useGamePersistence.ts` and used everywhere that reads/writes the version
- Loading a current-version file works unchanged from user perspective
- Loading a legacy file (no schemaVersion) runs the existing migration transparently and shows the "legacy" badge
- Loading a forward-incompatible file shows an actionable error toast with fileVersion + dashboardVersion + update instruction; no modal opens
- `SchemaVersionTooNewError` is thrown by the chain + caught by parseFile; `SchemaVersionGapError` never fires in production
- Migration-chain unit tests cover: identity, legacy-to-current, too-new, synthetic future chain (with a stubbed `2 → 3`)
- No regressions in the 77 existing dashboard tests
- F23 shipping later only requires: (1) bump `CURRENT_SCHEMA_VERSION` to 3, (2) drop in a `migrations[2]` function, (3) no other F11 changes

---

## Out of scope

- **Actual `2 → 3` migration.** Lives in F23's spec, not here. F11 adds the machinery; F23 adds the transformation.
- **Version-aware server replay.** The `/sessions/:id/replay` SSE endpoint also streams legacy events; the session store persists them under whatever version was current when the session ran. A separate spec would cover "replay sessions older than CURRENT_SCHEMA_VERSION" — not F11.
- **Auto-download of a newer dashboard version when a file is too new.** User-facing link to the release page is enough; auto-update is out of scope.

---

## Risks + notes

- **Legacy version numbering.** Pre-0.5.0 saves didn't write `schemaVersion`; F11 treats that as version 1 for migration routing. Migration `1 → 2` is where `migrateLegacyEventShape` lives today.
- **Third-party saved files.** Anyone editing a saved file by hand might write a wrong schemaVersion. The migration chain trusts the declared version; no heuristic recovery. This is the tradeoff — simpler code, user pays the cost of hand-editing.
- **Migrations are pure functions.** No DOM, no network, no localStorage — makes them trivially testable and safe to run twice (idempotent after the first pass through the chain to `CURRENT`).
- **Why not a single "latest-shape validator" instead of a chain.** Validation tells you IF a file matches; migration tells you HOW to make it match. Validation still matters at the sanity-check layer (empty events etc.), but version routing needs the chain because field-renames and type changes can't be recovered from shape inspection alone.
