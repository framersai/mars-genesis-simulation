/**
 * Build the "AVAILABLE STATE SHAPE" block that every state-accessing
 * generator's system prompt includes. Declares the exact flat key list
 * on each state bag so the LLM cannot silently hallucinate nested
 * access patterns like `state.systems.hull.integrity` or access bags
 * that don't exist at runtime.
 *
 * Important: paracosm's runtime `SimulationState` has ONLY `systems`,
 * `politics`, `agents`, and `metadata` at the top level — not
 * `capacities`, `statuses`, or `environment`. The latter three are
 * scenario-declaration vocabulary only; they do not produce runtime
 * state bags. Keys declared under `world.metrics` AND `world.capacities`
 * are both expected to land under `state.systems` when the kernel is
 * extended via `startingResources`; `world.statuses` / `world.environment`
 * are purely documentation today and have no runtime projection.
 *
 * @module paracosm/engine/compiler/state-shape-block
 */

interface MetricDef { id: string; type?: 'number' | 'string' | 'boolean' }

function keys(bag: Record<string, MetricDef> | undefined): string[] {
  return bag ? Object.keys(bag) : [];
}

function listOrNone(ks: string[]): string {
  return ks.length ? ks.join(', ') : '(none declared)';
}

export function buildStateShapeBlock(scenarioJson: Record<string, unknown>): string {
  const world = (scenarioJson.world ?? {}) as Record<string, Record<string, MetricDef> | undefined>;
  const labels = (scenarioJson.labels ?? {}) as { timeUnitNoun?: string; timeUnitNounPlural?: string };
  const timeUnit = labels.timeUnitNoun ?? 'tick';
  const timeUnitPlural = labels.timeUnitNounPlural ?? 'ticks';

  // Both world.metrics and world.capacities flatten into state.systems at
  // runtime. Union them in the declared-key list so the LLM knows every
  // number it can read under state.systems.
  const systemsKeys = Array.from(new Set([...keys(world.metrics), ...keys(world.capacities)]));
  const politicsKeys = keys(world.politics);

  return `AVAILABLE STATE SHAPE (read-only, flat):

state.systems = Record<string, number>
  declared keys: ${listOrNone(systemsKeys)}
  (population + morale also present as Mars-heritage defaults; scenario may omit them.)
state.politics = Record<string, number | string | boolean>
  declared keys: ${listOrNone(politicsKeys)}
state.agents = Array<{ core, health, career, social, narrative, hexaco, promotion?, hexacoHistory, memory }>
state.metadata = { simulationId, leaderId, seed, startTime, currentTime, currentTurn }

RULES:
- Access pattern is state.<bag>.<key> — flat, never nested. state.systems.<key> is always a number.
- state.capacities, state.statuses, state.environment DO NOT EXIST at runtime — they are scenario-declaration vocabulary only. Any access to state.capacities.anything throws.
- Only reference keys in the declared lists above. Unknown keys are undefined and will throw on .toFixed() / nested property access. Defensive access like \`(state.systems.foo ?? 0)\` is safer than bare \`state.systems.foo\`.
- Time is measured in ${timeUnit} units (plural: ${timeUnitPlural}). Use that vocabulary in any user-visible strings.`;
}
