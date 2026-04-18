import test from 'node:test';
import assert from 'node:assert/strict';
import { createCostTracker } from './cost-tracker.js';

const modelConfig = {
  commander: 'claude-sonnet-4-6',
  departments: 'claude-sonnet-4-6',
  judge: 'claude-haiku-4-5-20251001',
  director: 'claude-sonnet-4-6',
  agentReactions: 'claude-haiku-4-5-20251001',
};

test('recordSchemaAttempt aggregates per-schema counts', () => {
  const tracker = createCostTracker(modelConfig);
  tracker.recordSchemaAttempt('DepartmentReport', 1, false);
  tracker.recordSchemaAttempt('DepartmentReport', 2, false);
  tracker.recordSchemaAttempt('DepartmentReport', 3, true);
  const cost = tracker.finalCost();
  assert.ok(cost.schemaRetries);
  const dept = cost.schemaRetries!.DepartmentReport;
  assert.equal(dept.calls, 3);
  assert.equal(dept.attempts, 6);
  assert.equal(dept.fallbacks, 1);
});

test('recordSchemaAttempt keeps per-schema buckets separate', () => {
  const tracker = createCostTracker(modelConfig);
  tracker.recordSchemaAttempt('DepartmentReport', 1, false);
  tracker.recordSchemaAttempt('CommanderDecision', 2, false);
  tracker.recordSchemaAttempt('DepartmentReport', 1, false);
  const cost = tracker.finalCost();
  assert.equal(cost.schemaRetries!.DepartmentReport.calls, 2);
  assert.equal(cost.schemaRetries!.CommanderDecision.calls, 1);
  assert.equal(cost.schemaRetries!.CommanderDecision.attempts, 2);
});

test('finalCost omits schemaRetries when no schema attempt was recorded', () => {
  const tracker = createCostTracker(modelConfig);
  const cost = tracker.finalCost();
  assert.equal(cost.schemaRetries, undefined);
});

test('recordSchemaAttempt ignores empty schema names', () => {
  const tracker = createCostTracker(modelConfig);
  tracker.recordSchemaAttempt('', 3, false);
  const cost = tracker.finalCost();
  assert.equal(cost.schemaRetries, undefined);
});

test('recordForgeAttempt aggregates approved/rejected/confidence', () => {
  const tracker = createCostTracker(modelConfig);
  tracker.recordForgeAttempt(true, 0.9);
  tracker.recordForgeAttempt(true, 0.8);
  tracker.recordForgeAttempt(false, 0);
  const cost = tracker.finalCost();
  assert.ok(cost.forgeStats);
  assert.equal(cost.forgeStats!.attempts, 3);
  assert.equal(cost.forgeStats!.approved, 2);
  assert.equal(cost.forgeStats!.rejected, 1);
  // Rounding-tolerant: 0.9 + 0.8 should be within floating tolerance of 1.7
  assert.ok(Math.abs(cost.forgeStats!.approvedConfidenceSum - 1.7) < 1e-9);
});

test('buildCostPayload includes forgeStats once any forge has been recorded', () => {
  const tracker = createCostTracker(modelConfig);
  const before = tracker.buildCostPayload();
  assert.equal(before.forgeStats, undefined);

  tracker.recordForgeAttempt(false, 0);
  const after = tracker.buildCostPayload();
  assert.ok(after.forgeStats);
  assert.equal(after.forgeStats!.attempts, 1);
  assert.equal(after.forgeStats!.approved, 0);
  assert.equal(after.forgeStats!.rejected, 1);
});

test('finalCost omits forgeStats when no forge attempt was recorded', () => {
  const tracker = createCostTracker(modelConfig);
  const cost = tracker.finalCost();
  assert.equal(cost.forgeStats, undefined);
});

test('rejected forges do not contribute to approvedConfidenceSum', () => {
  const tracker = createCostTracker(modelConfig);
  tracker.recordForgeAttempt(true, 0.7);
  tracker.recordForgeAttempt(false, 0);
  tracker.recordForgeAttempt(false, 0);
  tracker.recordForgeAttempt(true, 0.85);
  const cost = tracker.finalCost();
  // Only two approvals contribute; rejected confidence=0 is filtered out.
  assert.ok(Math.abs(cost.forgeStats!.approvedConfidenceSum - 1.55) < 1e-9);
  assert.equal(cost.forgeStats!.approved, 2);
  assert.equal(cost.forgeStats!.rejected, 2);
  assert.equal(cost.forgeStats!.attempts, 4);
});
