/**
 * SSE envelope helper: validates stream events against the public
 * `StreamEventSchema` in development and emits raw in production (so
 * paying Zod parse cost per event doesn't land in hot paths).
 *
 * Also hosts the three legacy-to-new event-type renames documented in
 * the universal schema spec.
 *
 * @module paracosm/runtime/sse-envelope
 */
import {
  StreamEventSchema,
  type StreamEvent,
  type StreamEventType,
} from '../engine/schema/index.js';

/** Legacy event type names (pre-0.6.0) that need rewriting. */
const LEGACY_RENAMES: Record<string, StreamEventType> = {
  dept_start: 'specialist_start',
  dept_done: 'specialist_done',
  commander_deciding: 'decision_pending',
  commander_decided: 'decision_made',
  drift: 'personality_drift',
};

/**
 * Map a legacy (pre-0.6.0) event-type string onto the current
 * `StreamEventType`. Pass-through for types that didn't rename.
 */
export function mapLegacyEventType(type: string): StreamEventType {
  return (LEGACY_RENAMES[type] ?? type) as StreamEventType;
}

/**
 * Emit a stream event through a validated envelope. In development
 * (`NODE_ENV !== 'production'`), every emission is parsed through the
 * Zod schema first — a malformed payload throws immediately at the call
 * site that produced it instead of surfacing downstream as a dashboard
 * reducer crash. In production the schema parse is skipped for perf.
 */
export function emitStreamEvent(
  emit: (event: unknown) => void,
  event: StreamEvent,
): void {
  if (process.env.NODE_ENV !== 'production') {
    const parsed = StreamEventSchema.parse(event);
    emit(parsed);
  } else {
    emit(event);
  }
}
