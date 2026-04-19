import type { RunRecord } from './run-record.js';

export interface RunHistoryStore {
  insertRun(run: RunRecord): Promise<void>;
  listRuns(): Promise<RunRecord[]>;
  getRun(runId: string): Promise<RunRecord | null>;
}

export function createNoopRunHistoryStore(): RunHistoryStore {
  return {
    async insertRun() {},
    async listRuns() { return []; },
    async getRun() { return null; },
  };
}
