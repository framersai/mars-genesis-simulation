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
// `DURATION_SECONDS` is now informational only -- the recorder runs
// until the Quickstart results region appears, plus a fixed 35s tab
// tour. Kept on the CLI for back-compat with prior callers; ignored
// internally.
const DURATION_SECONDS = parseInt(process.argv[4] || '420', 10);
void DURATION_SECONDS;
const HEADED = process.env.E2E_HEADED === '1';
const KEEP_WEBM = process.env.E2E_KEEP_WEBM === '1';

const VIEW = { width: 1280, height: 720 };
const OUT_DIR = path.resolve(__dirname, 'output');
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets', 'demo');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(ASSETS_DIR, { recursive: true });

// Atlas-7 release director. Tightened to ~210 chars (just over the
// 200-char minimum SeedInput enforces) so the prompt-typing intro is
// readable in the recording instead of a wall of fast-scrolling text.
// The shape -- "ship on time / delay / override safety to beat a
// competitor" -- is what produces a measurably distinct fingerprint
// across the three auto-generated leaders.
const ATLAS_PROMPT = `Atlas Labs ships Atlas-7 next week. The safety team flagged unresolved jailbreak escalations and asked for a 6-week delay. The release director must decide: ship on time, delay, or override safety to beat the competitor.`;
const ATLAS_DOMAIN = 'AI safety lab release decision under board pressure';

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

// Pre-seed the tour-seen flag so the onboarding tour does not auto-
// start. Without this, App.tsx fires `setActiveTab('sim')` 600ms
// after mount on the quickstart tab, clobbering the form we want to
// fill. The exact key is `paracosm:tourSeen=1` (App.tsx:309); the
// other keys are belt-and-suspenders for older builds and
// dev-only test harnesses.
await page.addInitScript(() => {
  try {
    localStorage.setItem('paracosm:tourSeen', '1');
    const legacy = ['paracosm.tour.seen', 'tour.seen', 'tour-completed', 'paracosm.onboarding.dismissed'];
    legacy.forEach(k => localStorage.setItem(k, 'true'));
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
// Track key timestamps (ms-from-recording-start) so the hero ffmpeg pass
// below can split the source into segments and apply selective speed:
// 1× during prompt entry + results + tab tour, ~3× during the
// compile-and-run middle. Without this the loop would either be a wall
// of unreadable fast-typing OR 4 minutes of dead-air "compiling…".
const recStartMs = Date.now();
const seg = { promptDoneMs: 0, submitClickedMs: 0, resultsAppearedMs: 0 };
const since = () => Date.now() - recStartMs;

console.log('[e2e] focus seed textarea + type prompt');
const seedTextarea = page.locator('textarea').first();
await seedTextarea.waitFor({ state: 'visible', timeout: 8000 });
await seedTextarea.click();
// Slower typing (28 ms/char) so the prompt is readable while it's
// being typed. 210 chars × 28 ms ≈ 6 s of legible typing.
await seedTextarea.type(ATLAS_PROMPT, { delay: 28 });
seg.promptDoneMs = since();
// Hold the typed prompt for 2.5 s so a viewer can read it before the
// form submits and the compile spinner takes over.
await page.waitForTimeout(2500);

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
seg.submitClickedMs = since();

// ── 2. COMPILE + RUN WAIT ──────────────────────────────────────────────
// Quickstart runs the compile + ground-with-citations + leader generation
// + 3 parallel sims inside the QuickstartView -- it never redirects the
// URL to ?tab=sim. The progress UI walks 4 steps to checkmark, then
// flips to a results region (`<div role="region" aria-label="Quickstart
// results">`) when all artifacts have arrived (QuickstartView.tsx:106).
//
// We wait for that results region to appear so the tab tour below
// shows the just-completed Atlas-7 run instead of a stale cached run.
// Total wait covers compile (~60s) + grounding + leader gen + 3 sims
// of N turns; ~5-7 min on default 6-turn scenarios with gpt-5.4-mini.
console.log('[e2e] waiting for Quickstart results region (full run done)');
const RUN_TIMEOUT_MS = 600_000;            // 10 min hard cap
const compileStarted = Date.now();
let runCompleted = false;
try {
  await page.waitForSelector('[role="region"][aria-label="Quickstart results"]', {
    state: 'visible',
    timeout: RUN_TIMEOUT_MS,
  });
  runCompleted = true;
  seg.resultsAppearedMs = since();
  console.log(`[e2e] run finished after ${((Date.now() - compileStarted) / 1000).toFixed(1)}s`);
} catch {
  console.log('[e2e] run did not complete within timeout -- recording whatever is on screen');
}
// Hold the results card briefly so the verdict + leader fingerprint are
// visible in the recording before we tab-tour onto extras.
const RESULTS_HOLD_S = runCompleted ? 8 : 0;
if (RESULTS_HOLD_S > 0) {
  console.log(`[e2e] hold Quickstart results for ${RESULTS_HOLD_S}s`);
  await page.waitForTimeout(RESULTS_HOLD_S * 1000);
}

// ── 3-4. VIZ / REPORTS / LIBRARY TAB TOUR ─────────────────────────────
// With the Atlas-7 run installed in the runs database (the results
// region appearing implies artifacts in `sse.results` and a backing
// RunRecord), tab-switching now shows real Atlas-7 state instead of
// whatever cached run was last on screen.
const VIZ_HOLD_S = 10;
const REPORTS_HOLD_S = 10;
const LIBRARY_HOLD_S = 6;
const DRAWER_HOLD_S = 8;

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

// ── 6a. FULL REFERENCE TRANSCODE ───────────────────────────────────────
const mp4Out = path.resolve(ASSETS_DIR, `${OUT_NAME}.mp4`);
console.log('[e2e] ffmpeg -> full mp4:', mp4Out);
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

// ── 6b. HERO LOOP CUT (selective speed + caption) ──────────────────────
// Three segments stitched into one mp4:
//
//   A: 0 .. (submitClicked + 1.0 s)           1× speed, no caption
//      (prompt typing + 2.5 s read pause + the click landing)
//   B: (submitClicked + 1.0 s) .. (results - 0.5 s)
//                                             ~3× speed, "sped up" caption
//      (compile + ground + leader gen + 3 sims to Turn 6)
//   C: (results - 0.5 s) .. end of recording  1× speed, no caption
//      (results region + VIZ + REPORTS + LIBRARY + drawer)
//
// Falls back to a uniform 3× speed-up if `runCompleted` is false (the
// run hit the 10-min cap and we never got a results timestamp).
const heroOut = path.resolve(ASSETS_DIR, `${OUT_NAME}-hero.mp4`);
const aEnd = ((seg.submitClickedMs || 8000) + 1000) / 1000;
const bEnd = runCompleted
  ? Math.max(aEnd + 5, (seg.resultsAppearedMs - 500) / 1000)
  : null;
console.log(`[e2e] ffmpeg -> hero mp4: ${heroOut}`);
console.log(`  segments: A 0..${aEnd.toFixed(1)}s 1×, B ${aEnd.toFixed(1)}..${bEnd?.toFixed(1) ?? '∞'}s 3×, C ${bEnd?.toFixed(1) ?? '?'}s..end 1×`);
const SPEED_B = 3.0;
// drawtext caption stays inside the B trim window so it does not bleed
// into A or C frames after the concat. Box + opaque background so it
// reads cleanly over both light + dark UI states the dashboard cycles
// through during the compile spinner.
const caption = `Compile + 3 parallel sims · ${SPEED_B}× speed`;
const drawtext = (
  `drawtext=` +
  `text='${caption}'` +
  `:fontcolor=white` +
  `:fontsize=22` +
  `:font='Helvetica'` +
  `:x=(w-tw)/2` +
  `:y=h-72` +
  `:box=1:boxcolor=black@0.65:boxborderw=14`
);
const filterGraph = bEnd
  ? (
    `[0:v]trim=start=0:end=${aEnd.toFixed(3)},setpts=PTS-STARTPTS[a];` +
    `[0:v]trim=start=${aEnd.toFixed(3)}:end=${bEnd.toFixed(3)},setpts=(PTS-STARTPTS)/${SPEED_B},${drawtext}[b];` +
    `[0:v]trim=start=${bEnd.toFixed(3)},setpts=PTS-STARTPTS[c];` +
    `[a][b][c]concat=n=3:v=1[out]`
  )
  : (
    // Fallback: no run completed; whole thing 3× sped-up with caption.
    `[0:v]setpts=(PTS-STARTPTS)/${SPEED_B},${drawtext}[out]`
  );
execFileSync('ffmpeg', [
  '-y',
  '-i', webmPath,
  '-filter_complex', filterGraph,
  '-map', '[out]',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '22',
  '-pix_fmt', 'yuv420p',
  '-an',
  heroOut,
], { stdio: ['ignore', 'inherit', 'inherit'] });

// ── 6c. POSTER FROM RESULTS FRAME ──────────────────────────────────────
// Pull a still from inside the results-region hold so first-paint shows
// "what you'll get" instead of an empty Quickstart input.
if (runCompleted) {
  const posterOut = path.resolve(ASSETS_DIR, `${OUT_NAME}-poster.jpg`);
  const posterAt = Math.max(0, (seg.resultsAppearedMs / 1000) + 4); // 4 s into results
  console.log(`[e2e] ffmpeg -> poster jpg @ ${posterAt.toFixed(1)}s: ${posterOut}`);
  execFileSync('ffmpeg', [
    '-y',
    '-ss', String(posterAt),
    '-i', webmPath,
    '-frames:v', '1',
    '-q:v', '4',
    '-update', '1',
    posterOut,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
}

if (KEEP_WEBM) {
  const keptWebm = path.resolve(OUT_DIR, `${OUT_NAME}.webm`);
  copyFileSync(webmPath, keptWebm);
  console.log('[e2e] kept raw webm at:', keptWebm);
}
try { unlinkSync(webmPath); } catch {}

console.log('[e2e] done.');
console.log(`  full:   ${mp4Out}`);
console.log(`  hero:   ${heroOut}`);
console.log(`  segments: { promptDoneMs: ${seg.promptDoneMs}, submitClickedMs: ${seg.submitClickedMs}, resultsAppearedMs: ${seg.resultsAppearedMs} }`);
