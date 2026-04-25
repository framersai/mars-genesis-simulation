import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

const events = [];
page.on('console', (m) => events.push(`[console.${m.type()}] ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => events.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => events.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

await page.goto('https://paracosm.agentos.sh/sim', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);

const initialTab = await page.evaluate(() => {
  const url = new URL(window.location.href);
  return url.search + url.hash;
});
const tabBarTabs = await page.$$eval('[role="tablist"] [role="tab"], button[role="tab"]', (els) => els.map(e => ({ label: e.textContent?.trim(), aria: e.getAttribute('aria-selected') })));
const buttons = await page.$$eval('button', (els) => els.slice(0, 30).map(b => b.textContent?.trim().slice(0, 50)).filter(Boolean));
const headings = await page.$$eval('h1, h2, h3', (els) => els.map(h => `${h.tagName}: ${h.textContent?.trim().slice(0, 60)}`));

console.log('URL after load:', initialTab);
console.log('TABS:', JSON.stringify(tabBarTabs, null, 2));
console.log('BUTTONS:', buttons.join(' | '));
console.log('HEADINGS:', headings.join('\n  '));
console.log('---PAGE EVENTS---');
console.log(events.join('\n'));

await browser.close();
