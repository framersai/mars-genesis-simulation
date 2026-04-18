/**
 * Cross-run schema-retry aggregation for production reliability telemetry.
 *
 * Each simulation reports per-schema `{ attempts, calls, fallbacks }` in
 * its cost payload (see [cost-tracker.ts](../runtime/cost-tracker.ts)).
 * This module sums those per-run buckets across the last N runs so the
 * dashboard and `/retry-stats` endpoint can surface live reliability
 * metrics without running an expensive replay.
 *
 * Metrics surfaced per schema across the aggregated window:
 *
 * - `calls`      — total schema-validated LLM calls on this schema
 * - `attempts`   — total attempts (≥ calls; > calls when retries happened)
 * - `avgAttempts`— attempts / calls. 1.0 = first-try success; > 1.0
 *                  means the model is retrying on validation failures
 *                  and maxRetries / schema discipline should be tuned
 * - `fallbacks`  — runs where retries were exhausted and the caller's
 *                  empty skeleton was returned instead of a validated object
 * - `fallbackRate` — fallbacks / calls. > 0 means the run served
 *                   degraded data on at least one turn for this schema
 * - `runsPresent`— number of runs in the window where this schema
 *                  appeared at least once (not every run exercises every
 *                  schema: agriculture dept only fires on some turns)
 *
 * @module paracosm/cli/retry-stats
 */

/** Per-run payload emitted by the cost tracker. Keys are schema names. */
export type PerRunSchemaRetries = Record<
  string,
  { attempts: number; calls: number; fallbacks: number }
>;

/** Aggregate rollup across N runs. */
export interface SchemaRetryStats {
  runCount: number;
  schemas: Record<
    string,
    {
      calls: number;
      attempts: number;
      fallbacks: number;
      /** attempts / calls; rounded to two decimals. */
      avgAttempts: number;
      /** fallbacks / calls; rounded to four decimals. */
      fallbackRate: number;
      /** Count of runs in the window where this schema appeared. */
      runsPresent: number;
    }
  >;
}

const round = (v: number, precision: number) => {
  const f = Math.pow(10, precision);
  return Math.round(v * f) / f;
};

/**
 * Fold an array of per-run `schemaRetries` payloads into a single
 * aggregate rollup. Safe with empty / missing entries — an empty run
 * (`{}`) still contributes to `runCount` but doesn't add to any
 * per-schema bucket.
 */
export function aggregateSchemaRetries(
  runs: PerRunSchemaRetries[],
): SchemaRetryStats {
  const rollup = new Map<string, { calls: number; attempts: number; fallbacks: number; runsPresent: number }>();

  for (const run of runs) {
    if (!run) continue;
    for (const [schemaName, bucket] of Object.entries(run)) {
      const existing = rollup.get(schemaName) ?? { calls: 0, attempts: 0, fallbacks: 0, runsPresent: 0 };
      existing.calls += bucket.calls;
      existing.attempts += bucket.attempts;
      existing.fallbacks += bucket.fallbacks;
      existing.runsPresent += 1;
      rollup.set(schemaName, existing);
    }
  }

  const schemas: SchemaRetryStats['schemas'] = {};
  for (const [name, r] of rollup.entries()) {
    schemas[name] = {
      calls: r.calls,
      attempts: r.attempts,
      fallbacks: r.fallbacks,
      avgAttempts: r.calls > 0 ? round(r.attempts / r.calls, 2) : 0,
      fallbackRate: r.calls > 0 ? round(r.fallbacks / r.calls, 4) : 0,
      runsPresent: r.runsPresent,
    };
  }

  return { runCount: runs.length, schemas };
}

/**
 * Per-run forge-stats payload emitted by the cost tracker once any
 * forge attempt (approved or rejected) has been captured. Mirrors the
 * shape of {@link CostTracker.finalCost}'s `forgeStats` field.
 */
export interface PerRunForgeStats {
  attempts: number;
  approved: number;
  rejected: number;
  /** Sum of judge confidence across approved forges; divide by approved for avg. */
  approvedConfidenceSum: number;
}

/** Aggregate rollup across N runs' forge stats. */
export interface ForgeStatsRollup {
  totalAttempts: number;
  approved: number;
  rejected: number;
  /** approved / totalAttempts, rounded to 4 decimals. 0 when no attempts. */
  approvalRate: number;
  /** approvedConfidenceSum / approved, rounded to 2 decimals. 0 when no approvals. */
  avgApprovedConfidence: number;
  /** Count of runs in the window that recorded at least one forge attempt. */
  runsPresent: number;
}

/**
 * Fold an array of per-run forge-stats payloads into a single rollup
 * for the /retry-stats response. Runs without any forge activity are
 * counted in the window's runCount (see aggregateSchemaRetries) but do
 * not contribute to the forge rollup (they have `attempts===0`).
 */
export function aggregateForgeStats(runs: PerRunForgeStats[]): ForgeStatsRollup {
  let totalAttempts = 0;
  let approved = 0;
  let rejected = 0;
  let approvedConfidenceSum = 0;
  let runsPresent = 0;
  for (const run of runs) {
    if (!run || run.attempts === 0) continue;
    totalAttempts += run.attempts;
    approved += run.approved;
    rejected += run.rejected;
    approvedConfidenceSum += run.approvedConfidenceSum;
    runsPresent += 1;
  }
  return {
    totalAttempts,
    approved,
    rejected,
    approvalRate: totalAttempts > 0 ? round(approved / totalAttempts, 4) : 0,
    avgApprovedConfidence: approved > 0 ? round(approvedConfidenceSum / approved, 2) : 0,
    runsPresent,
  };
}

/**
 * Per-run cache-stats payload emitted by the cost tracker when the
 * provider returned non-zero cache counters (Anthropic reports these
 * on every call). Matches {@link CostTracker.finalCost}'s `cacheStats`.
 */
export interface PerRunCacheStats {
  readTokens: number;
  creationTokens: number;
  savingsUSD: number;
}

/** Aggregate prompt-cache rollup across N runs. */
export interface CacheStatsRollup {
  totalReadTokens: number;
  totalCreationTokens: number;
  /** Sum of savingsUSD across runs; rounded to 4 decimals. */
  totalSavingsUSD: number;
  /** readTokens / (readTokens + creationTokens), rounded to 4 decimals.
   *  Healthy caching shows ratios > 0.7 — most traffic is replays. */
  readRatio: number;
  /** Count of runs that reported any cache activity. */
  runsPresent: number;
}

/**
 * Fold an array of per-run cache-stats payloads into a rollup. Runs
 * without cache activity (OpenAI with opaque counters, or very short
 * runs that never crossed the auto-cache threshold) are skipped.
 */
export function aggregateCacheStats(runs: PerRunCacheStats[]): CacheStatsRollup {
  let totalReadTokens = 0;
  let totalCreationTokens = 0;
  let totalSavingsUSD = 0;
  let runsPresent = 0;
  for (const run of runs) {
    if (!run || (run.readTokens === 0 && run.creationTokens === 0)) continue;
    totalReadTokens += run.readTokens;
    totalCreationTokens += run.creationTokens;
    totalSavingsUSD += run.savingsUSD;
    runsPresent += 1;
  }
  const denom = totalReadTokens + totalCreationTokens;
  return {
    totalReadTokens,
    totalCreationTokens,
    totalSavingsUSD: round(totalSavingsUSD, 4),
    readRatio: denom > 0 ? round(totalReadTokens / denom, 4) : 0,
    runsPresent,
  };
}
