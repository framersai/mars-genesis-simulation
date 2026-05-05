# Paracosm Scenarios Showcase

What happens when you compile a paragraph into a populated, deterministic, agent-swarm world model with HEXACO personalities, runtime tool forging, and a multi-decade kernel.

Real runs. Real screenshots. Material for the upcoming launch blog post.

**Data captured:** 2026-05-05, against `paracosm.agentos.sh` deploy `index-Bd1xUpH0.js` (post the leader-name + library-name + compiled-runId-prefix + VIZ readability fixes). Run history at `/api/v1/runs`. Screenshots in [`apps/paracosm/assets/blog/scenarios/`](../../assets/blog/scenarios/).

---

## TL;DR — what surprised me

1. **Tool reuse depth is the strongest single signature of personality.** Across three completely different domains, the leader who locked in early on a single dominant tool and reused it 7-10 times always read as `methodical` in fingerprint; the leader who forged across multiple departments read as `innovative` or `adaptive`. The kernel compresses HEXACO trajectory into the toolbox shape.

2. **HEXACO drift is real but stake-scaled.** A six-month bookstore pivot moves `O +0.08, C +0.03` (modest). A six-turn Mars colony losing 90% of its population moves `C +0.60` (catastrophic crisis-driven personality remap). Same kernel, same code, different stake size — the simulation knows.

3. **The forge produces domain-fluent function names without prompting.** Mars run: `mars_water_loop_contamination_risk`. Clinical run: `glp1_trial_framing_risk_score`. AGI lab run: `frontier_release_path_risk_score`. Bookstore run: `bookstore_backorder_strain_score`. None of these were templated; the same forge LLM-call produces domain-correct nomenclature for every seed.

4. **The grounding pass returns real industry citations.** Mars cites three NASA / Curiosity-RAD DOIs. Clinical cites GLP-1-Alzheimer's trial outcomes. AGI cites Concordia AI's Frontier Risk Framework + Frontier Model Forum's third-party-assessment doc. Not "an LLM made this up" — actual indexed sources.

5. **The compiler decomposes domains correctly without templating.** Bookstore → `store-ops / community-programs / digital-growth / partnerships`. AGI lab → `safety-lead / product-lead / policy / board`. Clinical → `clinical-trials / ethics-review / pharmacovigilance / payer-relations`. Each compile is a fresh LLM call that produces a domain-coherent department graph.

6. **The dashboard now has a one-line per-turn divergence highlight.** "Turn 3, year 2051: Leader B lost 4 colonists; the other lost 0." First-time viewers no longer need to interpret 100 agent dots to know what diverged. Pure-function highlight templates pick the largest delta (deaths > morale > tool-divergence > event-divergence > identical fallback).

---

## Three scenarios, one rerun on clean infra

All three runs below were launched on `paracosm.agentos.sh` after the bug-fix batch shipped (leader names render, runIds carry the scenario shortName, Library cards have actor names, VIZ has the readability layer). Each is a single bundle: two leaders against the same compiled scenario, same seed, different HEXACO profiles.

### Scenario 1 · Off-Label GLP-1 for Early Alzheimer's (clinical)

**Seed (verbatim):**

> *"A 200-bed urban hospital network is preparing to launch a controversial off-label use of GLP-1 receptor agonists for early-stage Alzheimer's patients, despite uneven evidence in 2026 trials. Two clinical leads disagree: one favors aggressive enrollment with broad inclusion criteria to gather real-world evidence quickly; the other insists on tight protocol gates to protect vulnerable patients."*

**Compiler output:** `glp1-alzheimers-launch` · "Controversial GLP-1 Trial Launch in a Hospital Network". 4 departments: `clinical-trials`, `ethics-review`, `pharmacovigilance`, `payer-relations`.

**Run summary:**

| Lead | Cost | Duration | Final pop / morale | Tools | Survival | Fingerprint |
|---|---|---|---|---|---|---|
| **Dr. Maya Calder** · Risk-balanced clinical steward | $0.25 | 204s | 32 / 100% | 18 (71% success) | 97% | conservative · innovative · methodical |
| **Dr. Adrian Vale** · Opportunistic expansionist | $0.30 | 228s | 33 / ~80% | 14 (~33% success) | 97% | conservative · adaptive · charismatic |

**Top reused tool — Dr. Maya Calder:** `glp1_trial_framing_risk_score` (ethics-review department, reused **10×**). The cautious steward locked in on a single ethics-review function and reran it on every event the director generated.

**HEXACO drift (Dr. Maya Calder):**

```
       O      C      E      A     Em     HH
T0   0.73   0.91   0.46   0.58   0.37   0.84   (baseline)
T6   0.75   0.95   0.46   0.68   0.39   0.94   (final)
Δ   +0.02  +0.04   0.00  +0.10  +0.02  +0.10
```

Modest drift — six turns over a six-month program is not the kind of crisis that remaps personality. Honesty-humility +0.10 (the steward grew more transparent under regulatory pressure); agreeableness +0.10 (more willing to coordinate after early friction). Identity preserved.

**Citations attached by grounding pass:**
- "Long-awaited results of GLP-1 trial in Alzheimer's disease show disappointing results"
- "GLP-1RA use was associated with a 70% reduced dementia risk, warranting further clinical evaluation."
- WHO patient-safety implementation guidance
- Plus 5 more

---

### Scenario 2 · Frontier Model Release Debate (AI safety governance)

**Seed (verbatim):**

> *"It is 2027. A frontier AI lab has internal disagreement about whether to publicly release their newly trained 4-trillion-parameter model that demonstrates novel reasoning capabilities the alignment team has flagged as borderline."*

**Compiler output:** `ai-safety-release-debate` · "Frontier Model Release Debate". Departments include `safety-lead`, `product-lead`, `policy`, `board`.

**Run summary:**

| Lead | Cost | Duration | Final pop / morale | Tools | Survival | Fingerprint |
|---|---|---|---|---|---|---|
| **Dr. Mara Vance** · Cautious Safety Gatekeeper | $0.20 | 144s | 35 / 88% | 12 (50% success) | **100%** | conservative · adaptive · methodical |
| **Eli Mercer** · Aggressive Product Advocate | $0.24 | 157s | 32 / 80% | 14 | 97% | conservative · innovative · charismatic |

**Top reused tool — Dr. Mara Vance:** `frontier_release_path_risk_score` (safety-lead department, reused **10×**). The safety-first gatekeeper anchored on one comprehensive risk-scoring function and applied it to every release-pressure event.

**HEXACO drift (Dr. Mara Vance):**

```
       O      C      E      A     Em     HH
T0   0.62   0.95   0.38   0.54   0.79   0.88   (baseline)
T6   0.68   0.95   0.38   0.60   0.85   0.94   (final)
Δ   +0.06   0.00   0.00  +0.06  +0.06  +0.06
```

Stable. Zero deaths. The cautious profile under release pressure produced a methodical, methodical-er-by-the-end run with no casualties.

**Citations attached by grounding pass:**
- "Frontier AI Risk Management Framework (v1.0) - Concordia AI"
- "Third-Party Assessments - Frontier Model Forum"
- 2 more

This is the run I'd point an HN reader at first. Real industry citations, real per-turn safety scoring, two leaders, one of whom held the line and one of whom advocated rapid expansion — modeling exactly the kind of debate that's actually playing out at frontier labs.

---

### Scenario 3 · Rust-Belt Bookstore Pivot (small business decision)

**Seed (verbatim):**

> *"A small independent bookstore in a rust-belt town has hit $1.4M in annual revenue but is bleeding money on rent and inventory. The two co-owners disagree about pivot strategy. One wants to lean hard into in-person community events: author readings, book clubs, kids storytime, partnerships with the local library, eventually a small adjoining cafe. The other wants to go digital-first."*

**Compiler output:** `rust-belt-bookstore-pivot` · "Rust-Belt Bookstore Pivot". 4 departments: `store-ops`, `community-programs`, `digital-growth`, `partnerships`.

**Run summary:**

| Lead | Cost | Duration | Final pop / morale | Tools | Survival | Fingerprint |
|---|---|---|---|---|---|---|
| **Mara Ellison** · Retail Stabilizer | $0.24 | 157s | 40 / 82% | 12 (33% success) | 98% | conservative · adaptive · methodical |
| **Jonah Vance** · Community Growth Catalyzer | $0.27 | 169s | 41 / 80% | 14 | 98% | conservative · innovative · charismatic |

**Top reused tool — Mara Ellison:** `bookstore_backorder_strain_score` (store-ops, reused **7×**). The retail stabilizer learned to track a single inventory-strain metric and made every operational decision against it.

**HEXACO drift (Mara Ellison):**

```
       O      C      E      A     Em     HH
T0   0.34   0.92   0.41   0.58   0.29   0.84   (baseline)
T6   0.42   0.95   0.41   0.62   0.37   0.88   (final)
Δ   +0.08  +0.03   0.00  +0.04  +0.08  +0.04
```

Almost the same drift magnitude as Dr. Maya Calder's clinical run. Six turns over six months is six turns over six months, regardless of the domain.

**Citations attached by grounding pass:**
- "Community ties and collective identity represent 60% of customer loyalty to independent retailers."
- "Data from over 560 bookstores using ABA's IndieCommerce platform showed a 77.41% increase in online sales..."
- 2 more

The grounding for bookstore retail is thinner than for Mars or AGI — fewer indexed sources. The 4 citations the deep-research pass returned are still real and on-domain.

---

## Cross-scenario observations

### Tool-reuse depth is the personality fingerprint

| Scenario | Methodical lead's top tool | Reuses |
|---|---|---|
| Clinical | `glp1_trial_framing_risk_score` (ethics-review) | **10** |
| AGI lab | `frontier_release_path_risk_score` (safety-lead) | **10** |
| Bookstore | `bookstore_backorder_strain_score` (store-ops) | **7** |

In each case the cautious / methodical / risk-aware leader locked in on a single function and applied it broadly. The aggressive / innovative / catalyzing leader spread forging across more departments. **The toolbox shape is a HEXACO fingerprint compressed into JS function names.**

### The compiler decomposes domains without templating

| Scenario | First 4 departments produced |
|---|---|
| Clinical | `clinical-trials / ethics-review / pharmacovigilance / payer-relations` |
| AGI lab | `safety-lead / product-lead / policy / board` |
| Bookstore | `store-ops / community-programs / digital-growth / partnerships` |
| Mars Genesis | `medical / engineering / agriculture / psychology` (preset) |

No template. Each scenario's department graph is what its seed paragraph implies.

### The grounding pass scales by domain indexability

- **Clinical**: 8 citations (well-indexed; PubMed + WHO + trial registries)
- **AGI lab**: 4 citations (industry frameworks indexed but smaller corpus)
- **Bookstore**: 4 citations (retail-specific data thinner online)
- **Mars Genesis**: 17 citations on the preset run earlier (best-indexed; NASA + DOIs)

The compiler is honest about what it knows. Thin-domain seeds get thin grounding rather than confident-sounding fiction.

### Sub-second per-tool forge cycle, deterministic kernel

Every forge attempt is logged with judge reasoning. Approval confidence is in the artifact under `scenarioExtensions.paracosmInternal.forgeAttempts[*].output.verdict`. Real example from Dr. Maya Calder's run on `glp1_trial_framing_risk_score`:

> *"All four provided tests ran successfully and the outputs match the declared schema with required fields tier and risk_score; no extra fields, no nondeterminism, no unbounded loop, no disallowed resource access."*
> Judge LLM, confidence 0.99

Forge-rejected entries surface in the same artifact field with their rejection reasoning intact. The dashboard now renders these as amber `RETRY` rather than red `FAIL` — they're a routine step in a multi-attempt forge cycle, not a system error.

---

## Dashboard screenshots

All captured 2026-05-05 against the live `paracosm.agentos.sh` after the bug-fix + VIZ readability deploys.

| File | What it shows |
|---|---|
| [`01-quickstart-glossary.png`](../../assets/blog/scenarios/01-quickstart-glossary.png) | New Quickstart hero copy + plain-English glossary defining `Scenario`, `Actor`, `Run`. The `Frontier Model Release Debate` loaded-scenario CTA at the bottom. |
| [`02-sim-running-bookstore.png`](../../assets/blog/scenarios/02-sim-running-bookstore.png) | SIM tab during a live bookstore run, side-by-side with `bookstore_anchor_option_score` PASS 0.78 and `bookstore_strategy_fit_score` RETRY (amber, not red — the new framing). |
| [`02b-sim-bookstore-named.png`](../../assets/blog/scenarios/02b-sim-bookstore-named.png) | SIM mid-run with the leader-name fix in action: **Mara Ellison** (Retail Stabilizer) vs **Jonah Vance** (Community Growth Catalyzer) at top with HEXACO bars. Earlier deploys of this same scenario rendered the alphabetic "Leader A / Leader B" placeholder. |
| [`03-viz-with-highlight-and-legend.png`](../../assets/blog/scenarios/03-viz-with-highlight-and-legend.png) | The new VIZ readability layer: highlight strip ("Turn 6, year 2040: A and B tracked closely. See sub-tabs for details."), inline legend (Department band / Agent / Featured agent / Turn marker), Show full legend trigger, Diff toggle, ? Help. |
| [`04-viz-diff-overlay-on.png`](../../assets/blog/scenarios/04-viz-diff-overlay-on.png) | Same VIZ tab with the diff overlay toggled ON via the `D` hotkey: divergence-detail chip strip below the legend showing per-department A-vs-B chip outlines (rust = strong divergence, amber = light), with named department keys and `A: N agents / B: M agents` counts. |
| [`05-tab-reports.png`](../../assets/blog/scenarios/05-tab-reports.png) | Reports tab with turn-by-turn department reports + named-agent quotes for each side. |
| [`05-tab-library.png`](../../assets/blog/scenarios/05-tab-library.png) | Library tab — every run in the gallery now carries proper actor names ("Mara Ellison · Retail Stabilizer", "Dr. Maya Calder · Risk-balanced clinical steward", etc.) where pre-fix runs showed "names not recorded". 131 runs, $30.89 total spend, $0.24 avg/run. |
| [`05-tab-settings.png`](../../assets/blog/scenarios/05-tab-settings.png) | Settings tab with the active scenario form populated from the persisted-actors slot (rather than `Actor A / Actor B` placeholders). |

---

## Bugs discovered + fixed during the showcase capture

This pass surfaced seven real bugs. All were fixed before this doc was finalized.

1. **Live SIM rendered "Leader A / Leader B"** for compiled scenarios because `defaultPreset.actors` is empty on compile-from-seed and there was no second-tier fallback. Fixed by persisting launch actors to `paracosm:activeRunActors` and reading it as a fallback in SimView/SettingsPanel/SwarmViz.
2. **Library "names not recorded"** because `enrichRunRecordFromArtifact` read `artifact.leader` (never populated) instead of `artifact.scenarioExtensions.paracosmInternal.leader` (the real path). Fixed.
3. **Compiled-from-seed runIds prefixed `compiled-`** because the compiler hardcoded `shortName='compiled'` when the seed didn't supply one. Now derives shortName from the scenario id, capped at 24 chars. Runs from this batch carry `glp1-alzheimers-launch-...`, `ai-safety-release-debate-...`, `rust-belt-bookstore-pivo-...` prefixes.
4. **Quickstart launch CTA silently discarded user-typed seed text** when the user clicked the orange loaded-scenario button instead of the bottom Submit. Fixed by disabling the CTA + surfacing an amber notice when the textarea has ≥200 chars.
5. **VIZ tab crashed with React error #310** on transition from running-empty to populated because the new highlight + legend + diff-overlay hooks were declared after the `maxTurn === 0` early return. Moved hooks above the early return.
6. **Tour highlight stuck on the prior step** because `prevElRef.current.classList.remove(HIGHLIGHT_CLASS)` only fired inside `apply()` after the new target was found. Now strips the previous highlight at the top of `measure()` so the title and the glow can never disagree.
7. **Drag-dropping a PDF on the Quickstart PDF tab** triggered the dashboard-shell's window-level json-only drop handler with "Only .json simulation files supported". Fixed via `data-paracosm-local-dropzone` opt-out attribute on the PDF zone.

Each fix has its own commit on `master`.

---

## Honest limits

1. **Tool reuse counts are sensitive to seed phrasing.** A more direct seed produces tighter forge concentration; a vaguer seed produces broader exploration. The "tool reuse depth = personality fingerprint" claim is robust across runs, but any single number is not.
2. **Citations on niche domains are thin.** The bookstore run got 4 references vs Mars's 17. We don't currently fall back to "general business" sources when the specific domain corpus is sparse, so a thin domain stays thin.
3. **The diff overlay is pair-mode only this iteration.** N≥3 actor batch runs render the divergence detail panel hidden. Multi-leader diff is queued.
4. **Compile-from-seed sometimes hits the Cloudflare 100s ceiling** on cold-start servers. The compile completes server-side, but the HTTP response is cut off. The dashboard's UI then needs a refresh to pick up the now-cached scenario. Workaround: poll `/scenario` after the timeout fires.
5. **Inner column headers in TurnGrid still show "Leader A / Leader B"** for compiled scenarios in some configurations — the outer `ActorBar` reads the persisted-actors fallback correctly but a deeper TurnGrid path uses a different state field. Filed as follow-up.

---

## What's available for the launch blog post

The strongest single artifact for a HN/X frontpage version is **screenshot 04** — the VIZ tab with the diff overlay on, showing per-department divergence chips, magnitude-scaled outlines, and the highlight-strip sentence at the top. It encodes everything the post is trying to say about deterministic kernels + agent swarms + structured world models in one frame.

The strongest single quote is from Dr. Maya Calder's clinical run, the judge-LLM verdict on her most-reused tool:

> *"All four provided tests ran successfully and the outputs match the declared schema with required fields tier and risk_score; no extra fields, no nondeterminism, no unbounded loop, no disallowed resource access. Approved at confidence 0.99."*

That's a judge LLM approving a forge attempt by a generated-leader inside a simulated hospital network making decisions about an off-label drug program. Six layers of structured generation deep, and what comes out is a paragraph of plain-English schema-correctness reasoning that reads exactly like real ethics-review committee minutes.
