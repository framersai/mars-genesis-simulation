---
title: Pluggable Trait-Model Registry for Leaders
date: 2026-04-26
status: in-progress
package: paracosm
---

# Pluggable Trait-Model Registry for Leaders

## Goal

Today every leader in paracosm carries a fixed six-axis HEXACO personality profile (`openness`, `conscientiousness`, `extraversion`, `agreeableness`, `emotionality`, `honestyHumility`). The README and landing copy claim leaders can be "colony commanders, CEOs, generals, ship captains, department heads, AI systems, governing councils, or any entity that receives information, evaluates options, and makes choices that shape the world", but the schema is human-personality-only. A "Bayesian Risk Optimizer" leader works only by metaphorically mapping AI-system tendencies onto a model designed for humans.

This spec replaces the hardcoded HEXACO field with a pluggable **TraitModel registry**. Two built-in models ship in v1: `hexaco` (the canonical Ashton-Lee shape, the existing default) and `ai-agent` (a new six-axis model designed for AI-system leaders). Adding a third model post-hoc is a single registry call.

## Non-goals

- **Big Five, DISC, Hofstede, Schwartz values, or any third trait model in v1.** The registry exists; adding more models is a 2-3 day extension per model. Out of scope for v1 to keep test surface bounded.
- **Custom user-defined trait models at runtime.** The registry is registration-time-only. No `paracosm.registerTraitModel()` API in v1.
- **Blended / hierarchical leaders.** A council of three traders, each with a different profile, aggregated into one decision-maker. Conceptually possible on top of the trait-model layer, but not implemented in v1.
- **Cross-model leader comparison on a normalized axis.** Comparing a `hexaco` leader's "openness" against an `ai-agent` leader's "exploration" requires a normalization mapping the registry does not provide.
- **Replacing AgentOS.** Every LLM call still goes through `agent()`, `generateText()`, `generateObject()`, `EmergentCapabilityEngine`, `EmergentJudge`, `AgentMemory`. The trait-model generalization is paracosm-internal.

## Architecture

A `TraitModel` is a typed object that defines:

1. **Identity**: `id` (kebab-case string used in artifacts), `name` (human-readable), `description`.
2. **Axes**: ordered list of trait dimensions, each with `id` (kebab-case for serialization), `label` (UI display), `description`, optional `lowPole` / `highPole` short labels for UI tooltips.
3. **Bounds**: trait values are floats in `[0, 1]`. The model can declare per-axis defaults (used when an axis is omitted from a partial profile).
4. **Drift table**: an outcome-class → axis-delta map describing how each axis shifts after each outcome class (`risky_success`, `risky_failure`, `conservative_success`, `conservative_failure`, `safe_success`, `safe_failure`). Plus leader-pull weight (how strongly agents drift toward their leader's profile per turn) and role-activation weights (how strongly being promoted to a department amplifies the relevant axis).
5. **Cue dictionary**: keyed by `axis-id` + `zone` (`low` ≤ 0.35, `mid` 0.35-0.65, `high` ≥ 0.65), each entry is a short prose cue the prompt builder can splice in ("you lean exploratory: prefer untested options when standard ones fail").
6. **Default profile**: a neutral baseline used when a leader provides no traits (all 0.5 by convention).

The **TraitModelRegistry** is an in-memory `Map<string, TraitModel>` populated at engine load time. Two built-ins are registered:
- `hexaco` (replaces today's hardcoded shape)
- `ai-agent` (new)

`LeaderConfig` grows a typed `traitProfile?: TraitProfile` field where `TraitProfile = { modelId: string; traits: Record<string, number> }`. The legacy `hexaco?: HexacoProfile` field stays for back-compat: when present and `traitProfile` is absent, a normalizer synthesizes `traitProfile = { modelId: 'hexaco', traits: hexaco }`. Existing leaders compile and run without changes.

`RunArtifact.metadata.traitModelId` records which model the run used so replays reconstruct the correct cue + drift behavior even if the registry shape evolves.

```
src/engine/trait-models/
  index.ts              TraitModel + TraitProfile types, TraitModelRegistry
  hexaco.ts             6-axis Ashton-Lee model (lifted from today's hardcoded shape)
  ai-agent.ts           6-axis AI-system model (new)
  cue-translator.ts     model-agnostic prose cue generator
  drift.ts              dispatcher: looks up model, applies its drift table
  hexaco.test.ts
  ai-agent.test.ts
  cue-translator.test.ts
  drift.test.ts

src/runtime/trait-cues/  (renamed from hexaco-cues/)
  index.ts              re-export cuesForLeader(leader, registry) using model dispatch
  ...                   existing files re-pointed at the registry
```

## Components

### `TraitModel` interface

```ts
export interface TraitAxis {
  id: string;                       // kebab-case, used in serialization
  label: string;                    // human-readable for UI
  description: string;
  lowPole?: string;                 // short label, e.g. "exploits known options"
  highPole?: string;                // short label, e.g. "tries untested options"
}

export type Outcome =
  | 'risky_success' | 'risky_failure'
  | 'conservative_success' | 'conservative_failure'
  | 'safe_success' | 'safe_failure';

export interface DriftTable {
  /** axis-id -> outcome -> delta (typically -0.05 to +0.05) */
  outcomes: Record<string, Partial<Record<Outcome, number>>>;
  /** axis-id -> per-turn pull strength toward leader's value (0..1) */
  leaderPull: Record<string, number>;
  /** axis-id -> per-turn amplification when promoted to a relevant department */
  roleActivation: Record<string, number>;
}

export interface CueZone { low?: string; mid?: string; high?: string }

export interface TraitModel {
  id: string;                       // 'hexaco', 'ai-agent', ...
  name: string;
  description: string;
  axes: readonly TraitAxis[];       // 2-12 axes per model
  defaults: Record<string, number>; // axis-id -> default float
  drift: DriftTable;
  cues: Record<string, CueZone>;    // axis-id -> per-zone prose cue
}

export interface TraitProfile {
  modelId: string;
  traits: Record<string, number>;
}

export class TraitModelRegistry {
  register(model: TraitModel): void;
  get(modelId: string): TraitModel | undefined;
  require(modelId: string): TraitModel; // throws on miss
  list(): TraitModel[];
}

export const traitModelRegistry: TraitModelRegistry; // singleton
```

### `hexaco` model definition

Lifts the existing six axes (openness, conscientiousness, extraversion, agreeableness, emotionality, honestyHumility) into the new shape. Drift table preserves the current Ashton-Lee-derived numbers (live in `runtime/hexaco-cues/` today; the spec relocates them, behavior unchanged). Cue dictionary preserves the current cue strings.

Default profile: all 0.5.

### `ai-agent` model definition

Six axes designed for AI-system leaders:

| axis-id | label | low pole | high pole |
|---------|-------|----------|-----------|
| `exploration` | Exploration | exploits known options | tries untested options when standard ones fail |
| `verification-rigor` | Verification rigor | accepts first plausible answer | double-checks claims, runs tests |
| `deference` | Deference | overrides operator constraints when confident | defers to user / supervisor / safety constraints |
| `risk-tolerance` | Risk tolerance | refuses low-confidence actions | acts on partial information |
| `transparency` | Transparency | terse outputs, no working shown | shows reasoning, cites sources |
| `instruction-following` | Instruction following | interpolates intent from context | obeys explicit instructions verbatim |

Drift example (calibrated v1, expected to tune over real runs):
- `risky_failure` → `verification-rigor` +0.04, `transparency` +0.05 (rigor and visibility increase after a public miss)
- `risky_success` → `exploration` +0.05, `risk-tolerance` +0.03 (positive feedback on bold action)
- `conservative_failure` → `risk-tolerance` +0.04, `exploration` +0.03 (over-cautiousness penalized)
- `safe_failure` → `deference` +0.03 (when supervisor signals were ignored)

Default profile: all 0.5.

### Schema + back-compat

```ts
// engine/schema/primitives.ts
export const TraitProfileSchema = z.object({
  modelId: z.string().min(2).max(32).regex(/^[a-z0-9-]+$/),
  traits: z.record(z.string(), z.number().min(0).max(1)),
});

// engine/types.ts: LeaderConfig
export interface LeaderConfig {
  name: string;
  archetype: string;
  unit: string;
  instructions: string;
  /** @deprecated since 0.8: use traitProfile instead. Kept for back-compat. */
  hexaco?: HexacoProfile;
  traitProfile?: TraitProfile;
}
```

A new `normalizeLeaderConfig` helper resolves the trait profile:

```
if (leader.traitProfile) -> use it as-is
else if (leader.hexaco)  -> synthesize { modelId: 'hexaco', traits: leader.hexaco }
else                     -> synthesize { modelId: 'hexaco', traits: hexacoModel.defaults }
```

`runSimulation` calls `normalizeLeaderConfig` once before the run starts; downstream code reads `traitProfile` only. The legacy `hexaco` field is preserved on the artifact for back-compat consumers but is informational, not load-bearing.

`RunArtifact.metadata` adds `traitModelId: string` (defaults to `'hexaco'` when reading a legacy artifact). Replay validates the registry has the model registered before re-executing.

### Drift mechanism

`runtime/hexaco-cues/` becomes `runtime/trait-cues/`. The exported `applyTraitDrift(agent, ctx)` function:

1. Looks up the leader's `traitProfile.modelId` from `traitModelRegistry`.
2. Reads the model's `drift.outcomes[axis-id][outcome]` for the turn's outcome class.
3. Applies the delta to each agent's `traitProfile.traits[axis-id]`, clamped to `[0, 1]`.
4. Adds `leaderPull * (leader.traits[axis] - agent.traits[axis])` per turn.
5. Adds `roleActivation[axis] * sign` for any agent promoted to a department whose role activates that axis.

`Agent` schema grows a `traitProfile: TraitProfile` field paralleling the leader's. Today, `Agent.hexaco` exists as a fixed object; the migration path:

- `Agent.hexaco` deprecated, `Agent.traitProfile` added.
- Initial agent generation reads the leader's `traitProfile.modelId` and seeds agents with the model's defaults plus per-agent variance.
- Existing serialized agents (in artifacts) parse with `Agent.hexaco` which the resolver promotes to `Agent.traitProfile = { modelId: 'hexaco', traits: ... }`.

### Prompt cue translation

`runtime/trait-cues/cuesForLeader(leader, model)` returns an ordered array of prose cues. The translator:

1. For each axis, computes |value - 0.5| as the axis's "intensity".
2. Picks the top 3-5 axes by intensity.
3. For each picked axis, looks up the cue zone (`low` if value ≤ 0.35, `high` if ≥ 0.65, `mid` otherwise) and returns the matching cue string.

Commander, department, director, and agent-reaction prompts all read cues via this single function. The system prompts switch from "your openness score is X" to "your profile cues: <cues>", model-agnostic by construction.

### Dashboard

`LeaderBar.tsx`, `LeaderConfigForm.tsx`, the HEXACO sparklines, and the agent chat trait chips read axes from `traitModel.axes` instead of hardcoding `[openness, ...]`.

A `<TraitModelPicker>` component lets the user choose which model when creating a leader. Defaults to `hexaco` for parity. The Quickstart wizard gains a model dropdown next to the leader-count selector. Existing scenarios still ship HEXACO leaders.

## Data flow

```
1. User creates a leader via dashboard or programmatic API
2. LeaderConfigForm picks a TraitModel from the registry
3. Sliders render based on model.axes; user sets values
4. LeaderConfig.traitProfile = { modelId, traits } persisted

5. runSimulation receives leader -> normalizeLeaderConfig -> traitProfile guaranteed
6. Director, commander, departments, agent reactions all call cuesForLeader(leader, model)
7. After each turn outcome:
   - applyTraitDrift mutates agent + leader trait profiles using model.drift
8. Final artifact records:
   - metadata.traitModelId
   - leader.traitProfile (final state)
   - decisions[].leaderTraitsAtDecision (snapshot at each decision)
   - agents[].traitProfile (final state per agent)
```

Replay reads `metadata.traitModelId`, looks up the model in the registry, fails fast with a clear error if the model isn't registered ("paracosm version mismatch: this artifact was created with trait model 'ai-agent', which this build does not register").

## Error handling

- **Unknown traitModelId at simulate time**: throw `UnknownTraitModelError` with the unknown id and the registered list.
- **Trait value out of bounds**: Zod rejects at schema parse time. The `runSimulation` entry path validates via `LeaderConfigSchema`.
- **Mismatch between traitProfile and registry axes**: when the LLM-generated decision references a trait the model doesn't define (e.g. legacy prompt reads "your openness" against an ai-agent leader), the cue translator silently drops the axis with a console warn `[trait-cues] dropped unknown axis: ${id}` so a single rogue prompt template does not nuke the run.
- **Replay against a missing model**: throws `WorldModelReplayError("Trait model X not registered")` before kernel re-execution starts.

## Testing

Five new test files:

1. `engine/trait-models/registry.test.ts`
   - `register` adds, `get` finds, `require` throws on miss
   - re-registering same id throws
   - `list` returns all registered

2. `engine/trait-models/hexaco.test.ts`
   - Model conforms to interface (axes count, default sums, drift table covers every outcome)
   - Cue dictionary stable for fixed inputs
   - Drift values match the existing Ashton-Lee numbers (regression guard)

3. `engine/trait-models/ai-agent.test.ts`
   - Model conforms (6 axes, defaults all 0.5)
   - Drift sanity: `risky_failure` raises `verification-rigor` and `transparency`
   - Cue dictionary covers every axis in low/mid/high

4. `engine/trait-models/cue-translator.test.ts`
   - Top-N picking is stable for fixed input
   - HEXACO leader at all-0.5 returns mid-zone cues
   - ai-agent leader at extremes returns low/high cues

5. `runtime/orchestrator-trait-model.test.ts`
   - end-to-end stub run with an ai-agent leader against a small scenario
   - Verifies decision rationale references ai-agent axes (`exploration`, `verification-rigor`, ...) not HEXACO
   - Replay round-trips: `wm.replay(artifact)` matches when artifact was made with `ai-agent` model

Plus a back-compat regression test added to existing `tests/engine/types.test.ts` (or new file): a serialized v0.7 artifact with only `leader.hexaco` parses and runs through `normalizeLeaderConfig` to a valid `traitProfile`.

## Migration / rollout

**Single-pass, no flag.** The registry + back-compat resolver makes the schema change non-breaking: existing leaders, existing artifacts, existing serialized agents all continue to work. New scenarios can opt into ai-agent by setting `traitProfile.modelId = 'ai-agent'`.

Deprecation timeline:
- 0.8.x: `LeaderConfig.hexaco` marked `@deprecated` in TSDoc; resolver still synthesizes `traitProfile` from it.
- 0.9.x: `LeaderConfig.hexaco` removed from the schema. Callers must use `traitProfile`.

The cookbook gains an `ai-lab` scenario (in `scripts/cookbook-creative.ts` or a new `scripts/cookbook-ai-agent.ts`) that demonstrates an ai-agent leader running through the full pipeline. The README + landing copy gain a one-paragraph note that leaders now support pluggable trait models with a worked ai-agent example.

## Effort

| Phase | Touches | Estimate |
|-------|---------|----------|
| 1. Engine layer | `trait-models/index.ts`, `registry`, `cue-translator`, `drift` | 4h |
| 2. Trait model definitions | `hexaco.ts`, `ai-agent.ts` | 3h |
| 3. Schema + resolver | `engine/schema/primitives.ts`, `engine/types.ts`, `normalizeLeaderConfig` | 3h |
| 4. Drift + cue rename | `runtime/hexaco-cues/` -> `runtime/trait-cues/` + dispatch | 4h |
| 5. Prompt integration | commander/department/director/reactions templates | 3h |
| 6. Dashboard generalization | `LeaderBar`, `LeaderConfigForm`, sparklines, picker | 4h |
| 7. Tests | 5 new files + 1 regression | 4h |
| 8. Docs + cookbook example | README, landing, ai-agent cookbook scenario | 2h |
| **Total** | | **~27h** |

Single-session executable on Opus 4.7 1M context.

## Risks

- **Drift-table calibration for `ai-agent`**. No published research equivalent to Ashton-Lee for AI systems. The proposed numbers are reasoned from first principles and need empirical tuning across runs. Documented as "v1 calibration; expected to tighten over time".
- **Prompt regression on HEXACO**. The cue-translator rewrite must produce the same cue strings the existing `runtime/hexaco-cues/` produces for the same input, or HEXACO scenario behavior shifts subtly. Regression test in `hexaco.test.ts` locks the cue values.
- **Dashboard slider state migration**. If a user has a leader saved with HEXACO traits and switches the picker to `ai-agent`, the sliders should reset to ai-agent defaults rather than try to map HEXACO values onto ai-agent axes. The picker emits a `confirm reset?` modal when traits exist.
- **Replay against an artifact whose model isn't registered**. Surfaced as a clean error rather than a silent shape mismatch. Documented in the WorldModelReplayError message.

## Verification gate

Before commit:

1. `npm run typecheck:dashboard` clean
2. Targeted tests pass: `node --import tsx --test tests/engine/trait-models/*.test.ts tests/runtime/orchestrator-trait-model.test.ts`
3. End-to-end smoke: run an ai-agent leader through a 3-turn corp-quarterly scenario, verify decision rationale references ai-agent axes
4. Replay smoke: replay the resulting artifact, expect `matches: true`
5. Back-compat smoke: a v0.7 artifact (committed in `tests/fixtures/legacy-0.7-cache/`) parses and replays
6. em-dash sweep clean across all touched files
