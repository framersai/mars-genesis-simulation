/**
 * Serializable kernel-state bundle. Captured by
 * `SimulationKernel.toSnapshot` and consumed by
 * `SimulationKernel.fromSnapshot` to round-trip a kernel through
 * JSON + disk for mid-run counterfactual forks.
 *
 * @module paracosm/core/snapshot
 */
import type { SimulationState } from './state.js';

/**
 * Serializable kernel snapshot. Every field is a plain JSON-safe
 * type; the whole object round-trips through JSON.stringify + parse
 * without data loss. Versioned via `snapshotVersion` so future shape
 * changes can migrate without silent drift.
 */
export interface KernelSnapshot {
  /** Format discriminator. Bump when the shape changes. Version 1 is
   *  the shape defined here and documented in the Tier 2 Spec 2A
   *  design doc. `fromSnapshot` throws on any other value. */
  snapshotVersion: 1;
  /** Scenario id the snapshot was taken against. `WorldModel.fork`
   *  asserts a match between the snapshot and the target WorldModel's
   *  scenario before restoring; cross-scenario forks throw. */
  scenarioId: string;
  /** Turn index the snapshot captures state at the end of. A snapshot
   *  taken after `kernel.advanceTurn(3, ...)` has `turn = 3` and
   *  represents the state going into turn 4. */
  turn: number;
  /** Simulation wall-clock time that corresponds to `turn`. Used by
   *  SimulationMetadata reconstruction so resumed kernels report the
   *  same origin as the parent run. */
  time: number;
  /** Full five-bag SimulationState (metrics/capacities/statuses/
   *  politics/environment + agents + eventLog + metadata),
   *  deep-cloned at capture time. */
  state: SimulationState;
  /** Mulberry32 PRNG state integer at capture. Resumed verbatim via
   *  `SeededRng.fromState`. */
  rngState: number;
  /** Scenario's original start time. Restored into
   *  SimulationMetadata so resumed kernels keep the same origin. */
  startTime: number;
  /** Original seed integer. The restored SeededRng is seeded from
   *  this value then forced to the captured `rngState`; keeping the
   *  original seed in the snapshot preserves audit-trail context. */
  seed: number;
}

/**
 * Current snapshot format version. Bump + add a migration in
 * `fromSnapshot` when the shape changes.
 */
export const CURRENT_SNAPSHOT_VERSION = 1 as const;
