// Inspect the docs left-nav after typedoc hydration to see what my
// fix did to the DOM and where the moved-out links ended up.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('https://paracosm.agentos.sh/docs/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const dump = await page.evaluate(() => {
  const nav = document.getElementById('tsd-nav-container');
  if (!nav) return 'no #tsd-nav-container';
  const out = [];
  function walk(el, depth) {
    if (depth > 6) return;
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).filter(Boolean).join('.') : '';
    const id = el.id ? '#' + el.id : '';
    const text = (el.childNodes.length === 1 && el.firstChild.nodeType === 3) ? ` "${el.textContent.trim().slice(0, 30)}"` : '';
    const open = tag === 'details' ? (el.open ? '[open]' : '[closed]') : '';
    const href = tag === 'a' ? ` href=${el.getAttribute('href')}` : '';
    const data = el.dataset.tsdExtracted ? ' [extracted]' : '';
    const visible = el.offsetParent !== null ? '' : ' (HIDDEN)';
    out.push('  '.repeat(depth) + tag + id + cls + open + href + data + text + visible);
    for (const child of el.children) walk(child, depth + 1);
  }
  walk(nav, 0);
  return out.join('\n');
});

console.log(dump);
await browser.close();
