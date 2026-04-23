/**
 * Centralized reader/writer for the dashboard's two launch-related
 * localStorage contracts. Keeping the key strings + payload shape in
 * one file prevents the kind of drift audit F22 flagged (multiple
 * call sites hand-rolling the same parse with subtly different
 * error handling).
 *
 * Used by: SettingsPanel.launch (writes after successful /setup),
 * RerunPanel (reads on click), ChatPanel (reads keyOverrides for
 * chat requests).
 *
 * @module paracosm/cli/dashboard/hooks/useLastLaunchConfig
 */

/** localStorage key holding the last config that succeeded on /setup. */
export const LAST_LAUNCH_KEY = 'paracosm:lastLaunchConfig';

/** localStorage key holding per-provider API key overrides. */
export const KEY_OVERRIDES_KEY = 'paracosm:keyOverrides';

/** Minimal storage interface for tests. */
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Provider-keyed API key overrides. All fields optional; presence of
 * a key means the user pasted one for that provider in Settings.
 */
export interface KeyOverrides {
  openai?: string;
  anthropic?: string;
  serper?: string;
  firecrawl?: string;
  tavily?: string;
  cohere?: string;
}

/** Default seed used when the stored config lacks a numeric `seed`. */
const DEFAULT_SEED = 950;

/**
 * Read the last-launch config. Returns `null` for missing / malformed
 * payloads so callers can branch without a try/catch.
 */
export function readLastLaunchConfig(
  storage: StorageLike,
): Record<string, unknown> | null {
  try {
    const raw = storage.getItem(LAST_LAUNCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Write the last-launch config. Silently swallows storage errors
 * (quota exceeded etc.) — the UI flow shouldn't break on storage
 * failure.
 */
export function writeLastLaunchConfig(
  storage: StorageLike,
  config: Record<string, unknown>,
): void {
  try {
    storage.setItem(LAST_LAUNCH_KEY, JSON.stringify(config));
  } catch {
    // Best-effort.
  }
}

/**
 * Read provider-key overrides. Returns `{}` for missing / malformed
 * payloads so consumers can spread directly into request bodies.
 */
export function readKeyOverrides(storage: StorageLike): KeyOverrides {
  try {
    const raw = storage.getItem(KEY_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as KeyOverrides;
  } catch {
    return {};
  }
}

/**
 * Build the next-run config by bumping the seed + threading key
 * overrides through to their API field names. Pure function — does
 * not touch storage.
 *
 * Each override key maps to a specific request field name:
 * - `openai` → `apiKey` (historical naming — OpenAI is the default
 *   provider so the generic name stuck)
 * - `anthropic` → `anthropicKey`
 * - `serper` → `serperKey`
 * - `firecrawl` → `firecrawlKey`
 * - `tavily` → `tavilyKey`
 * - `cohere` → `cohereKey`
 *
 * Missing override keys are NOT added to the output (vs always
 * present with `undefined`), so the fetch body stays clean.
 */
export function buildNextRunConfig(
  prev: Record<string, unknown>,
  overrides: KeyOverrides,
): Record<string, unknown> {
  const nextSeed =
    (typeof prev.seed === 'number' ? prev.seed : DEFAULT_SEED) + 1;
  const next: Record<string, unknown> = { ...prev, seed: nextSeed };
  if (overrides.openai) next.apiKey = overrides.openai;
  if (overrides.anthropic) next.anthropicKey = overrides.anthropic;
  if (overrides.serper) next.serperKey = overrides.serper;
  if (overrides.firecrawl) next.firecrawlKey = overrides.firecrawl;
  if (overrides.tavily) next.tavilyKey = overrides.tavily;
  if (overrides.cohere) next.cohereKey = overrides.cohere;
  return next;
}
