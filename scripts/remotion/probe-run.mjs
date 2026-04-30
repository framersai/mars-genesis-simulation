/**
 * Find what actually happens when you click RUN on the live site.
 * Logs every network request after the click.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  ['paracosm.tour.seen', 'tour.seen', 'tour-completed', 'paracosm.onboarding.dismissed'].forEach(k => localStorage.setItem(k, 'true'));
});

const requests = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('paracosm.agentos.sh') && !u.includes('.mp4') && !u.includes('.css') && !u.includes('.js') && !u.includes('.svg') && !u.includes('.png')) {
    requests.push(`${req.method()} ${u.replace('https://paracosm.agentos.sh', '')}`);
  }
});
page.on('response', (resp) => {
  const u = resp.url();
  if (u.includes('paracosm.agentos.sh') && (u.includes('/api/') || u.includes('/setup') || u.includes('/simulate') || u.includes('/events'))) {
    console.log(`< ${resp.status()} ${u.replace('https://paracosm.agentos.sh', '')}`);
  }
});

await page.goto('https://paracosm.agentos.sh/sim?tab=sim', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelectorAll('[data-tour-overlay], [data-tour]').forEach(el => el.remove()));

console.log('--- BEFORE CLICK ---');
console.log(requests.slice(-10).join('\n'));
requests.length = 0;

console.log('--- CLICKING ▶RUN ---');
const runBtn = page.locator('button', { hasText: /^▶RUN/ }).first();
await runBtn.click();
await page.waitForTimeout(4000);
console.log('--- AFTER CLICK ---');
console.log(requests.join('\n'));

await browser.close();
