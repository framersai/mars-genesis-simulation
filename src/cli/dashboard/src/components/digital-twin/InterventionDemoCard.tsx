/**
 * InterventionDemoCard — Quickstart input-phase CTA that fires the
 * digital-twin demo. Shows a prefilled subject + intervention preview
 * (Atlas Lab + 90-day delay) and a single button. Click hits
 * POST /api/quickstart/simulate-intervention; on 200 the artifact is
 * forwarded to the parent (App.tsx) which parks it and switches to
 * the SIM tab so DigitalTwinPanel renders the result.
 *
 * Renders inline below SeedInput rather than in its own tab so the
 * dashboard tab bar does not balloon to 13 tabs. The capability is
 * surfaced where users decide what to run, not where they review
 * past runs.
 *
 * @module paracosm/dashboard/digital-twin/InterventionDemoCard
 */
import { useEffect, useRef, useState } from 'react';
import type { RunArtifact } from '../../../../../engine/schema/index.js';
import styles from './InterventionDemoCard.module.scss';

export interface InterventionDemoCardProps {
  onResult: (artifact: RunArtifact) => void;
  onError?: (message: string) => void;
  /**
   * Fires the moment the user clicks Run, before the fetch starts.
   * Carries the prefilled subject + intervention payload so App.tsx
   * can park it in interventionRunning state, reset SSE, and switch
   * to the SIM tab. The dashboard then renders DigitalTwinProgress
   * with subject/intervention echoed and live events streaming.
   */
  onRunStart?: (payload: {
    subject: { id: string; name: string; profile?: Record<string, unknown> };
    intervention: { id: string; name: string; description: string; duration?: { value: number; unit: string } };
  }) => void;
}

const SUBJECT_PREVIEW = {
  id: 'patient-maria-2026',
  name: 'Maria Chen, 58',
  meta: 'T2D · A1c 7.8% · BMI 31 · sedentary · family-history CVD',
};

const INTERVENTION_PREVIEW = {
  id: 'glp1-12wk-protocol',
  name: '12-week semaglutide + lifestyle',
  meta: '84 days · adherence target 0.85',
};

const SUBJECT_PAYLOAD = {
  id: 'patient-maria-2026',
  name: 'Maria Chen',
  profile: {
    age: 58,
    yearsWithT2D: 4,
    bmi: 31,
    a1cBaseline: 7.8,
    weightLb: 178,
    fastingGlucose: 156,
    sleepHoursBaseline: 6.2,
    exerciseMinPerWeek: 0,
    comorbidities: 'hypertension, dyslipidemia',
  },
  signals: [
    { label: 'HbA1c', value: 7.8, unit: '%', recordedAt: '2026-09-15T00:00:00Z' },
    { label: 'Fasting glucose', value: 156, unit: 'mg/dL', recordedAt: '2026-09-15T00:00:00Z' },
    { label: 'Weight', value: 178, unit: 'lb', recordedAt: '2026-09-15T00:00:00Z' },
    { label: 'BMI', value: 31, unit: 'kg/m²', recordedAt: '2026-09-15T00:00:00Z' },
  ],
  markers: [
    { id: 'family-history-cvd', category: 'cardiovascular', value: 'true' },
    { id: 'metformin-1000mg-bid', category: 'medication', value: 'baseline' },
  ],
};

const INTERVENTION_PAYLOAD = {
  id: 'glp1-12wk-protocol',
  name: '12-week semaglutide + lifestyle protocol',
  description: 'Initiate semaglutide 0.25mg weekly, titrate to 1.0mg by week 4. Pair with dietitian-led nutrition plan and 150min/wk graded exercise. Behavioral health checkpoints biweekly. Monitor for GI side effects, gallbladder, pancreatitis.',
  duration: { value: 84, unit: 'days' },
  adherenceProfile: { expected: 0.85 },
};

export function InterventionDemoCard({ onResult, onError, onRunStart }: InterventionDemoCardProps) {
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsedSec(Math.round((Date.now() - startedAtRef.current) / 1000));
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [running]);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setElapsedSec(0);
    startedAtRef.current = Date.now();
    // Tell App.tsx we just kicked off a digital-twin run BEFORE the
    // fetch lands so the SIM tab can switch and DigitalTwinProgress
    // can start consuming SSE events the server is about to stream.
    onRunStart?.({
      subject: { id: SUBJECT_PAYLOAD.id, name: SUBJECT_PAYLOAD.name, profile: SUBJECT_PAYLOAD.profile },
      intervention: {
        id: INTERVENTION_PAYLOAD.id,
        name: INTERVENTION_PAYLOAD.name,
        description: INTERVENTION_PAYLOAD.description,
        duration: INTERVENTION_PAYLOAD.duration,
      },
    });
    try {
      const res = await fetch('/api/quickstart/simulate-intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: SUBJECT_PAYLOAD,
          intervention: INTERVENTION_PAYLOAD,
          // 2 turns gives the LLM a chance to emit two events whose
          // categories hit the scenario's effects map; one turn left
          // every metric flat at its initial because a single event is
          // not enough to land a category match on every scenario
          // metric. Cold compile is pre-warmed on boot, so the wire
          // budget is just simulation time: ~50-90s for 2 turns at
          // economy, comfortably under Cloudflare's 100s gateway.
          options: { maxTurns: 2, seed: 11, costPreset: 'economy' },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(body.error ?? `Intervention run failed: HTTP ${res.status}`);
      }
      const body = await res.json() as { artifact: RunArtifact; durationMs: number };
      onResult(body.artifact);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <h3 className={styles.title}>Or test an intervention</h3>
        <span className={styles.eyebrow}>digital twin · single subject</span>
      </div>
      <p className={styles.copy}>
        Hold a person constant, apply one intervention, watch the trajectory. The example below runs Maria&apos;s 12-week semaglutide + lifestyle protocol against a five-department care-team scenario (endocrinology, nutrition, behavioral health, cardiology, lifestyle coach) at economy cost (~$0.20).
      </p>
      <div className={styles.preview}>
        <div className={styles.previewCell}>
          <span className={styles.previewLabel}>Subject</span>
          <span className={styles.previewName}>{SUBJECT_PREVIEW.name}</span>
          <span className={styles.previewMeta}>{SUBJECT_PREVIEW.meta}</span>
        </div>
        <div className={styles.previewCell}>
          <span className={styles.previewLabel}>Intervention</span>
          <span className={styles.previewName}>{INTERVENTION_PREVIEW.name}</span>
          <span className={styles.previewMeta}>{INTERVENTION_PREVIEW.meta}</span>
        </div>
      </div>
      <div className={styles.actions}>
        <button onClick={handleRun} disabled={running} className={styles.button}>
          {running ? 'Running…' : 'Run intervention demo'}
        </button>
        {running ? (
          <span className={styles.timer}>
            <span className={styles.spinner} />
            {elapsedSec}s elapsed · 2 turns × LLM decisions, typically 40-90s
          </span>
        ) : (
          <span className={styles.helper}>2 turns · seed 11 · economy preset</span>
        )}
      </div>
    </div>
  );
}
