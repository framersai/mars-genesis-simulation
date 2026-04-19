import { createHash, randomUUID } from 'node:crypto';
import type { ParacosmServerMode } from './server-mode.js';

export interface RunRecord {
  runId: string;
  createdAt: string;
  scenarioId: string;
  scenarioVersion: string;
  leaderConfigHash: string;
  economicsProfile: string;
  sourceMode: ParacosmServerMode;
  createdBy: 'anonymous' | 'user' | 'service';
}

export function createRunRecord(input: Omit<RunRecord, 'runId' | 'createdAt'>): RunRecord {
  return {
    runId: `run_${randomUUID()}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export function hashLeaderConfig(input: unknown): string {
  return `leaders:${createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 12)}`;
}
