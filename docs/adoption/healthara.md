# Digital-twin adoption guide

This doc shows how Digital-twin's AI-agents service maps onto paracosm's universal schema under `paracosm/schema`. Digital-twin's existing LangGraph pipeline keeps doing the heavy lifting (planner → domain specialists → synthesis); this guide is about the data contract at the boundaries.

## Field-rename map

### Input side — `SimulationRequest` → `SubjectConfig` + `InterventionConfig`

| Digital-twin field | paracosm field | Notes |
|---|---|---|
| `user_id` | `SubjectConfig.id` | Identity key |
| `profile.name` | `SubjectConfig.name` | Display name |
| `profile.age`, `profile.gender`, `profile.diet_preferences`, `profile.activity_level`, `profile.allergies`, `profile.current_supplements`, `profile.goals`, etc. | `SubjectConfig.profile: Record<string, unknown>` | Loose bag; paracosm does not constrain |
| `health_signals[].label` | `SubjectConfig.signals[].label` | Same shape |
| `health_signals[].value` | `SubjectConfig.signals[].value` | Union string \| number |
| `health_signals[].recorded_at` | `SubjectConfig.signals[].recordedAt` | ISO datetime (optional) |
| `genome_signals[].rsid` | `SubjectConfig.markers[].id` | |
| `genome_signals[].genotype` | `SubjectConfig.markers[].value` | Optional |
| `genome_signals[].interpretation` | `SubjectConfig.markers[].interpretation` | Optional |
| `genome_signals[].gene` | `SubjectConfig.markers[].scenarioExtensions.gene` | Genome-specific; universal schema doesn't have a dedicated `gene` field to avoid domain bias |
| Internal `ScenarioPlan.intervention` | `InterventionConfig.name` + `.description` | |
| Internal `ScenarioPlan.primary_domains[0]` | `InterventionConfig.category` | First primary domain as category |
| Internal `ScenarioPlan.target_behaviors` | `InterventionConfig.targetBehaviors` | Same shape |
| Internal `ScenarioPlan.adherence_risk` | `InterventionConfig.adherenceProfile.risks[0]` | Array of one, or split if structured |

### Output side — `SimulationResponse` → `RunArtifact`

| Digital-twin field | paracosm field |
|---|---|
| `overview` | `RunArtifact.overview` |
| `timepoints[]` | `RunArtifact.trajectory.timepoints[]` (wrap in Trajectory container with timeUnit) |
| `timepoints[].label` | `Timepoint.label` |
| `timepoints[].health_score` (int 0-100) | `Timepoint.score = { value, min: 0, max: 100, label: 'Health Score' }` |
| `timepoints[].body_description` | `Timepoint.narrative` |
| `timepoints[].key_metrics[]` | `Timepoint.highlightMetrics[]` |
| `timepoints[].confidence` | `Timepoint.confidence` |
| `timepoints[].reasoning` | `Timepoint.reasoning` |
| `assumptions` | `RunArtifact.assumptions` |
| `leverage_points` | `RunArtifact.leveragePoints` |
| `risk_flags[]` | `RunArtifact.riskFlags[]` (same inner shape) |
| `specialist_notes[]` | `RunArtifact.specialistNotes[]` (same inner shape) |
| `disclaimer` | `RunArtifact.disclaimer` |

## TypeScript adapter (illustrative)

```typescript
import {
  InterventionConfigSchema,
  RunArtifactSchema,
  SubjectConfigSchema,
  type InterventionConfig,
  type RunArtifact,
  type SubjectConfig,
} from 'paracosm/schema';

// Digital-twin types (placeholder — imported from your code)
type Digital-twinRequest = {
  user_id: string;
  profile?: { name?: string; age?: number; gender?: string; diet_preferences?: string; goals?: string[] };
  health_signals?: Array<{ label: string; value: string | number; recorded_at?: string }>;
  genome_signals?: Array<{ rsid: string; gene?: string; genotype?: string; interpretation?: string }>;
};
type Digital-twinPlan = {
  intervention: string;
  primary_domains: string[];
  target_behaviors: string[];
  adherence_risk: string;
};

function toSubject(req: Digital-twinRequest): SubjectConfig {
  return SubjectConfigSchema.parse({
    id: req.user_id,
    name: req.profile?.name ?? 'unknown',
    profile: {
      age: req.profile?.age,
      gender: req.profile?.gender,
      diet: req.profile?.diet_preferences,
      goals: req.profile?.goals,
    },
    signals: (req.health_signals ?? []).map((s) => ({
      label: s.label,
      value: s.value,
      recordedAt: s.recorded_at ?? undefined,
    })),
    markers: (req.genome_signals ?? []).map((g) => ({
      id: g.rsid,
      category: 'genome',
      value: g.genotype ?? undefined,
      interpretation: g.interpretation ?? undefined,
      scenarioExtensions: g.gene ? { gene: g.gene } : undefined,
    })),
  });
}

function toIntervention(plan: Digital-twinPlan): InterventionConfig {
  return InterventionConfigSchema.parse({
    id: `intv-${Date.now()}`,
    name: plan.intervention,
    description: plan.intervention,
    category: plan.primary_domains[0],
    targetBehaviors: plan.target_behaviors,
    adherenceProfile: {
      expected: 0.7,
      risks: [plan.adherence_risk],
    },
  });
}

// After digital-twin's existing LangGraph pipeline produces synthesis + analyses:
function toArtifact(opts: {
  synthesis: {
    overview: string;
    timepoints: Array<{
      label: string;
      health_score: number;
      body_description: string;
      key_metrics: Array<{ label: string; value: string; direction: 'up' | 'down' | 'stable'; color?: string }>;
      confidence: number;
      reasoning: string;
    }>;
    assumptions: string[];
    leverage_points: string[];
    risk_flags: Array<{ label: string; severity: 'low' | 'medium' | 'high'; detail: string }>;
    disclaimer: string;
  };
  analyses: Array<{
    domain: string;
    summary: string;
    trajectory: 'positive' | 'mixed' | 'negative' | 'neutral';
    confidence: number;
    leverage_points: string[];
    missing_data: string[];
  }>;
  subject: SubjectConfig;
  intervention: InterventionConfig;
  cost: { totalUSD: number; llmCalls: number };
  startedAt: string;
  completedAt: string;
}): RunArtifact {
  return RunArtifactSchema.parse({
    metadata: {
      runId: `digital-twin-${opts.subject.id}-${Date.now()}`,
      scenario: { id: 'digital-twin-digital-twin', name: 'Digital-twin Digital Twin' },
      mode: 'batch-trajectory',
      startedAt: opts.startedAt,
      completedAt: opts.completedAt,
    },
    subject: opts.subject,
    intervention: opts.intervention,
    overview: opts.synthesis.overview,
    assumptions: opts.synthesis.assumptions,
    leveragePoints: opts.synthesis.leverage_points,
    disclaimer: opts.synthesis.disclaimer,
    trajectory: {
      timeUnit: { singular: 'week', plural: 'weeks' },
      timepoints: opts.synthesis.timepoints.map((t, idx) => ({
        time: idx,
        label: t.label,
        narrative: t.body_description,
        score: { value: t.health_score, min: 0, max: 100, label: 'Health Score' },
        highlightMetrics: t.key_metrics.map((m) => ({
          label: m.label,
          value: m.value,
          direction: m.direction,
          color: m.color,
        })),
        confidence: t.confidence,
        reasoning: t.reasoning,
      })),
    },
    specialistNotes: opts.analyses.map((a) => ({
      domain: a.domain,
      summary: a.summary,
      trajectory: a.trajectory,
      confidence: a.confidence,
      detail: {
        recommendedActions: a.leverage_points,
        openQuestions: a.missing_data,
      },
    })),
    riskFlags: opts.synthesis.risk_flags,
    cost: opts.cost,
  });
}
```

## Python adapter

Digital-twin's Python stack (`ai-agents/app/services/simulation.py`) can consume the paracosm schema via `datamodel-codegen`. Run:

```bash
# From the paracosm repo root:
npm run export:json-schema

# From digital-twin-ai-agents:
datamodel-codegen \
  --input /path/to/paracosm/schema/run-artifact.schema.json \
  --output app/paracosm_types.py \
  --output-model-type pydantic_v2.BaseModel
```

Then in `simulation.py`:

```python
from app.paracosm_types import RunArtifact, SubjectConfig, InterventionConfig

def to_run_artifact(request, synthesis, analyses, cost) -> RunArtifact:
    return RunArtifact(
        metadata={...},
        subject=SubjectConfig(id=request.user_id, name=..., signals=..., markers=...),
        intervention=InterventionConfig(id=..., name=..., description=..., ...),
        overview=synthesis.overview,
        assumptions=synthesis.assumptions,
        leverage_points=synthesis.leverage_points,
        disclaimer=synthesis.disclaimer,
        trajectory={...},
        specialist_notes=[...],
        risk_flags=[...],
        cost={...},
    )
```

Digital-twin's `/api/v1/simulate` endpoint returns the parsed `RunArtifact` dict; any downstream consumer that types against `paracosm/schema` now has a shared contract.

## Validation gate

Before returning an artifact to a user:

```typescript
const artifact = toArtifact({ synthesis, analyses, subject, intervention, cost, startedAt, completedAt });
// artifact is already RunArtifactSchema.parse()'d inside toArtifact.
return artifact;
```

If the parse fails mid-construction, Zod throws with a structured error pointing to the exact field path that didn't match. Digital-twin's error handler can surface that to clients as a 502 with diagnostic detail.

## What this does NOT give you

- **An executor.** Paracosm's `runSimulation()` is turn-loop only. Digital-twin's batch-trajectory pipeline stays digital-twin's to run. The schema is the shared contract; the executor is each side's concern.
- **HTTP interop.** Paracosm does not mount a `/simulate` endpoint that accepts SubjectConfig / InterventionConfig today. That's a future spec (direction B in the roadmap). Digital-twin's existing `/api/v1/chat` + `/simulate` stay the integration surface.
- **Subject persistence.** Paracosm doesn't store subjects. If digital-twin wants a persistent "digital twin record," that lives in digital-twin's NestJS + Supabase stack, unchanged.

## Version compatibility

This adapter works against `paracosm@^0.6.0` (after the subject + intervention primitives land — 0.6.x additive release). Consumers pinning `^0.5.x` caret ranges will not pick up the new types until they bump to `^0.6.0`.
