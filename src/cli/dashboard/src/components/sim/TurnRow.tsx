import * as React from 'react';
import type { CSSProperties } from 'react';
import { EventCard } from './EventCard.js';
import { DiffBadge } from './DiffBadge.js';
import { getActorColorVar } from '../../hooks/useGameState.js';
import type { ProcessedEvent } from '../../hooks/useGameState.js';
import type { TurnDiffEntry } from './turn-diff.js';
import styles from './TurnRow.module.scss';

void React;

/** Event types that filter to `null` in the cell render. They represent
 *  in-flight work (department analyzing, decision pending) that gets
 *  superseded by their `_done` counterparts. We need to know if a cell
 *  has *only* these so we can show "Working…" instead of an empty cell. */
const PENDING_TYPES = new Set(['turn_start', 'specialist_start', 'decision_pending']);

function summarizePending(events: ProcessedEvent[]): string {
  const depts = new Set<string>();
  let waitingDecision = false;
  for (const e of events) {
    if (e.type === 'specialist_start') {
      const dept = (e.data as { department?: string })?.department;
      if (typeof dept === 'string' && dept.length > 0) depts.add(dept);
    } else if (e.type === 'decision_pending') {
      waitingDecision = true;
    }
  }
  const parts: string[] = [];
  if (depts.size > 0) parts.push(`${[...depts].join(', ')} analyzing`);
  if (waitingDecision) parts.push('awaiting decision');
  return parts.length > 0 ? parts.join(' · ') + '…' : 'Working on this turn…';
}

interface TurnRowProps {
  entry: TurnDiffEntry;
  eventsA: ProcessedEvent[];
  eventsB: ProcessedEvent[];
}

export function TurnRow({ entry, eventsA, eventsB }: TurnRowProps) {
  const rowClass = `${styles.row} ${
    entry.classification === 'different-outcome' ? styles.differentOutcome
    : entry.classification === 'different-event' ? styles.differentEvent
    : ''
  }`;

  const sameTitle = entry.titleA === entry.titleB && entry.titleA !== '';

  return (
    <section
      id={`turn-row-${entry.turn}`}
      className={rowClass}
      aria-labelledby={`turn-row-${entry.turn}-h`}
    >
      <h3 id={`turn-row-${entry.turn}-h`} className={styles.header}>
        <span className={styles.headerTurn}>T{entry.turn}</span>
        <DiffBadge classification={entry.classification} />
        {sameTitle ? (
          <span className={styles.headerTitle}>{entry.titleA}</span>
        ) : (
          <span className={styles.headerTitleSplit}>
            <span className={styles.headerTitleA}>{entry.titleA || '—'}</span>
            <span className={styles.headerTitleB}>{entry.titleB || '—'}</span>
          </span>
        )}
      </h3>

      <div className={styles.cells}>
        {[eventsA, eventsB].map((cellEvents, idx) => {
          const renderable = cellEvents.filter(e => !PENDING_TYPES.has(e.type));
          const allPending = cellEvents.length > 0 && renderable.length === 0;
          return (
            <div
              key={idx}
              className={styles.cell}
              style={{ ['--cell-color' as string]: getActorColorVar(idx) } as CSSProperties}
              aria-label={`Leader ${idx === 0 ? 'A' : 'B'} events for this turn`}
            >
              <span className={styles.cellBand} aria-hidden="true" />
              {cellEvents.length === 0 ? (
                <div className={styles.cellEmpty}>(no events yet)</div>
              ) : allPending ? (
                <div className={styles.cellPending} aria-live="polite">
                  <span className={`spinner ${styles.cellPendingSpinner}`} />
                  {summarizePending(cellEvents)}
                </div>
              ) : (
                renderable.map(e => <EventCard key={e.id} event={e} actorIndex={idx as 0 | 1} />)
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
