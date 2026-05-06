/**
 * Regression for the PDF parser worker init bug (Track 1A).
 *
 * Prior behaviour: a fresh page load → click PDF → upload → "PDF parser
 * failed to start. Hard-refresh the page (Cmd/Ctrl-Shift-R) and try
 * again." The hard-refresh recovery is a workaround, not a fix.
 *
 * Post-fix: pdf.js worker boots cleanly on first call. The
 * `hard-refresh` recovery message must never appear.
 */
import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');

test.describe('PDF upload @quickstart', () => {
  test('extracts text from a fresh page load with no hard-refresh', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));

    await page.goto('/sim?tab=quickstart');

    // Land on Quickstart and switch to the PDF sub-tab.
    const pdfTab = page.getByRole('tab', { name: 'PDF', exact: true });
    await pdfTab.click();

    // The dashboard hides the file input behind a clickable drop zone.
    // setInputFiles works on hidden inputs.
    const fileInput = page.locator('input[type=file][accept*="pdf"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'sample.pdf'));

    // After successful extraction, the dashboard switches back to the
    // WRITE tab and populates the seed textarea.
    const seedTextarea = page.locator('[data-quickstart-seed]');
    try {
      await expect(seedTextarea).toHaveValue(/.{200,}/s, { timeout: 10_000 });
    } catch (err) {
      // Surface what the dashboard actually rendered so the failure is
      // self-diagnosing instead of "element not found".
      const errorText = await page.locator('body').innerText();
      const lastFewErrors = consoleErrors.slice(-5).join('\n  ');
      console.log('--- DASHBOARD STATE ---\n', errorText.slice(0, 1500));
      console.log('--- CONSOLE ERRORS (last 5) ---\n', lastFewErrors);
      throw err;
    }

    // The "hard-refresh" recovery message must never appear.
    await expect(page.getByText(/hard-refresh/i)).toHaveCount(0);
  });

  test('shows actionable message for a scanned (text-less) PDF', async ({ page }) => {
    await page.goto('/sim?tab=quickstart');
    const pdfTab = page.getByRole('tab', { name: 'PDF', exact: true });
    await pdfTab.click();

    const fileInput = page.locator('input[type=file][accept*="pdf"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'scanned.pdf'));

    await expect(page.getByText(/scanned image|no text/i)).toBeVisible({ timeout: 10_000 });
  });
});
