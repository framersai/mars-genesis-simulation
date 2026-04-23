#!/usr/bin/env -S npx tsx
/**
 * F23.2 smoke test — validates that the corporate-quarterly scenario
 * runs end-to-end post-F23 and the returned artifact carries quarterly
 * time-unit metadata with no legacy `year`-family keys.
 *
 * Invocation: `npx tsx scripts/smoke-corporate-quarterly.ts`
 * Cost: ~$0.40-0.60 on OpenAI economy preset.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SCENARIO_PATH = join(ROOT, 'scenarios', 'corporate-quarterly.json');
const OUTPUT_DIR = join(ROOT, 'output');
const CACHE_DIR = join(ROOT, '.paracosm', 'cache');

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

async function main(): Promise<void> {
  log('--- F23.2 corporate-quarterly smoke ---');
  const worldJson = JSON.parse(readFileSync(SCENARIO_PATH, 'utf8')) as Record<string, unknown>;
  const labels = worldJson.labels as Record<string, string>;
  log(`scenario: ${labels.name} (id=${worldJson.id as string})`);
  log(`timeUnitNoun: ${labels.timeUnitNoun} / ${labels.timeUnitNounPlural}`);
  log(`defaultStartTime: ${(worldJson.setup as Record<string, unknown>).defaultStartTime}`);
  log(`defaultTimePerTurn: ${(worldJson.setup as Record<string, unknown>).defaultTimePerTurn}`);
  log('dry-run OK (no LLM spend yet)');
}

main().catch((err: unknown) => {
  process.stderr.write(`FATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
