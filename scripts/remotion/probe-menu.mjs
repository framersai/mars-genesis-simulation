import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  ['paracosm.tour.seen', 'tour.seen', 'tour-completed'].forEach(k => localStorage.setItem(k, 'true'));
});
await page.goto('https://paracosm.agentos.sh/sim?tab=sim', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelectorAll('[data-tour-overlay], [data-tour]').forEach(el => el.remove()));

const runBtn = page.locator('button', { hasText: /^▶RUN/ }).first();
await runBtn.click();
await page.waitForTimeout(800);
const items = await page.$$eval('[role="menu"] *, [role="menuitem"], button, a', (els) => els.map(e => e.textContent?.trim()).filter(t => t && t.length < 80 && t.length > 1).slice(0, 40));
console.log('After click, visible items:');
console.log(items.join('\n'));
const screenshot = await page.screenshot({ path: '/tmp/run-menu.png' });
console.log('screenshot saved /tmp/run-menu.png');
await browser.close();
