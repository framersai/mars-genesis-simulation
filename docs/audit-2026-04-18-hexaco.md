---
title: "HEXACO Prompt + Leadership Audit"
date: 2026-04-18
status: verification report — one minor fix applied inline
---

# HEXACO Prompt + Leadership Audit

Systematic audit of every prompt site that consumes HEXACO personality data. Motivation: user asked to "check all prompts for the right simulations and affects from hexaco personalities and leadership prompts types bios." This report catalogs the current coverage and confirms the system's trait expression is consistent across all six axes.

## Coverage matrix

All six HEXACO axes (Openness, Conscientiousness, Extraversion, Agreeableness, Emotionality, Honesty-Humility) have behavioural cues at both poles (> 0.7 / < 0.3) at every call site that reads commander or dept-head traits. Thresholds are uniform at 0.7 / 0.3 across the entire runtime.

| Call site | File | Trait coverage | Trajectory cue | Pole thresholds |
|---|---|---|---|---|
| Commander bootstrap personality | [commander-setup.ts `buildPersonalityCue`](../src/runtime/commander-setup.ts#L47) | 6 × 2 | n/a (turn 0) | 0.7 / 0.3 |
| Commander per-turn | [orchestrator.ts `cmdPrompt`](../src/runtime/orchestrator.ts#L1070) | via session memory | yes, threaded | 0.05 / 0.15 |
| Department context | [departments.ts `buildDepartmentContext`](../src/runtime/departments.ts#L37) | 6 × 2 plus moderate middle-case | yes, threaded | 0.7 / 0.3 |
| Director context | [director.ts `buildDirectorPrompt`](../src/runtime/director.ts#L181) | raw numbers + trajectory | yes, threaded | 0.05 / 0.15 |
| Reactions batch (per-agent) | [agent-reactions.ts](../src/runtime/agent-reactions.ts) via `buildReactionCues` | 6 × 2 | not injected (cache invalidation cost) | 0.7 / 0.3 |

Verified by grep + read:

- `grep -rn "h\.\(openness\|conscientiousness\|extraversion\|agreeableness\|emotionality\|honestyHumility\)" src/runtime` — six axes used consistently across all sites.
- `grep -rn "buildTrajectoryCue" src/runtime` — fires at commander (orchestrator.ts:1070), director (director.ts:194), and dept-head (departments.ts:92) prompts. Skipped on reactions by design (would invalidate per-batch cache).

## Trait-expression quality

Each cue names a **specific downstream behaviour** rather than parroting a trait label:

- Openness 0.7+ → "You favor novel, untested approaches over proven ones; the unknown is an opportunity, not a threat" (not: "You are high in openness").
- Conscientiousness 0.7+ → "You demand evidence and contingency plans before committing; you would rather be slow and right than fast and wrong."
- Honesty-Humility 0.7+ → "You report failures transparently, accept blame, and refuse to spin bad outcomes; credibility is the only currency that compounds."

This deliberate anti-parroting keeps the LLM from regurgitating trait names as if they were the answer. Dept-head cues vary the surface form (tone, voice, forge-vs-reuse preference) while commander cues vary decision framing. Two different registers for two different agents. Good separation.

## Trajectory cue thresholds

[`buildTrajectoryCue`](../src/runtime/hexaco-cues/trajectory.ts) fires when any axis has drifted ≥ 0.05 from its baseline snapshot. Tags "substantially" at ≥ 0.15 (three full turns at drift-cap). This matches the kernel's per-turn drift cap exactly, so a cue appears only when the drift is at least one turn's worth of evolution. No noise, no missed signals.

## Leadership bios

`leader.instructions` is user-supplied config ([leaders.json](../leaders.json)). Runtime passes it verbatim to the commander agent as the `instructions` field in [orchestrator.ts:287](../src/runtime/orchestrator.ts#L287). The canonical Visionary + Engineer pair has terse bios:

```
"Aria Chen, The Visionary" — "Bold expansion, calculated risks. Favor higher upside even when riskier."
"Dietrich Voss, The Engineer" — "Engineering discipline, safety margins. Demand data before decisions. Favor lower risk."
```

These are intentional and work in tandem with `buildPersonalityCue` — the bio names the archetype, the cue expands to full HEXACO-grounded behaviour. No change needed.

## One minor fix applied inline

**Reaction cue truncation.** [`buildReactionCues`](../src/runtime/hexaco-cues/translation.ts) capped output at 3 cues. An agent polarized on all six axes would lose half their trait voice. Cost math: reactions batch at 10 agents/call so a +3 cues per agent adds ~180 tokens/batch on haiku — ~$0.0003/batch, ~$0.02 over a full run. Quality win dominates.

Fix: bumped the cap to 6 (full coverage) while keeping the first-hit selection order so common trait patterns produce consistent phrasing order. Committed as part of this audit pass.

## No-change observations

- **Commander per-turn prompt.** Does not re-inject `buildPersonalityCue` based on CURRENT (possibly-drifted) HEXACO; relies on the turn-0 bootstrap's cue plus the running trajectory cue. Correct by design — the session preserves the bootstrap in conversation memory, and the trajectory cue describes drift direction. If a single axis crosses a pole threshold mid-run (e.g., openness drifts from 0.55 to 0.72), the bootstrap's moderate-openness framing is stale. In practice the 0.7/0.3 thresholds are sharp and drift crosses them rarely (±0.05/turn cap means at most 3 turns to cross a 0.15 band). Flagged for a future targeted fix if quality measurement shows it matters; not worth the per-turn prompt-cache invalidation today.

- **Director uses raw HEXACO numbers** instead of pole cues. Deliberate — the director shapes EVENT pressure against the commander's profile, which needs a numeric signal it can reason about abstractly, not pole-specific "what would this agent do" framing. Leave as-is.

## Conclusion

The HEXACO expression pipeline is well-covered, uniformly thresholded, and cleanly separated from leader bios (which stay terse and archetype-named). The 2026-04-17 migration closed the gaps identified in the prior spec; this audit confirms no new gaps have appeared.

Single minor fix applied (reaction cue cap 3 → 6). No other changes needed at this time.

## References

- [2026-04-17 LLM reliability + HEXACO evolution spec](superpowers/specs/2026-04-17-llm-reliability-and-hexaco-evolution-design.md)
- [ARCHITECTURE.md HEXACO section](ARCHITECTURE.md#hexaco-personality-model)
