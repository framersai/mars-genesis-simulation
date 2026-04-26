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

console.log(`[record:${tab}] -> /sim?tab=${tab}`);
await page.goto(`${PROD}/sim?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);
const aft = await page.evaluate(() => document.querySelector('[aria-selected="true"]')?.getAttribute('aria-label'));
console.log(`[record:${tab}] active tab after settle: ${aft}`);

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
  console.log('[record:library] beat 1: settle on gallery view (~3s)');
  await page.waitForTimeout(3000);

  console.log('[record:library] beat 2: hover first card (~1.2s)');
  const card = page.locator('[data-run-card], .run-card, [class*="runCard"], [class*="RunCard"], a[href*="runId="]').first();
  if (await card.isVisible({ timeout: 4000 }).catch(() => false)) {
    await card.hover().catch(() => {});
    await page.waitForTimeout(1200);

    console.log('[record:library] beat 3: click card to open drawer');
    await card.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);

    console.log('[record:library] beat 4: click Replay button');
    const replayBtn = page.locator('button', { hasText: /^Replay$/i }).first();
    if (await replayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await replayBtn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      await replayBtn.click({ force: true }).catch(() => {});
      console.log('[record:library] beat 5: wait for replay verification');
      await page.waitForTimeout(4000);
    } else {
      console.log('[record:library] no Replay button found; settling instead');
      await page.waitForTimeout(3000);
    }

    console.log('[record:library] beat 6: hold for closing pose');
    await page.waitForTimeout(2000);
  } else {
    console.log('[record:library] no run cards visible — runs.db is empty');
    await page.waitForTimeout(8000);
  }
} else if (tab === 'branches') {
  console.log('[record:branches] beat 1: settle on branches view (~4s)');
  await page.waitForTimeout(4000);
  // If there's a fork-from-existing-run CTA, click it
  const forkBtn = page.locator('button, a', { hasText: /Fork|Create branch|New branch/i }).first();
  if (await forkBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('[record:branches] beat 2: click fork CTA');
    await forkBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  console.log('[record:branches] beat 3: hold for the rest');
  await page.waitForTimeout(8000);
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
