import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', '..', 'assets', 'demo');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  ['paracosm.tour.seen', 'tour.seen', 'tour-completed'].forEach(k => localStorage.setItem(k, 'true'));
});

for (const tab of ['library', 'branches']) {
  console.log(`-> /sim?tab=${tab}`);
  await page.goto(`https://paracosm.agentos.sh/sim?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await page.evaluate(() => document.querySelectorAll('[data-tour-overlay], [data-tour]').forEach(el => el.remove()));
  await page.waitForTimeout(500);
  const out = path.resolve(ASSETS, `${tab}-poster.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: false });
  console.log(`  saved ${out}`);
}
await browser.close();
