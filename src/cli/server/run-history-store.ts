import type { RunRecord } from './run-record.js';
import type { ParacosmServerMode } from './server-mode.js';

export interface ListRunsFilters {
  mode?: ParacosmServerMode;
  scenarioId?: string;
  leaderConfigHash?: string;
  limit?: number;
  offset?: number;
}

export interface RunHistoryStore {
  insertRun(run: RunRecord): Promise<void>;
  listRuns(filters?: ListRunsFilters): Promise<RunRecord[]>;
  getRun(runId: string): Promise<RunRecord | null>;
  countRuns?(filters?: Pick<ListRunsFilters, 'mode' | 'scenarioId' | 'leaderConfigHash'>): Promise<number>;
}

export function createNoopRunHistoryStore(): RunHistoryStore {
  return {
    async insertRun() {},
    async listRuns() { return []; },
    async getRun() { return null; },
    async countRuns() { return 0; },
  };
}
