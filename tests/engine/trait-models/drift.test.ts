import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hexacoModel } from '../../../src/engine/trait-models/hexaco.js';
import { aiAgentModel } from '../../../src/engine/trait-models/ai-agent.js';
import {
  applyOutcomeDrift,
  applyLeaderPull,
  applyRoleActivation,
} from '../../../src/engine/trait-models/drift.js';

describe('applyOutcomeDrift', () => {
  it('applies HEXACO openness +0.04 on risky_success', () => {
    const profile = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    const next = applyOutcomeDrift(profile, hexacoModel, { outcome: 'risky_success' });
    assert.ok(Math.abs(next.traits.openness - 0.54) < 1e-9);
  });

  it('applies HEXACO emotionality +0.04 on risky_failure', () => {
    const profile = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    const next = applyOutcomeDrift(profile, hexacoModel, { outcome: 'risky_failure' });
    assert.ok(Math.abs(next.traits.emotionality - 0.54) < 1e-9);
  });

  it('applies ai-agent verification-rigor +0.04 on risky_failure', () => {
    const profile = { modelId: 'ai-agent', traits: { ...aiAgentModel.defaults } };
    const next = applyOutcomeDrift(profile, aiAgentModel, { outcome: 'risky_failure' });
    assert.ok(Math.abs(next.traits['verification-rigor'] - 0.54) < 1e-9);
  });

  it('throws when profile and model id mismatch', () => {
    const profile = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    assert.throws(
      () => applyOutcomeDrift(profile, aiAgentModel, { outcome: 'risky_success' }),
      /modelId/,
    );
  });

  it('clamps trait values to [0, 1]', () => {
    const profile = { modelId: 'hexaco', traits: { ...hexacoModel.defaults, openness: 0.99 } };
    const next = applyOutcomeDrift(profile, hexacoModel, { outcome: 'risky_success' });
    assert.ok(next.traits.openness <= 1);
  });
});

describe('applyLeaderPull', () => {
  it('shifts agent toward leader by per-axis pull strength', () => {
    const agent = { modelId: 'hexaco', traits: { ...hexacoModel.defaults, openness: 0.2 } };
    const leader = { modelId: 'hexaco', traits: { ...hexacoModel.defaults, openness: 0.8 } };
    const next = applyLeaderPull(agent, hexacoModel, { leader });
    // pull = 0.06, gap = 0.6, delta = 0.036, new openness = 0.236
    assert.ok(Math.abs(next.traits.openness - 0.236) < 1e-9);
  });

  it('is a noop when leader is at the same trait value', () => {
    const agent = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    const leader = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    const next = applyLeaderPull(agent, hexacoModel, { leader });
    for (const axis of hexacoModel.axes) {
      assert.equal(next.traits[axis.id], 0.5, `axis ${axis.id} unchanged`);
    }
  });

  it('returns agent unchanged when leader uses a different model', () => {
    const agent = { modelId: 'ai-agent', traits: { ...aiAgentModel.defaults } };
    const leader = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    const next = applyLeaderPull(agent, aiAgentModel, { leader });
    assert.deepEqual(next, agent);
  });
});

describe('applyRoleActivation', () => {
  it('amplifies axis with positive sign', () => {
    const profile = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    const next = applyRoleActivation(profile, hexacoModel, { axisSigns: { conscientiousness: 1 } });
    // roleActivation conscientiousness = 0.03, so 0.5 + 0.03 = 0.53
    assert.ok(Math.abs(next.traits.conscientiousness - 0.53) < 1e-9);
  });

  it('depresses axis with negative sign', () => {
    const profile = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    const next = applyRoleActivation(profile, hexacoModel, { axisSigns: { extraversion: -1 } });
    // roleActivation extraversion = 0.02, so 0.5 - 0.02 = 0.48
    assert.ok(Math.abs(next.traits.extraversion - 0.48) < 1e-9);
  });

  it('leaves axes without sign unchanged', () => {
    const profile = { modelId: 'hexaco', traits: { ...hexacoModel.defaults } };
    const next = applyRoleActivation(profile, hexacoModel, { axisSigns: { openness: 1 } });
    for (const axis of hexacoModel.axes) {
      if (axis.id !== 'openness') {
        assert.equal(next.traits[axis.id], 0.5);
      }
    }
  });
});
