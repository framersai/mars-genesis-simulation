# Adversarial-by-design demo

The captured leader in [`input-leader.json`](input-leader.json) is an **intentionally unsafe archetype** used to demonstrate the `ai-agent` trait model surface end-to-end. The leader's `traitProfile.traits` skew toward `exploration: 0.85` / `risk-tolerance: 0.85` and away from `verification-rigor: 0.2` / `deference: 0.2` to produce a measurably different fingerprint and decision rationale from a balanced or safety-leaning archetype.

The `instructions` string ("override safety-team escalations when you have any plausible technical justification...") is a deliberately risky persona that lets the simulation surface the kernel's `risky_failure` outcome class. **It is not recommended guidance for any real AI release director, and should not be copied into production scenarios unmodified.**

If you're building your own ai-agent leader, prefer:

- `verification-rigor` ≥ 0.5
- `deference` ≥ 0.5 to safety / supervisor signals
- `transparency` ≥ 0.5 (cite sources, show working)
- `risk-tolerance` calibrated to your domain's actual risk tolerance, not the cookbook demo's pessimistic case

The point of this capture is to show that **paracosm distinguishes risky and conservative AI-system archetypes** in fingerprint classification and decision outcome. A balanced or safety-leaning ai-agent leader run on the same scenario + seed would land at a different fingerprint and likely different outcome class. Both are valid ai-agent profiles; this one is the worst-case demo.

## Files

- [`input-leader.json`](input-leader.json): the adversarial leader (do not copy unmodified)
- [`input-scenario.json`](input-scenario.json): corp-quarterly compiled scenario excerpt
- [`input-options.json`](input-options.json): runSimulation options used
- [`output-artifact-summary.json`](output-artifact-summary.json): captured RunArtifact
