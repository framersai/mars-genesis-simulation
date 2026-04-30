import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', '..', 'assets', 'demo');

const browser = await chromium.launch({ headless: true });
// fresh context with NO localStorage (simulates first-time visit; no setup-redirect)
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  ['paracosm.tour.seen', 'tour.seen', 'tour-completed', 'paracosm.onboarding.dismissed'].forEach(k => localStorage.setItem(k, 'true'));
});
await page.goto('https://paracosm.agentos.sh/sim?tab=library', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
await page.evaluate(() => {
  document.querySelectorAll('[data-tour-overlay], [data-tour], [data-tour-step]').forEach(el => el.remove());
});
const url = page.url();
console.log('after settle, url:', url);
const activeTab = await page.evaluate(() => document.querySelector('[aria-selected="true"]')?.getAttribute('aria-label'));
console.log('active tab:', activeTab);

const snapshot = await page.screenshot({ path: path.resolve(ASSETS, 'library-poster.png'), type: 'png' });
console.log('saved library-poster.png');
await browser.close();
