/**
 * Generic tab recorder. Drives /sim?tab=<X>, performs scripted clicks,
 * records to webm, transcodes to mp4 + crops/trims.
 *
 * Usage:
 *   node record-tab.mjs <tab> <output-name> <record-seconds> <trim-start> <trim-duration>
 *
 * Examples:
 *   node record-tab.mjs library library-real 14 1 10
 *   node record-tab.mjs branches branches-real 14 1 10
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROD = 'https://paracosm.agentos.sh';
const VIEW = { width: 1280, height: 720 };
const OUT_DIR = path.resolve(__dirname, 'output');
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets', 'demo');

const tab = process.argv[2] || 'library';
const outName = process.argv[3] || `${tab}-real`;
const RECORD_SECONDS = parseInt(process.argv[4] || '14', 10);
const TRIM_START = parseInt(process.argv[5] || '1', 10);
const TRIM_DURATION = parseInt(process.argv[6] || '10', 10);

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(ASSETS_DIR, { recursive: true });

console.log(`[record:${tab}] launching headed chromium`);
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  viewport: VIEW,
  recordVideo: { dir: OUT_DIR, size: VIEW },
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log(`[browser error]`, m.text().slice(0, 200));
});

await page.addInitScript(() => {
  try {
    ['paracosm.tour.seen', 'tour.seen', 'tour-completed', 'paracosm.onboarding.dismissed'].forEach(k => localStorage.setItem(k, 'true'));
  } catch {}
});

console.log(`[record:${tab}] -> /sim`);
await page.goto(`${PROD}/sim`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3500);

console.log(`[record:${tab}] click #tab-${tab} (force)`);
await page.locator(`#tab-${tab}`).click({ timeout: 6000, force: true });
await page.waitForTimeout(1800);
await killTour();
const aft = await page.evaluate(() => document.querySelector('[aria-selected="true"]')?.getAttribute('aria-label'));
console.log(`[record:${tab}] active tab after click: ${aft}`);

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
for (const text of ['Got it', 'Skip', 'Skip tour', 'Dismiss', 'Close']) {
  const btn = page.locator('button', { hasText: text }).first();
  if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}
await killTour();

if (tab === 'library') {
  console.log('[record:library] settling 2s on the gallery view');
  await page.waitForTimeout(2000);
  console.log('[record:library] hover + click first run card');
  const card = page.locator('[data-run-card], .run-card, [class*="runCard"], [class*="RunCard"]').first();
  if (await card.isVisible({ timeout: 4000 }).catch(() => false)) {
    await card.hover().catch(() => {});
    await page.waitForTimeout(900);
    await card.click().catch(() => {});
    console.log('[record:library] drawer should be open');
    await page.waitForTimeout(2200);
    console.log('[record:library] click Replay');
    const replayBtn = page.locator('button', { hasText: /^Replay$/i }).first();
    if (await replayBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await replayBtn.click().catch(() => {});
      console.log('[record:library] waiting for replay result');
    } else {
      console.log('[record:library] no Replay button visible (probably no completed runs)');
    }
  } else {
    console.log('[record:library] no run cards visible — runs.db is empty');
  }
} else if (tab === 'branches') {
  console.log('[record:branches] settling 3s on the branches view');
  await page.waitForTimeout(3000);
}

console.log(`[record:${tab}] holding for ${RECORD_SECONDS - 4}s more`);
await page.waitForTimeout(Math.max(0, (RECORD_SECONDS - 4) * 1000));

const videoHandle = page.video();
await ctx.close();
await browser.close();

const webmPath = await videoHandle?.path();
console.log(`[record:${tab}] webm: ${webmPath}`);

const mp4Out = path.resolve(ASSETS_DIR, `${outName}.mp4`);
console.log(`[record:${tab}] -> ${mp4Out} (skip ${TRIM_START}s, take ${TRIM_DURATION}s)`);
execFileSync('ffmpeg', [
  '-y',
  '-ss', String(TRIM_START),
  '-i', webmPath,
  '-t', String(TRIM_DURATION),
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '22',
  '-pix_fmt', 'yuv420p',
  '-an',
  mp4Out,
], { stdio: ['ignore', 'inherit', 'inherit'] });
console.log(`[record:${tab}] done`);
