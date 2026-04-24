/**
 * HTTP `POST /simulate` one-shot endpoint (Tier 4 T4.2). Accepts
 * `{ scenario, leader, options }`, returns a full `RunArtifact` JSON.
 * Unblocks curl + Python + third-party dashboards that don't want to
 * speak SSE.
 *
 * Gated behind `PARACOSM_ENABLE_SIMULATE_ENDPOINT=true` so the hosted
 * demo's SSE-first path stays the default. Self-hosted deployments
 * flip the flag on.
 *
 * Extracted from `server-app.ts` so the 8 route tests can inject
 * stub deps instead of booting the full HTTP server.
 *
 * @module paracosm/cli/simulate-route
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import type { ScenarioPackage, LeaderConfig, LlmProvider, SimulationModelConfig } from '../engine/types.js';
import type { RunArtifact } from '../engine/schema/index.js';
import type { CompileOptions } from '../engine/compiler/types.js';
import type { KeyPersonnel } from '../engine/core/agent-generator.js';
import type { CostPreset } from './sim-config.js';

const LeaderSchema = z.object({
  name: z.string().min(1).max(80),
  archetype: z.string().min(1).max(60),
  unit: z.string().min(1).max(80),
  hexaco: z.object({
    openness: z.number().min(0).max(1),
    conscientiousness: z.number().min(0).max(1),
    extraversion: z.number().min(0).max(1),
    agreeableness: z.number().min(0).max(1),
    emotionality: z.number().min(0).max(1),
    honestyHumility: z.number().min(0).max(1),
  }),
  instructions: z.string().default(''),
});

const SimulateOptionsSchema = z.object({
  maxTurns: z.number().int().min(1).max(12).optional(),
  seed: z.number().int().optional(),
  startTime: z.number().int().optional(),
  captureSnapshots: z.boolean().optional(),
  provider: z.enum(['openai', 'anthropic']).optional(),
  costPreset: z.enum(['quality', 'economy']).optional(),
  seedText: z.string().max(50_000).optional(),
  seedUrl: z.string().url().max(2048).optional(),
}).partial();

export const SimulateRequestSchema = z.object({
  // Scenario payload is either a compiled ScenarioPackage (carries
  // `.hooks`) or a raw draft that will be run through `compileScenario`
  // server-side. We accept either shape with `passthrough()` so Zod
  // does not strip the runtime fields we don't explicitly list here.
  scenario: z.record(z.string(), z.unknown()).refine(
    s => typeof s === 'object' && s !== null && typeof (s as { id?: unknown }).id !== 'undefined',
    { message: 'scenario.id is required' },
  ),
  leader: LeaderSchema,
  options: SimulateOptionsSchema.optional(),
});

export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;

/** What `handleSimulate` returns in the 200 response body. */
export interface SimulateResponse {
  artifact: RunArtifact;
  scenario: ScenarioPackage;
  durationMs: number;
}

/**
 * Options `handleSimulate` forwards to the injected runSimulation.
 * Narrow subset of the full RunOptions; the handler sets `scenario`
 * and leaves key personnel empty.
 */
export interface SimulateRunOptions {
  maxTurns?: number;
  seed?: number;
  startTime?: number;
  captureSnapshots?: boolean;
  provider?: LlmProvider;
  costPreset?: CostPreset;
  models?: Partial<SimulationModelConfig>;
  apiKey?: string;
  anthropicKey?: string;
  scenario: ScenarioPackage;
}

/**
 * Injectable deps so unit tests can run without booting the full
 * server or hitting real LLM providers. Production wiring in
 * `server-app.ts` passes the real `compileScenario` + `runSimulation`.
 */
export interface SimulateDeps {
  /** Compile a raw scenario draft into a runnable ScenarioPackage. */
  compileScenario: (raw: Record<string, unknown>, options: CompileOptions) => Promise<ScenarioPackage>;
  /** Run one leader against a scenario and return a RunArtifact. */
  runSimulation: (leader: LeaderConfig, keyPersonnel: KeyPersonnel[], options: SimulateRunOptions) => Promise<RunArtifact>;
  /** Optional user-provided LLM keys (from X-API-Key / X-Anthropic-Key headers). */
  userApiKey?: string;
  userAnthropicKey?: string;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

/**
 * Heuristic for "is this an already-compiled ScenarioPackage?". Raw
 * scenario drafts the compiler accepts have no `hooks` field; compiled
 * ScenarioPackages always populate it. We treat presence of `hooks`
 * (non-null, non-empty object) as the signal.
 */
function isCompiledScenario(scenario: Record<string, unknown>): boolean {
  const hooks = scenario.hooks;
  return (
    !!hooks &&
    typeof hooks === 'object' &&
    !Array.isArray(hooks) &&
    Object.keys(hooks as Record<string, unknown>).length > 0
  );
}

/**
 * Route handler. Returns nothing; writes response on `res`.
 */
export async function handleSimulate(
  _req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  deps: SimulateDeps,
): Promise<void> {
  const parsed = SimulateRequestSchema.safeParse(body);
  if (!parsed.success) {
    writeJson(res, 400, {
      error: 'invalid request',
      issues: parsed.error.issues.slice(0, 5).map(i => i.message),
    });
    return;
  }

  const { scenario: scenarioInput, leader, options = {} } = parsed.data;

  let scenarioPkg: ScenarioPackage;
  if (isCompiledScenario(scenarioInput)) {
    scenarioPkg = scenarioInput as unknown as ScenarioPackage;
  } else {
    try {
      scenarioPkg = await deps.compileScenario(scenarioInput, {
        provider: options.provider,
        seedText: options.seedText,
        seedUrl: options.seedUrl,
      });
    } catch (err) {
      writeJson(res, 502, { error: `Scenario compile failed: ${String(err)}` });
      return;
    }
  }

  const startedAt = Date.now();
  let artifact: RunArtifact;
  try {
    artifact = await deps.runSimulation(leader as LeaderConfig, [], {
      scenario: scenarioPkg,
      maxTurns: options.maxTurns,
      seed: options.seed,
      startTime: options.startTime,
      captureSnapshots: options.captureSnapshots ?? false,
      provider: options.provider,
      costPreset: options.costPreset,
      apiKey: deps.userApiKey,
      anthropicKey: deps.userAnthropicKey,
    });
  } catch (err) {
    writeJson(res, 500, { error: `Simulation failed: ${String(err)}` });
    return;
  }
  const durationMs = Date.now() - startedAt;

  const response: SimulateResponse = { artifact, scenario: scenarioPkg, durationMs };
  writeJson(res, 200, response);
}
