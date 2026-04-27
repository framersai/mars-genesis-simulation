/**
 * End-to-end demo recorder.
 *
 * Walks one prompt across every public visualization in the dashboard:
 *
 *   1. /sim?tab=quickstart -- type a prompt, click "Generate + Run 3 Leaders"
 *   2. compile completes -- /sim?tab=sim takes over (real LLM activity)
 *   3. SIM tab -- live commander/department turns
 *   4. VIZ tab -- visualizations (HEXACO drift, trajectory)
 *   5. REPORTS tab -- fingerprint summary
 *   6. LIBRARY tab -- artifact list
 *   7. RunDetailDrawer -- artifact drilldown
 *
 * Records continuously into a single webm, then post-processes with
 * ffmpeg to speed up the slow compile-wait window so the final mp4 is
 * watchable end-to-end without dead air.
 *
 * Usage:
 *   node record-end-to-end.mjs [output-name] [host] [duration-seconds]
 *
 * Defaults:
 *   output-name      e2e-atlas-7
 *   host             https://paracosm.agentos.sh
 *   duration         210 (seconds; covers compile + sim + tab tour)
 *
 * Environment:
 *   E2E_HEADED=1     run headed instead of headless (debugging)
 *   E2E_KEEP_WEBM=1  keep the raw webm next to the mp4 (debugging)
 *
 * Output:
 *   ../../assets/demo/<output-name>.mp4         (final, post-processed)
 *   ./output/<output-name>.webm                 (raw, when E2E_KEEP_WEBM=1)
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, copyFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUT_NAME = process.argv[2] || 'e2e-atlas-7';
const HOST = process.argv[3] || 'https://paracosm.agentos.sh';
const DURATION_SECONDS = parseInt(process.argv[4] || '210', 10);
const HEADED = process.env.E2E_HEADED === '1';
const KEEP_WEBM = process.env.E2E_KEEP_WEBM === '1';

const VIEW = { width: 1280, height: 720 };
const OUT_DIR = path.resolve(__dirname, 'output');
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets', 'demo');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(ASSETS_DIR, { recursive: true });

// Atlas-7 release director. The freshest scenario in the repo and the
// one wired into the landing page's Trait Models tab. ai-agent leader
// profile is intentionally adversarial -- the simulation surfaces a
// risky_failure outcome class which is visually distinct from the
// conservative-success outcome a balanced leader would produce.
const ATLAS_PROMPT = `Q4 2026 board brief: Atlas Labs is preparing to release Atlas-7, their next-generation general-purpose AI system. The release director must choose between (a) accepting the safety team's red-team report and delaying 6 weeks, (b) shipping on time with caveats, or (c) overriding the safety team and shipping early to beat a competitor announcement. Production traffic, $40M quarterly revenue at stake, 3 prior incidents of jailbreak escalation unresolved.`;
const ATLAS_DOMAIN = 'AI safety lab leadership decision under release pressure';

console.log(`[e2e] launching ${HEADED ? 'headed' : 'headless'} chromium`);
const browser = await chromium.launch({ headless: !HEADED });
const ctx = await browser.newContext({
  viewport: VIEW,
  recordVideo: { dir: OUT_DIR, size: VIEW },
});
const page = await ctx.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('[error]') || m.type() === 'error') console.log(`  [browser ${m.type()}]`, t.slice(0, 240));
});

// Pre-seed localStorage so the onboarding tour does not block the
// quickstart form on first load. Mirrors record-sim.mjs.
await page.addInitScript(() => {
  try {
    const keys = ['paracosm.tour.seen', 'tour.seen', 'tour-completed', 'paracosm.onboarding.dismissed'];
    keys.forEach(k => localStorage.setItem(k, 'true'));
  } catch {}
});

console.log(`[e2e] -> ${HOST}/sim?tab=quickstart`);
await page.goto(`${HOST}/sim?tab=quickstart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);

async function killTour() {
  await page.evaluate(() => {
    const sel = '[data-tour-overlay], [data-tour], [data-tour-step], .tour-overlay, .tour-step, .tour-popover, .tour-callout';
    document.querySelectorAll(sel).forEach(el => el.remove());
    document.querySelectorAll('*').forEach(el => {
      for (const attr of el.attributes ?? []) {
        if (attr.name.startsWith('data-') && attr.name.toLowerCase().includes('tour')) {
          el.remove();
          break;
        }
      }
    });
  });
}
await killTour();
for (const text of ['Got it', 'Skip', 'Dismiss', 'Skip tour', 'Close']) {
  const btn = page.locator('button', { hasText: text }).first();
  if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(250);
  }
}
await killTour();

// ── 1. PROMPT ENTRY ─────────────────────────────────────────────────────
console.log('[e2e] focus seed textarea + type prompt');
const seedTextarea = page.locator('textarea').first();
await seedTextarea.waitFor({ state: 'visible', timeout: 8000 });
await seedTextarea.click();
await seedTextarea.type(ATLAS_PROMPT, { delay: 8 });
await page.waitForTimeout(400);

console.log('[e2e] fill domain hint');
const domainHint = page.locator('#quickstart-domain-hint');
if (await domainHint.isVisible({ timeout: 1500 }).catch(() => false)) {
  await domainHint.click();
  await domainHint.type(ATLAS_DOMAIN, { delay: 12 });
  await page.waitForTimeout(300);
}

console.log('[e2e] click "Generate + Run 3 Leaders"');
const submit = page.locator('button', { hasText: /Generate \+ Run/i }).first();
await submit.waitFor({ state: 'visible', timeout: 4000 });
await submit.click();

// ── 2. COMPILE WAIT ─────────────────────────────────────────────────────
// Compile + scenario hooks generation runs $0.10 of LLM calls; takes
// 30-90s on prod depending on the model and seed-search settings. We
// wait for the URL to flip to ?tab=sim, which the dashboard does as
// soon as the runtime kicks in. Hard cap at 180s so a stuck compile
// doesn't hang the recorder forever.
console.log('[e2e] waiting for ?tab=sim (compile + run start)');
const COMPILE_TIMEOUT_MS = 180_000;
const compileStarted = Date.now();
try {
  await page.waitForURL(/[?&]tab=sim(?:&|$)/, { timeout: COMPILE_TIMEOUT_MS });
  console.log(`[e2e] sim tab activated after ${((Date.now() - compileStarted) / 1000).toFixed(1)}s`);
} catch {
  console.log('[e2e] compile did not finish within timeout -- continuing with whatever is on screen');
}
await page.waitForTimeout(1500);

// ── 3-4. SIM + VIZ TAB TOUR ─────────────────────────────────────────────
// Recording continues across all of these. Total budget is the leftover
// of DURATION_SECONDS minus the prompt+compile time we already spent.
const elapsedSeconds = (Date.now() - compileStarted) / 1000;
const remaining = Math.max(60, DURATION_SECONDS - Math.floor(elapsedSeconds) - 12);
console.log(`[e2e] sim+viz+reports+library tour: ${remaining}s of remaining budget`);

const SIM_HOLD_S = Math.max(20, Math.floor(remaining * 0.55));
const VIZ_HOLD_S = 10;
const REPORTS_HOLD_S = 10;
const LIBRARY_HOLD_S = 6;
const DRAWER_HOLD_S = 8;

console.log(`[e2e] hold SIM tab for ${SIM_HOLD_S}s`);
await page.waitForTimeout(SIM_HOLD_S * 1000);

async function clickTab(id) {
  const ok = await page.evaluate((tid) => {
    const el = document.getElementById(`tab-${tid}`);
    if (el) { el.click(); return true; }
    return false;
  }, id);
  if (!ok) console.log(`[e2e] tab #tab-${id} not found`);
  return ok;
}

console.log(`[e2e] -> VIZ tab (${VIZ_HOLD_S}s)`);
await clickTab('viz');
await page.waitForTimeout(VIZ_HOLD_S * 1000);

console.log(`[e2e] -> REPORTS tab (${REPORTS_HOLD_S}s)`);
await clickTab('reports');
await page.waitForTimeout(REPORTS_HOLD_S * 1000);

console.log(`[e2e] -> LIBRARY tab (${LIBRARY_HOLD_S}s)`);
await clickTab('library');
await page.waitForTimeout(LIBRARY_HOLD_S * 1000);

// ── 5. LIBRARY DRAWER ───────────────────────────────────────────────────
// Click the first run card (latest run = the one we just produced).
// RunCard.tsx renders [data-run-card] articles; first-of-type targets
// the most recent because RunGallery sorts createdAt-desc.
console.log(`[e2e] open most-recent run drawer (${DRAWER_HOLD_S}s)`);
const firstCard = page.locator('[data-run-card]').first();
if (await firstCard.isVisible({ timeout: 2000 }).catch(() => false)) {
  await firstCard.click();
  await page.waitForTimeout(DRAWER_HOLD_S * 1000);
} else {
  console.log('[e2e] no run cards visible (run may not have completed yet)');
  await page.waitForTimeout(DRAWER_HOLD_S * 1000);
}

// ── 6. FINISH + FFMPEG ──────────────────────────────────────────────────
const videoHandle = page.video();
console.log('[e2e] closing context to flush video');
await ctx.close();
await browser.close();

const webmPath = await videoHandle?.path();
if (!webmPath) {
  console.error('[e2e] no video path returned');
  process.exit(1);
}
console.log('[e2e] webm written:', webmPath);

const mp4Out = path.resolve(ASSETS_DIR, `${OUT_NAME}.mp4`);
console.log('[e2e] ffmpeg -> mp4:', mp4Out);
// Plain transcode (no speed manipulation in v1). The compile-wait
// portion will be visible at real time. Future: split-and-concat with
// setpts on the compile window for a tighter cut.
execFileSync('ffmpeg', [
  '-y',
  '-i', webmPath,
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '22',
  '-pix_fmt', 'yuv420p',
  '-an',
  mp4Out,
], { stdio: ['ignore', 'inherit', 'inherit'] });

if (KEEP_WEBM) {
  const keptWebm = path.resolve(OUT_DIR, `${OUT_NAME}.webm`);
  copyFileSync(webmPath, keptWebm);
  console.log('[e2e] kept raw webm at:', keptWebm);
}
try { unlinkSync(webmPath); } catch {}

console.log('[e2e] done. Output:', mp4Out);
