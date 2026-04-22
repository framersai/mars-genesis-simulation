/**
 * Schema-version migration chain for saved-run files.
 *
 * Saved files carry a `schemaVersion` number; this module routes a
 * loaded file from its declared version up to the dashboard's current
 * version by chaining per-step migrations. Bumping
 * {@link CURRENT_SCHEMA_VERSION} and adding a `migrations[N]` step is
 * all that's needed to ship a new version — consumers never branch on
 * the version directly.
 *
 * The `migrations[1]` step invokes the legacy pre-0.5.0 field-rename
 * migration (`colony` → `unit` / `systems`, `'colony_snapshot'` event
 * type). Undefined-schemaVersion files are treated as v1.
 *
 * @module paracosm/cli/dashboard/hooks/schemaMigration
 */
import type { SimEvent } from './useSSE';
import { migrateLegacyEventShape } from './migrateLegacyEventShape';

/**
 * Current schema version understood by this dashboard build. Bump when
 * shipping a breaking saved-file change AND add a matching `migrations`
 * entry for the previous version.
 */
export const CURRENT_SCHEMA_VERSION = 2;

/** Minimal data shape the chain reads/writes. Mirrors GameData loosely. */
export interface MigratableSaveData {
  events: SimEvent[];
  results?: unknown[];
  verdict?: Record<string, unknown> | null;
  schemaVersion?: number;
  startedAt?: string;
  completedAt?: string | null;
  [k: string]: unknown;
}

/**
 * Thrown when a file declares a schema version newer than the
 * dashboard can migrate to. Surface to the UI as an actionable "this
 * file requires a newer dashboard" message.
 */
export class SchemaVersionTooNewError extends Error {
  override readonly name = 'SchemaVersionTooNewError';
  constructor(
    /** Version declared in the file. */
    public readonly fileVersion: number,
    /** Version this dashboard build understands. */
    public readonly dashboardVersion: number,
  ) {
    super(
      `Save file is schema v${fileVersion}; this dashboard supports up to v${dashboardVersion}.`,
    );
    Object.setPrototypeOf(this, SchemaVersionTooNewError.prototype);
  }
}

/**
 * Thrown when the migration chain reaches a version with no registered
 * step for. Shipping gap — never fires on a correctly-populated
 * {@link migrations} table.
 */
export class SchemaVersionGapError extends Error {
  override readonly name = 'SchemaVersionGapError';
  constructor(public readonly missingFromVersion: number) {
    super(`No migration registered from schema v${missingFromVersion}.`);
    Object.setPrototypeOf(this, SchemaVersionGapError.prototype);
  }
}

type MigrationStep = (data: MigratableSaveData) => MigratableSaveData;

/**
 * Registered per-step migrations. Keys are the starting version;
 * the step converts vN to vN+1. Extending: add `migrations[2]` when
 * bumping CURRENT_SCHEMA_VERSION to 3 (reserved for F23's
 * year → time rename).
 */
export const migrations: Record<number, MigrationStep> = {
  1: (data) => {
    const migrated = migrateLegacyEventShape(
      data.events as never,
      data.results as never,
    );
    return {
      ...data,
      events: migrated.events as SimEvent[],
      results: (migrated.results ?? data.results ?? []) as unknown[],
      schemaVersion: 2,
    };
  },
};

/**
 * Walk a save file from its declared version up to
 * {@link CURRENT_SCHEMA_VERSION} by applying each registered migration
 * step in order. Undefined `schemaVersion` is treated as v1 (pre-0.5.0
 * files never wrote the field).
 *
 * @throws {SchemaVersionTooNewError} File's declared version exceeds
 *   this dashboard's support window.
 * @throws {SchemaVersionGapError} Migration table is missing a step.
 *   Indicates a shipping bug.
 */
export function runMigrationChain(
  data: MigratableSaveData,
): MigratableSaveData {
  const from = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;
  if (from > CURRENT_SCHEMA_VERSION) {
    throw new SchemaVersionTooNewError(from, CURRENT_SCHEMA_VERSION);
  }
  let current = data;
  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (!step) throw new SchemaVersionGapError(v);
    current = step(current);
  }
  return { ...current, schemaVersion: CURRENT_SCHEMA_VERSION };
}
