/**
 * Compact "Replay last successful run" affordance shown above the
 * loaded-scenario CTA on the Quickstart input phase. Fetches
 * `/api/v1/runs?limit=1` on mount, surfaces a one-click link to the
 * existing replay surface (`?replay=<runId>`) when there's a recent
 * completed run with a captured artifact path. Renders nothing when
 * there's no eligible run — no visual noise on a fresh install.
 *
 * Replay infrastructure already exists: `useReplaySessionId` reads the
 * query param, `App.tsx` switches the SSE source to
 * `/sessions/<id>/replay`, and `ReplayBanner` advertises the mode.
 * This component is just the CTA that hands off into it.
 *
 * @module paracosm/dashboard/quickstart/ReplayLastRunCTA
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { buildReplayHref } from '../layout/LoadMenu.helpers';
import styles from './ReplayLastRunCTA.module.scss';

void React;

interface RunRecord {
  runId: string;
  scenarioId?: string;
  actorName?: string;
  actorArchetype?: string;
  costUSD?: number;
  durationMs?: number;
  createdAt?: string;
}

export function ReplayLastRunCTA() {
  const [run, setRun] = useState<RunRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/runs?limit=1');
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as { runs?: RunRecord[] } | null;
        const first = body?.runs?.[0];
        if (cancelled || !first?.runId) return;
        setRun(first);
      } catch {
        // Server / network unavailable — render nothing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!run) return null;
  const href = typeof window !== 'undefined'
    ? buildReplayHref(window.location.href, run.runId)
    : `?replay=${encodeURIComponent(run.runId)}`;
  const subtitle = [run.actorName, run.actorArchetype]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' · ');
  const meta = [
    run.scenarioId,
    typeof run.costUSD === 'number' ? `$${run.costUSD.toFixed(2)}` : null,
    typeof run.durationMs === 'number' ? `${Math.round(run.durationMs / 1000)}s` : null,
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' · ');

  return (
    <a className={styles.card} href={href} aria-label={`Replay last run: ${run.runId}`}>
      <span className={styles.eyebrow}>Replay last run</span>
      <span className={styles.row}>
        <span className={styles.actor}>{subtitle || run.runId}</span>
        <span className={styles.arrow} aria-hidden="true">▶</span>
      </span>
      {meta && <span className={styles.meta}>{meta}</span>}
    </a>
  );
}
