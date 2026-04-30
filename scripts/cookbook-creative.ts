#!/usr/bin/env -S npx tsx
/**
 * Cookbook creative scenarios runner. Drives WorldModel.fromPrompt
 * across three distinct domains, captures the compiled scenario JSON
 * for each, and saves them under output/cookbook/creative/. The
 * cookbook embeds excerpts so readers can see how fromPrompt's
 * domain inference shifts populationNoun, settlementNoun, time unit,
 * department choice, and metric selection across radically different
 * input domains.
 *
 * Scenarios:
 *   1. Generation ship: 200-year crewed voyage, multi-generational politics
 *   2. Pandemic governor: outbreak response with epidemiological dynamics
 *   3. Game studio creative director: live-service MMO content decisions
 *
 * Cost ceiling: $1 (no runtime, only fromPrompt's compile path which is
 * roughly $0.10-0.20 per scenario depending on seed enrichment).
 *
 * Invocation: `npx tsx scripts/cookbook-creative.ts`
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WorldModel } from '../src/runtime/world-model/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output', 'cookbook', 'creative');

function loadEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function persist(filename: string, value: unknown): string {
  const path = join(OUTPUT_DIR, filename);
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

function summarizeScenario(scenario: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ['id', 'labels', 'setup', 'departments', 'metrics', 'theme']) {
    if (scenario[k] !== undefined) out[k] = scenario[k];
  }
  const kb = (scenario as { knowledgeBundle?: { topics?: unknown[]; categories?: unknown[]; citations?: unknown[] } }).knowledgeBundle;
  if (kb) {
    out.knowledgeBundle = {
      topicCount: Array.isArray(kb.topics) ? kb.topics.length : 0,
      categoryCount: Array.isArray(kb.categories) ? kb.categories.length : 0,
      citationCount: Array.isArray(kb.citations) ? kb.citations.length : 0,
    };
  }
  return out;
}

interface CreativeScenario {
  slug: string;
  domainHint: string;
  seedText: string;
}

const SCENARIOS: CreativeScenario[] = [
  {
    slug: 'generation-ship',
    domainHint: 'crewed multi-generational interstellar voyage with succession politics',
    seedText: `
The colony ship Wayfinder-3 left Earth orbit in 2147 carrying 1,200 passengers
on a 200-year voyage to Tau Ceti e. The original captain died forty years ago.
Today the bridge crew are descendants who have never seen Earth, never felt
real sunlight, and have grown up in a closed-loop biosphere with strict
fertility scheduling, deck-based class stratification, and a dwindling
genetic-diversity index now flagged at 0.41 (below the 0.5 viability floor).

The captain chairs three permanent councils: Engineering, Biosphere, and
Civic. A new faction calling itself the Earthbound Compact wants to reroute
to Proxima B (closer, less hospitable) and arrive in 80 years rather than
the planned 160 left. The captain's HEXACO profile shapes how they weight
generational equity, technical risk, and political legitimacy.
`.trim(),
  },
  {
    slug: 'pandemic-governor',
    domainHint: 'public health emergency response under regional governance',
    seedText: `
A novel respiratory pathogen designated NRV-2026 is detected in Toluca,
Mexico on March 14, 2026. The state governor convenes the Emergency
Health Council. Initial R0 estimates 4.2, case fatality rate 1.8% in
adults under 60, 8.1% in over-60s. ICU bed capacity in the state is
1,850 with 70% baseline occupancy. International borders 270km north
remain open. State legislature is split 53/47 with the opposition
campaigning on civil liberties.

Surveillance, hospital surge, school closure, mobility restriction,
travel screening, vaccine procurement, and economic relief decisions
arrive on a daily cadence. The governor's HEXACO profile shapes whether
they front-load aggressive containment or stage interventions to preserve
political capital.
`.trim(),
  },
  {
    slug: 'game-studio-director',
    domainHint: 'live-service video game studio creative direction',
    seedText: `
Stardrift Online, a 4-month-old live-service MMO, just lost its creative
director. The new director leads four teams: Narrative, Systems, Live Ops,
and Player Trust. The studio has 380,000 monthly active users, a rising
toxicity metric, and a competing MMO launching in 9 weeks. Decisions
arrive on a weekly cadence: content drops, monetization cadence, balance
patches, and player-trust interventions. The director's HEXACO profile
shapes how they trade off retention, narrative integrity, monetization,
and team morale.
`.trim(),
  },
];

async function captureScenario(scenario: CreativeScenario): Promise<{ slug: string; cost: number }> {
  process.stdout.write(`\n[${scenario.slug}] WorldModel.fromPrompt: ${scenario.domainHint}\n`);
  const t0 = Date.now();
  const wm = await WorldModel.fromPrompt(
    {
      seedText: scenario.seedText,
      domainHint: scenario.domainHint,
    },
    {
      provider: 'openai',
      model: 'gpt-5.4-nano',
      draftProvider: 'openai',
      draftModel: 'gpt-5.4-mini',
      webSearch: false,
      onProgress: (hook, status) => process.stdout.write(`  [${status.padEnd(10)}] ${hook}\n`),
    },
  );

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  process.stdout.write(`  scenario: ${wm.scenario.labels.name} (${wm.scenario.id})\n`);
  process.stdout.write(`  population: ${wm.scenario.labels.populationNoun} | settlement: ${wm.scenario.labels.settlementNoun} | time: ${wm.scenario.labels.timeUnitNoun}\n`);
  process.stdout.write(`  ${wm.scenario.departments.length} departments, ${wm.scenario.metrics.length} metrics, ${dt}s\n`);

  persist(`${scenario.slug}-input.json`, {
    seedText: scenario.seedText,
    domainHint: scenario.domainHint,
    options: {
      provider: 'openai',
      model: 'gpt-5.4-nano',
      draftProvider: 'openai',
      draftModel: 'gpt-5.4-mini',
      webSearch: false,
    },
  });
  persist(`${scenario.slug}-output.json`, summarizeScenario(wm.scenario as unknown as Record<string, unknown>));

  return { slug: scenario.slug, cost: 0 };
}

async function main(): Promise<void> {
  loadEnv();
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.stderr.write('FATAL: neither OPENAI_API_KEY nor ANTHROPIC_API_KEY set\n');
    process.exit(1);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  process.stdout.write(`output dir: ${OUTPUT_DIR}\n`);

  const totalStart = Date.now();
  for (const scenario of SCENARIOS) {
    await captureScenario(scenario);
  }
  process.stdout.write(`\n[done] ${SCENARIOS.length} scenarios captured in ${((Date.now() - totalStart) / 1000).toFixed(1)}s\n`);
  process.stdout.write(`captured JSON in ${OUTPUT_DIR}\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`\nFATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
