import playwright from '/Users/johnn/Documents/git/voice-chat-assistant/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.js';
const browser = await playwright.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { try { localStorage.setItem('paracosm:tourSeen', '1'); } catch {} });
const page = await ctx.newPage();
await page.goto('https://paracosm.agentos.sh/sim', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('tab', { name: /^viz$/i }).first().click({ force: true }).catch(() => {});
await page.waitForTimeout(2500);
const found = await page.evaluate(() => {
  function walk(n, out) { if (!n) return; if (n.nodeType === 3 && /u2630|☰/.test(n.nodeValue ?? '')) out.push(n); for (const c of n.childNodes) walk(c, out); }
  const m = []; walk(document.body, m);
  return m.map(t => ({ text: (t.nodeValue ?? '').slice(0, 100), tag: t.parentElement?.tagName, cls: typeof t.parentElement?.className === 'string' ? t.parentElement.className : '', aria: t.parentElement?.getAttribute('aria-label') }));
});
console.log(JSON.stringify(found, null, 2));
await browser.close();
