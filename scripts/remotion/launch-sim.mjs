/**
 * Headless launch of a real sim on prod (no recording).
 * Use this to populate runs.db before recording library/branches.
 */
import { chromium } from 'playwright';

const PROD = 'https://paracosm.agentos.sh';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  try {
    const keys = ['paracosm.tour.seen', 'tour.seen', 'tour-completed', 'paracosm.onboarding.dismissed'];
    keys.forEach(k => localStorage.setItem(k, 'true'));
  } catch {}
});

console.log('[launch] -> /sim?tab=sim');
await page.goto(`${PROD}/sim?tab=sim`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3500);

await page.evaluate(() => {
  document.querySelectorAll('[data-tour-overlay], [data-tour], [data-tour-step]').forEach(el => el.remove());
});

console.log('[launch] click ▶RUN');
const runBtn = page.locator('button', { hasText: /^▶RUN/ }).first();
await runBtn.waitFor({ state: 'visible', timeout: 8000 });
await runBtn.click();
console.log('[launch] sim launched at', new Date().toISOString());
await page.waitForTimeout(3000);
await browser.close();
console.log('[launch] browser closed; sim continues server-side');
