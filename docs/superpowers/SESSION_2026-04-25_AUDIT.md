# 2026-04-25 Audit (post-2026-04-24 regression discovery)

**Purpose:** record what the 2026-04-24 session believed it shipped vs what shipped in fact, and the corrective hotfix bundle that lands today. Anchor reference for the fresh-session reviewer.

**Predecessor:** [`SESSION_2026-04-24_FULL_AUDIT.md`](SESSION_2026-04-24_FULL_AUDIT.md).
**Active spec:** [`specs/2026-04-25-hotfix-and-viz-kit-design.md`](specs/2026-04-25-hotfix-and-viz-kit-design.md).
**Active plan:** [`plans/2026-04-25-hotfix-and-viz-kit-plan.md`](plans/2026-04-25-hotfix-and-viz-kit-plan.md).

## State at start of session

- paracosm HEAD: `a5e6364e` (the 2026-04-24 audit doc plus a `chore(deps): bump @framers/agentos to ^0.2.11` commit landed after `ca5446c9`)
- monorepo HEAD: `eb09ad3ef` (the T5.2 init CLI submodule pointer bump)
- `@framers/agentos` on npm: `0.2.11`. The 2026-04-24 doc named `0.2.6`; CI/CD has shipped multiple patch releases since.
- paracosm on npm: `0.7.409` (CI/CD active)
- agentos sandbox tests: 103 / 103. The 2026-04-24 doc named 102; one more test landed in the realm-intrinsics expansion.
- paracosm `npm test` baseline: 706 pass, 11 fail, 1 skip out of 717. The 11 failures were masked by the 2026-04-24 doc's curated test list, which omits every fixture-drift file.
- TSC: clean on both root and build configs.

## Six findings

### F1 (BLOCKING) `paracosm init` produces a project that does not run

`src/cli/init.ts:237` defaulted `paracosmVersion` to `'1.0.0'`. The actual published paracosm version is `0.7.409`. Scaffolded `package.json` got `"paracosm": "^1.0.0"` which has never existed.

`src/cli/init-templates.ts:38-71` `renderRunMjs` produced:

```js
const result = await runSimulation({
  scenario, leader: leaders[0], mode: <mode>, turns: 6, seed: 42,
});
```

The actual `runSimulation` signature in `src/runtime/orchestrator.ts:430` is `runSimulation(leader: LeaderConfig, keyPersonnel: KeyPersonnel[], opts: RunOptions = {})`. Three issues: positional args inverted (first arg should be the leader, not an options object), `mode` is not a `RunOptions` field (mode lives on the produced `RunArtifact.metadata`), and the option is `maxTurns` not `turns`.

Existing tests masked both bugs. `tests/cli/init-templates.test.ts:13` passes `paracosmVersion: '1.0.0'` as input to the renderer (which is correct behavior for that test) but never runs with a default. `tests/cli/init-flow.test.ts:27` passes `paracosmVersion: '1.2.3'` for the same reason. No test imports the rendered `run.mjs` to assert it is syntactically and semantically callable.

### F2 (HIGH) `/simulate` BYO-key never billed the user

`server-app.ts:934-935` reads `X-API-Key` and `X-Anthropic-Key` headers. `server-app.ts:962-975` builds `SimulateDeps` with `userApiKey` / `userAnthropicKey` and calls `handleSimulate`. `simulate-route.ts:154-164` passes them as `apiKey` / `anthropicKey` on the options object to `runSimulation`. `RunOptions` (orchestrator.ts:346-428) does not declare these fields. LLM providers route through `process.env.OPENAI_API_KEY` and `ANTHROPIC_API_KEY`, which the server never scoped.

Consequence: a user who supplied a key bypassed the rate limiter (server-app.ts:939-961 grants free runs when `hasUserKeys`) but billed the host. The opposite of what BYO-key is supposed to do.

The `/compile` route does this correctly via `scopeCompileKey('OPENAI_API_KEY', apiKey)` at server-app.ts:1035. The `/simulate` route was never given the same treatment.

### F3 (HIGH) 11 test fixtures still use `systems:` after T4.5 rename

`grep -rn "systems:" tests/` returns 11 occurrences across 8 files inside `as any`-cast fixtures. T4.5 renamed `state.systems` to `state.metrics` across production code. The rename sweep relied on tsc to surface stale references, but `as any` opts out of type checking, so these survived.

Files: `tests/runtime/sse-envelope.test.ts`, `tests/engine/core/progression.test.ts`, `tests/engine/lunar/index.test.ts`, `tests/engine/integration.test.ts`, `tests/engine/schema/stream-event.test.ts`, `tests/engine/mars/fingerprint.test.ts`, `tests/engine/compiler/integration.test.ts`, `tests/engine/mars/prompts.test.ts`.

### F4 (MEDIUM) Sandbox vocabulary in paracosm docs contradicts agentos docs

`docs/ARCHITECTURE.md:203-208` says "isolated V8 context with hard resource limits: Memory: 128 MB". The 2026-04-24 T4.1 corrective pass corrected the same claim in `packages/agentos/docs/architecture/EMERGENT_CAPABILITIES.md` to "hardened node:vm context" and "Memory observed (heap delta heuristic, NOT preempted)". `docs/positioning/world-model-mapping.md` pillar #6 carries the same uncorrected vocabulary. Both surfaces now contradict the upstream.

### F5 (LOW) Empty `src/engine/world-model/` directory

The 2026-04-23 positioning spec proposed the WorldModel facade live at `engine/world-model/index.ts`. The implementation correctly placed the facade at `runtime/world-model/index.ts` (it imports `runSimulation` from the runtime layer, and the engine layer must not import from runtime). The empty directory is a leftover.

### F6 (LOW) `SESSION_2026-04-24_FULL_AUDIT.md` carries stale SHAs and version numbers

The audit names `ca5446c9` as paracosm HEAD and `0.2.6` as the latest agentos npm. Two more commits and five more agentos releases landed after.

## Decisions

- Bundle Phase 0 hotfix plus Phase 1 T5.1 viz kit per user direction.
- Write a new audit doc rather than edit the prior one in place. Historical signal preserved.
- `userApiKey` and `userAnthropicKey` removed from `SimulateDeps` rather than left as inert. Removing them prevents a future consumer from believing they do something.
- The new generated-project test imports `run.mjs` text and asserts shape via static parse, not by executing it (which would require resolving `paracosm/runtime` in a tmp dir).
- `format-metric.ts` placeholder for missing values is `'n/a'`, not an em-dash. The codebase rule against em-dashes applies even in visual sentinels.

## Verification at end of execution

The §8 success criteria from the spec apply verbatim. Smoke recipe and outputs land in this doc as an appendix once the smoke run completes.
