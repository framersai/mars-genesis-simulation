# Phase 6: Emergent Scenario Generation

**Date:** 2026-04-13
**Status:** Spec complete. Execute next session.
**Scope:** Given a scenario JSON describing a world, the engine generates runtime hooks (progression, director instructions, milestones, fingerprint, politics, reactions) via LLM calls. A user describes a settlement and gets a runnable scenario without writing TypeScript.

---

## 1. Goal

Eliminate the requirement that scenario authors write TypeScript hook functions. A user provides a scenario JSON describing their world (labels, departments, metrics, effects, research citations) and the engine generates all runtime hooks via AgentOS `generateText()` calls. The generated hooks are cached, reviewable, and overridable.

---

## 2. The Problem

Currently, creating a scenario requires:
- `scenario.json` (pure data, easy)
- `hooks.ts` with 7 functions (progression, prompts, director instructions, fingerprint, politics, reactions, milestones)

The hooks contain domain expertise: "Mars has radiation at 0.67 mSv/day", "bone density degrades at 0.005/year in 0.38g", "political independence pressure increases with successful governance crises." Writing these requires understanding both the domain and the engine's hook contract.

For Paracosm Enterprise, customers need to define scenarios like "corporate acquisition simulation" or "Antarctic research station" without hiring a TypeScript developer who understands HEXACO drift coefficients.

---

## 3. Architecture

### 3.1 ScenarioCompiler

```typescript
import type { ScenarioPackage, ScenarioHooks } from 'paracosm';

interface CompileOptions {
  provider?: LlmProvider;
  model?: string;
  cache?: boolean;
  cacheDir?: string;
}

async function compileScenario(
  scenarioJson: Record<string, unknown>,
  options?: CompileOptions,
): Promise<ScenarioPackage>
```

Takes a raw scenario JSON (the data portion) and generates all hooks via LLM calls. Returns a complete `ScenarioPackage` ready to pass to `runSimulation()`.

### 3.2 Hook Generation Pipeline

For each hook, the compiler:
1. Builds a prompt from the scenario JSON context (labels, departments, metrics, effects, research)
2. Calls `generateText()` with a structured output schema
3. Parses the response into a typed hook function
4. Validates the hook against a test harness
5. Caches the generated code to disk (optional)

### 3.3 Generated Hooks

| Hook | What the LLM generates |
|------|----------------------|
| `progressionHook` | Between-turn health/status changes based on scenario environment (e.g., "submarine: water pressure stress at depth > 200m") |
| `directorInstructions` | Crisis Director system prompt with scenario-specific crisis categories, science references, department names |
| `departmentPromptHook` | Per-department stat context lines (what each department "sees" about the world) |
| `getMilestoneCrisis` | Turn 1 landing/founding crisis and final turn assessment, grounded in scenario setting |
| `fingerprintHook` | Timeline classification categories meaningful to the scenario domain |
| `politicsHook` | Which crisis categories trigger governance deltas and how |
| `reactionContextHook` | Location/identity phrasing for agent reactions |

### 3.4 Sandbox Execution

Generated progression hooks contain executable code (arithmetic on colonist health fields). The compiler:
1. Wraps generated code in a sandboxed function using `SandboxedToolForge` from AgentOS
2. Validates it against a test fixture (a fake colonist array)
3. If validation fails, regenerates with error feedback (up to 3 retries)
4. Falls back to a no-op hook if all retries fail

### 3.5 Caching

Generated hooks are expensive (7 LLM calls per scenario). Cache them:

```
.paracosm/cache/
  corporate-sim-v1.0.0/
    progression-hook.ts     # generated source
    director-instructions.ts
    milestones.ts
    fingerprint.ts
    politics.ts
    reactions.ts
    prompts.ts
    manifest.json           # model, timestamp, scenario hash
```

Cache invalidation: scenario JSON hash changes -> regenerate. Model changes -> regenerate.

---

## 4. User Flow

### 4.1 CLI

```bash
# Generate a scenario from JSON
npx paracosm compile scenarios/submarine.json --output scenarios/submarine/

# Run the generated scenario
npx paracosm run scenarios/submarine/ --turns 8 --seed 100

# Compile and run in one step
npx paracosm run scenarios/submarine.json --compile --turns 8
```

### 4.2 Programmatic

```typescript
import { compileScenario } from 'paracosm/compiler';
import { runSimulation } from 'paracosm/runtime';

const scenario = await compileScenario(submarineJson, {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  cache: true,
});

const output = await runSimulation(leader, personnel, {
  scenario,
  maxTurns: 8,
});
```

### 4.3 Dashboard

Settings panel gets a "Custom Scenario" option. User pastes or uploads a scenario JSON. The server compiles it on launch. Progress shown: "Generating progression hook... Generating director... Generating milestones... Ready."

---

## 5. Prompt Engineering

### 5.1 Progression Hook Prompt

```
You are generating a between-turn progression hook for a simulation engine.

SCENARIO: {labels.name} — {labels.settlementNoun} simulation
ENVIRONMENT: {world.environment description}
DEPARTMENTS: {departments list}
METRICS: {world.metrics list}

Generate a TypeScript function body that modifies colonist health fields
during between-turn progression. The function receives:
- colonists: array of { core: { marsborn: boolean, birthYear: number }, health: { alive: boolean, boneDensityPct: number, cumulativeRadiationMsv: number, psychScore: number } }
- yearDelta: number of years passed
- year: current year
- startYear: simulation start year

Rules:
1. Only modify health fields on alive colonists
2. Use scenario-appropriate health degradation (e.g., radiation for space, pressure for deep sea)
3. Apply yearDelta as a multiplier for time-scaled effects
4. Use Math.max/Math.min to keep values bounded
5. Do NOT use external imports

Return ONLY the function body as a string.
```

### 5.2 Validation

Each generated hook is validated:
- Progression: apply to a test colonist array, verify health fields changed within bounds
- Director instructions: verify it mentions scenario departments and crisis categories
- Milestones: verify turn 1 and final turn produce valid crisis objects
- Fingerprint: verify it returns an object with string values and a `summary` key
- Politics: verify it returns null for non-political categories
- Reactions: verify it returns a string for a test colonist

---

## 6. Files

| File | Purpose |
|------|---------|
| `src/engine/compiler/index.ts` | `compileScenario()` main entry |
| `src/engine/compiler/generate-progression.ts` | Progression hook generator |
| `src/engine/compiler/generate-director.ts` | Director instructions generator |
| `src/engine/compiler/generate-milestones.ts` | Milestones generator |
| `src/engine/compiler/generate-fingerprint.ts` | Fingerprint generator |
| `src/engine/compiler/generate-politics.ts` | Politics hook generator |
| `src/engine/compiler/generate-reactions.ts` | Reactions hook generator |
| `src/engine/compiler/generate-prompts.ts` | Department prompts generator |
| `src/engine/compiler/validate.ts` | Hook validation harness |
| `src/engine/compiler/cache.ts` | Disk caching for generated hooks |

---

## 7. What Does NOT Change

- Handwritten hooks (Mars, Lunar) remain as they are. They're optimized and tested.
- The ScenarioPackage interface is unchanged. Generated hooks satisfy the same contract.
- The engine, runtime, and dashboard are unchanged.
- JSON scenario format is unchanged (the compiler is additive).

---

## 8. Acceptance Criteria

1. `compileScenario(submarineJson)` produces a runnable `ScenarioPackage` without any handwritten hooks.
2. Generated progression hook modifies colonist health fields appropriately for the scenario domain.
3. Generated director instructions reference scenario-specific crisis categories and departments.
4. Generated milestones produce valid turn 1 and final turn crises.
5. Generated hooks pass validation harness before being returned.
6. Failed generation retries up to 3 times with error feedback, falls back to no-op.
7. Caching works: second compile of same scenario skips LLM calls.
8. Mars and Lunar handwritten hooks still work (no regression).
9. `npm run dashboard` with a compiled scenario renders correctly.

---

## 9. Cost Estimate

7 hook generators x 1 LLM call each = 7 calls per scenario compile.
Using Claude Sonnet 4.6 at ~$3/M input, ~$15/M output:
- Each hook prompt: ~2K input tokens, ~500 output tokens
- Total: ~14K input + 3.5K output = ~$0.10 per scenario compile
- Cached after first compile. Negligible ongoing cost.
