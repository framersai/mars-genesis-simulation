/**
 * Citations end-to-end smoke.
 *
 * The compile-from-seed pipeline grounds scenarios with citations from
 * Serper/Tavily/Firecrawl/Brave and feeds them into department prompts.
 * That guarantees every commander decision and specialist note in a
 * grounded run is potentially citable. This spec verifies the pipe
 * downstream: when a cached session has citations, the dashboard's
 * Reports view actually surfaces them — a citation that gets dropped
 * between event stream and rendered report is the most insidious form
 * of provenance regression.
 *
 * Skips on a fresh server with no cached sessions, or on cached
 * sessions that don't carry citations (preset Mars Genesis runs from
 * before the citation pipeline landed).
 */
import { test, expect } from '@playwright/test';

interface SessionRow {
  id: string;
}

interface SessionEnvelope {
  events?: unknown[];
}

test.describe('Citations @citations', () => {
  test('reports view surfaces citations when present in the session events', async ({ page, request }) => {
    const list = (await (await request.get('/sessions')).json()) as { sessions?: SessionRow[] };
    test.skip(!list.sessions?.length, 'no sessions cached — skipping');

    let target: string | null = null;
    for (const s of list.sessions!.slice(0, 5)) {
      const detail = (await (await request.get(`/sessions/${s.id}`)).json()) as SessionEnvelope;
      const text = JSON.stringify(detail.events ?? []);
      // Citations land as either a structured `citations` array or a
      // legacy `sources` array depending on which compiler version
      // produced the run.
      if (/"citations"\s*:/.test(text) || /"sources"\s*:/.test(text)) {
        target = s.id;
        break;
      }
    }
    test.skip(!target, 'no cached session has citations to assert');

    await page.goto(`/sim?tab=reports&replay=${encodeURIComponent(target!)}`);
    // Reports surface citations as superscript markers (e.g. [1], [2])
    // or as an expanded sources panel. Match either.
    await expect(page.getByRole('main').getByText(/\[[1-9]\d?\]|cite|citation|source/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
