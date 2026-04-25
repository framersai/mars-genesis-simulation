# Replay endpoint + Library verification loop closure

**Authored:** 2026-04-26.
**Author:** Library tab finishing pass.
**Supersedes:** none. **Paired plan:** `docs/superpowers/plans/2026-04-26-replay-endpoint-and-verification-loop-plan.md` (next).

---

## §1. Problem

The Library tab ships in commit `5ea29fec` with an end-to-end UX flow that is not actually end-to-end. The Replay button in the run-detail drawer dispatches `useReplayRun`, which posts to `POST /api/v1/runs/:runId/replay`. That endpoint does not exist. The hook gracefully reports "endpoint not yet available; coming in a follow-up release" and the panel renders that string. The 2026-04-25 handoff lists this as the P0 follow-up and is correct.

Two adjacent gaps surface from the same investigation:

1. The dashboard subpackage (`src/cli/dashboard`) is excluded from the root `tsc --noEmit` pass that `npm test` runs. Off-by-one relative imports across the dashboard ↔ engine boundary type-check cleanly under the dashboard's own `tsconfig.json` (which only sees the dashboard tree) but fail at vite build time. Six such imports leaked into `5ea29fec` and were caught only when CI ran the dashboard build, requiring a hot fix.
2. The dashboard subpackage's `package-lock.json` was authored from inside the parent voice-chat-assistant pnpm workspace, so npm wrote sixteen relative paths to the parent `../../../../../node_modules/.pnpm/...` directory instead of self-contained entries. CI checks paracosm out standalone, so those paths do not exist; `npm ci` partially-installed and left vite missing, which caused `npx vite build` to fall back to fetching the latest vite (8.x) and crash on the v6-shaped config. This was repaired in commit `9ec24075` by regenerating the lockfile in isolation, but no regression guard exists.

## §2. Goals

1. `POST /api/v1/runs/:runId/replay` returns `{ matches: boolean, divergence: string }` for runs whose stored artifact has the replay preconditions, and a typed structured error otherwise.
2. The endpoint persists the outcome via `runHistoryStore.recordReplayResult(runId, matches)` so the `replaysAttempted` and `replaysMatched` counters surfaced through `/api/v1/runs/aggregate` update on every replay.
3. The Library tab Replay button works end to end against a populated `runs.db` with no client-side change.
4. `npm test` from the paracosm root fails when `src/cli/dashboard/src/**/*.{ts,tsx}` has a type error, including off-by-one cross-package relative imports.
5. The CI build job hard-fails when either `package-lock.json` or `src/cli/dashboard/package-lock.json` contains the substring `node_modules/.pnpm/`, preventing the regression class that produced the failing commit.

## §3. Out of scope

- Replaying recorded decisions through `kernel.applyPolicy()`. The 2026-04-25 replay v1 spec deferred this; v1 is a kernel-progression-hook re-execution and the artifact does not preserve the department-report shape that `decisionToPolicy()` requires. A separate spec adds policy replay once department reports are normalized into a replay-ready shape.
- Reconstructing a `ScenarioPackage` from the artifact when the catalog does not have it. The endpoint returns `410 scenario_unavailable` and the dashboard surfaces the message.
- Streaming replay progress to the client. Replay on a 100-agent / 20-turn artifact runs in well under the default HTTP timeout; a future streaming variant can layer onto the same endpoint.
- The T6.1 fast-check kernel-reproducibility property test, T6.3 / T6.4 mars and lunar real-LLM smoke scripts, and T7.x ecosystem adapters. Each warrants its own spec.
- Changes to `useReplayRun.ts`. The hook already targets `POST /api/v1/runs/:runId/replay` and consumes `{ matches, divergence }`, the exact shape this spec produces.
- Changes to the dashboard's own tsconfig. The fix in §4.5 calls `tsc -p src/cli/dashboard` from a new root-level `typecheck:dashboard` script, leaving the dashboard's tsconfig unmodified (its existing `noEmit: true` is what makes `--noEmit` redundant on the new script).

## §4. Implementation

### §4.1 Extend `HandlePlatformApiOptions`

`src/cli/server/routes/platform-api.ts` currently accepts three options. Add a fourth:

```ts
export interface HandlePlatformApiOptions {
  runHistoryStore: RunHistoryStore;
  corsHeaders: Record<string, string>;
  paracosmRoutesEnabled: boolean;
  /**
   * Resolves a scenarioId to its compiled ScenarioPackage. The route
   * handler uses this to construct a WorldModel for replay. Returns
   * undefined when the id is not in the catalog (built-in or custom).
   * Wired by server-app.ts as `(id) => customScenarioCatalog.get(id)?.scenario`.
   */
  scenarioLookup: (scenarioId: string) => ScenarioPackage | undefined;
}
```

Add `import type { ScenarioPackage } from '../../../engine/types.js';` at the top of the file.

This is a required (non-optional) field. Search confirms `handlePlatformApiRoute` has exactly one in-tree caller (`src/cli/server-app.ts:824`) and one test fixture group (`tests/cli/platform-api-runs.test.ts`'s `ENABLED` constant). Both are updated in this spec.

### §4.2 Route handler

Insert immediately after the existing `/replay-result` block (`platform-api.ts:118-145` on master, currently being hardened by a concurrent session) and before the generic `:runId` GET (`:147+`). Order matters: the replay regex must precede the catch-all detail regex so the latter does not consume the request first. The handler mirrors the conservative-error-response pattern that the concurrent hardening of the detail GET is moving towards (passing `runId` in error bodies, not the full `record`, to avoid leaking sourceMode / leaderConfigHash / cost data through error paths).

```ts
// POST /api/v1/runs/:runId/replay — re-execute kernel progression
// against the stored artifact and report match/divergence. The
// outcome is persisted to the run-history store so the
// /api/v1/runs/aggregate counters reflect every attempt.
const replayMatch = url.pathname.match(/^\/api\/v1\/runs\/([^/]+)\/replay$/);
if (replayMatch && req.method === 'POST') {
  const runId = decodeURIComponent(replayMatch[1]);
  const record = await options.runHistoryStore.getRun(runId);
  if (!record) {
    res.writeHead(404, { 'Content-Type': 'application/json', ...options.corsHeaders });
    res.end(JSON.stringify({ error: 'not_found', runId }));
    return true;
  }
  if (!record.artifactPath) {
    res.writeHead(410, { 'Content-Type': 'application/json', ...options.corsHeaders });
    res.end(JSON.stringify({ error: 'artifact_unavailable', runId }));
    return true;
  }

  let artifact: RunArtifact;
  try {
    const fs = await import('node:fs/promises');
    artifact = JSON.parse(await fs.readFile(record.artifactPath, 'utf-8')) as RunArtifact;
  } catch {
    console.warn('[run-history] artifact unreadable for replay:', runId);
    res.writeHead(410, { 'Content-Type': 'application/json', ...options.corsHeaders });
    res.end(JSON.stringify({ error: 'artifact_unreadable', runId, message: 'Artifact file unreadable' }));
    return true;
  }

  const scenarioId = artifact.metadata.scenario.id;
  const scenario = options.scenarioLookup(scenarioId);
  if (!scenario) {
    res.writeHead(410, { 'Content-Type': 'application/json', ...options.corsHeaders });
    res.end(JSON.stringify({ error: 'scenario_unavailable', scenarioId }));
    return true;
  }

  try {
    const wm = WorldModel.fromScenario(scenario);
    const result = await wm.replay(artifact);
    await options.runHistoryStore.recordReplayResult?.(runId, result.matches);
    res.writeHead(200, { 'Content-Type': 'application/json', ...options.corsHeaders });
    res.end(JSON.stringify({ matches: result.matches, divergence: result.divergence }));
    return true;
  } catch (err) {
    if (err instanceof WorldModelReplayError) {
      res.writeHead(422, { 'Content-Type': 'application/json', ...options.corsHeaders });
      res.end(JSON.stringify({ error: 'replay_preconditions_unmet', message: err.message }));
      return true;
    }
    throw err; // outer catch responds 500
  }
}
```

Imports added at the top of `platform-api.ts`:

```ts
import { WorldModel, WorldModelReplayError } from '../../../runtime/world-model/index.js';
import type { RunArtifact } from '../../../engine/schema/index.js';
import type { ScenarioPackage } from '../../../engine/types.js';
```

These are server-side imports. The runtime layer pulls in `@framers/agentos` and its node-only deps (`irc-framework`, `node:crypto`, `node:fs/promises`, `http`); that is fine in a Node.js HTTP route. The dashboard cannot import the runtime layer because vite cannot bundle those deps for the browser. This asymmetry is documented in the 2026-04-25 handoff §9 gotcha 2.

**Concurrent-session note.** At spec-authoring time, `platform-api.ts` has uncommitted modifications from another session that harden the existing `/replay-result` and detail GET to use `runId` rather than `record` in error bodies, add an `invalid_json` catch around the body parse, and add a 404 path for missing records. The new route in this spec already mirrors that pattern. When the concurrent session lands, the line numbers in §4.2 / §4.4 shift by ~13 lines but the insertion points (after `/replay-result`, before the `:runId` detail GET) are unchanged.

### §4.3 Failure mode → status mapping

| Condition | Status | Body |
|---|---|---|
| record not found | 404 | `{ "error": "not_found", "runId": "<id>" }` |
| `record.artifactPath` missing | 410 | `{ "error": "artifact_unavailable", "runId": "<id>" }` |
| artifact file unreadable on disk | 410 | `{ "error": "artifact_unreadable", "runId": "<id>", "message": "Artifact file unreadable" }` (also `console.warn` server-side with the runId for ops triage) |
| scenario not in catalog | 410 | `{ "error": "scenario_unavailable", "scenarioId": "<id>" }` |
| `WorldModelReplayError` (preconditions unmet) | 422 | `{ "error": "replay_preconditions_unmet", "message": "<err>" }` |
| any other thrown error | 500 | (outer try/catch in `handlePlatformApiRoute` returns `{ error: String(error) }`) |
| match success | 200 | `{ "matches": true, "divergence": "" }` |
| match diverged | 200 | `{ "matches": false, "divergence": "/<path>" }` |

The 410 cluster matches the conservative error-response pattern in the (concurrently-hardened) detail GET: pass `runId` only, not the full `record`. The 422 status semantically signals that the request is well-formed and the resource exists, but the resource is not in a state that permits the requested operation; this is the conventional choice for replay-preconditions-unmet.

### §4.4 Wire from `server-app.ts`

At `src/cli/server-app.ts:820-824` the platform-api dispatch already passes three options. Extend to four:

```ts
if (await handlePlatformApiRoute(req, res, {
  runHistoryStore,
  corsHeaders,
  paracosmRoutesEnabled,
  scenarioLookup: (id) => customScenarioCatalog.get(id)?.scenario,
})) {
  return;
}
```

`customScenarioCatalog` is declared at `server-app.ts:380` and seeded at `:381-382` with `marsScenario` and `lunarScenario`, plus any user-imported scenarios that arrive via `/scenario/store` (`:937-963`) or compile (`:1251`). The lookup closure captures it by reference; new scenarios registered after server start are immediately visible to replay.

### §4.5 Dashboard tsc parity

The dashboard's own `tsconfig.json` (`src/cli/dashboard/tsconfig.json`) already has the right settings (`"include": ["src"]`, `"noEmit": true`, `"moduleResolution": "bundler"`, `"jsx": "react-jsx"`). What is missing is a root-level invocation that runs it as part of `npm test`.

`apps/paracosm/package.json` change:

```json
"typecheck:dashboard": "tsc -p src/cli/dashboard",
"test": "npm run typecheck:dashboard && node --import tsx --import ./scripts/test-css-stub.mjs --test 'tests/**/*.test.ts' 'src/cli/dashboard/src/**/*.test.ts' 'src/cli/dashboard/src/**/*.test.tsx'"
```

The `--test` glob list is preserved verbatim from the current `test` script (`package.json:74`); the only change is the `npm run typecheck:dashboard &&` prefix. `--noEmit` is omitted from the new script because the dashboard's tsconfig already sets `noEmit: true`.

Cross-package imports (e.g. `import type { RunArtifact } from '../../../../../engine/schema/index.js'`) are validated by tsc's module resolution against the dashboard's `tsconfig.json`, which uses `"moduleResolution": "bundler"` matching vite's resolver. This catches the bug class that produced today's `5ea29fec` hot fix.

### §4.6 CI lockfile-contamination guard

`apps/paracosm/.github/workflows/deploy.yml:55-76` already has a "Verify lockfiles are in sync with package.json" step that emits warn-only annotations for platform-specific drift. Add a separate hard-fail guard after that block, before "Install dependencies" (line 78), that fails the build if either lockfile contains `node_modules/.pnpm/`:

```yaml
- name: Guard against pnpm-workspace contamination in lockfiles
  run: |
    set -e
    fail=0
    for f in package-lock.json src/cli/dashboard/package-lock.json; do
      if [ ! -f "$f" ]; then continue; fi
      if grep -q 'node_modules/\.pnpm/' "$f"; then
        echo "::error file=$f::Lockfile contains 'node_modules/.pnpm/' substring. This means it was authored from inside a pnpm workspace and references parent paths that do not exist in CI. To repair: copy package.json to a directory outside any pnpm workspace, run 'npm install' there, copy the resulting package-lock.json back, commit, push."
        fail=1
      fi
    done
    exit $fail
```

The guard runs before `npm ci` so the contaminated state cannot waste a build slot. The pattern matches the exact contamination signature (`node_modules/.pnpm/`) rather than a bare `.pnpm/` to eliminate any false-positive risk from a registry URL or comment that happened to contain the substring.

### §4.7 Tests

`tests/cli/platform-api-runs.test.ts` (append at end of file). The fixtures from `tests/runtime/world-model/replay.test.ts` (`captureSnapshots`, `syntheticArtifact`) are copied verbatim because they are scenario-agnostic helpers; no shared-fixture extraction in this spec.

Test list (seven cases):

1. **`POST /replay returns 200 + matches=true on equal-snapshot replay.`** Insert a run record into `:memory:` SQLite. Write a synthetic artifact (mars scenario, three turns of captured snapshots) to a temp file. POST to the endpoint with `scenarioLookup: () => marsScenario`. Assert status 200, `body.matches === true`, `body.divergence === ''`.

2. **`POST /replay returns 200 + matches=false with divergence on tampered snapshots.`** Same setup as test 1, but mutate `snapshots[2].state.metrics.morale` before writing the artifact. Assert status 200, `body.matches === false`, `body.divergence` is non-empty and starts with `/`.

3. **`POST /replay returns 404 for unknown runId.`** No record inserted. Assert status 404, body matches `{ error: 'not_found', runId: '<id>' }`.

4. **`POST /replay returns 410 when artifactPath is missing.`** Insert a record with `artifactPath: undefined`. Assert status 410, `body.error === 'artifact_unavailable'`, `body.runId === '<id>'` (no full record leakage).

5. **`POST /replay returns 410 when scenario not in catalog.`** Insert record + artifact pointing at an unregistered scenario id. Use `scenarioLookup: () => undefined`. Assert status 410, `body.error === 'scenario_unavailable'`, `body.scenarioId === '<id>'`.

6. **`POST /replay returns 422 when artifact missing kernelSnapshotsPerTurn.`** Insert record + artifact with `decisions: []`, `scenarioExtensions: {}`. Assert status 422, `body.error === 'replay_preconditions_unmet'`, `body.message` mentions `per-turn kernel snapshots`.

7. **`POST /replay calls recordReplayResult once per attempt with the right argument.`** Use a stub run-history store wrapping the SQLite one and counting `recordReplayResult` calls + capturing args. Run two requests: one matching, one diverging. Assert two calls, args `(runId, true)` then `(runId, false)`.

Test scaffolding mirrors the existing patterns in `tests/cli/platform-api-runs.test.ts:11-58` (the `makeRun`, `makeRes`, `makeReq` helpers + `ENABLED` constant). The `ENABLED` constant gains a `scenarioLookup` field; the existing tests need that field added so `HandlePlatformApiOptions` typechecks.

### §4.8 Documentation

`docs/ARCHITECTURE.md` is the canonical engine + runtime architecture doc. Add a one-paragraph section under the existing "Replay" section (T5.5 was already documented in the 2026-04-25 hotfix push) describing the HTTP surface:

```
The HTTP surface for replay is `POST /api/v1/runs/:runId/replay` on
the dashboard server. The endpoint loads the stored artifact via
`record.artifactPath`, looks up the original scenario via the
in-memory catalog, constructs a WorldModel, calls
`WorldModel.replay(artifact)`, and persists the outcome via
`runHistoryStore.recordReplayResult(runId, matches)`. Returns
`{ matches: boolean, divergence: string }` on 200, structured errors
on 404 / 410 / 422.
```

No README change. The Library section in `landing.html` already names the Replay button as a Library-tab capability and does not need to surface the HTTP path.

## §5. Risks + mitigations

1. **Replay is CPU-bound. Long artifacts (50+ turns / 100+ agents) may approach the default HTTP timeout in some reverse-proxy setups.** A 30-turn mars artifact with 12 agents replays locally in well under one second; the longest plausible production artifact is around 40 turns, which keeps the request comfortably under any default proxy timeout. Mitigation: document expected duration in the JSDoc on the route handler. The Promise-returning architecture lets a future implementation stream progress without changing the URL or response shape.
2. **`recordReplayResult` is opt-in on the `RunHistoryStore` interface (`?:`).** If a future store implementation drops it, the call is a no-op and the aggregate counters silently desync. Mitigation: existing pattern used by `/replay-result`. Counter desync is observable via `/api/v1/runs/aggregate` showing `replaysAttempted` flat while users report replay activity; not a silent failure in practice.
3. **The route handler imports the runtime layer.** This pulls `@framers/agentos` into the route's transitive graph. Server-side this is fine; the existing handler at `platform-api.ts:135-160` already exercises Node-only paths (`node:fs/promises`). Mitigation: no test boundary issue; the route handler tests already mock the store and pass synthetic artifacts.
4. **Adding `scenarioLookup` makes `HandlePlatformApiOptions` strictly larger.** Search confirms one in-tree caller (`server-app.ts:824`) and one test fixture group. Mitigation: both updated in this spec. `npm run typecheck:dashboard` (§4.5) catches any missed call sites.
5. **`tsc -p src/cli/dashboard` adds 3-5 seconds to every `npm test` run.** Acceptable for the bug class it catches (today's `5ea29fec` was exactly this class, costing a CI cycle and a hot fix). Mitigation: none needed; this is the explicit value trade.
6. **The pnpm-contamination CI guard (§4.6) is a substring match.** A future legitimate use of the literal substring `node_modules/.pnpm/` inside a lockfile would false-positive. Mitigation: lockfiles do not contain comments, and npm-resolved registry URLs use `registry.npmjs.org` paths that never include `node_modules/.pnpm/`. The substring is reliably distinctive.
7. **The lockfile contamination has already shipped once in the last 24 hours.** The `9ec24075` repair regenerated a clean lockfile. Mitigation: the §4.6 guard catches the next regression in CI. No behavior change for the current state.

## §6. Execution order

Each step ends with verification that the suite still passes (817 + new) and a commit. Per project convention, push happens only on user request after all commits land.

1. **Extend `HandlePlatformApiOptions`** (`src/cli/server/routes/platform-api.ts:28-39`). Add `scenarioLookup` field and the `ScenarioPackage` import. Update server-app's call site (`src/cli/server-app.ts:820-824`). Update the `ENABLED` constant in `tests/cli/platform-api-runs.test.ts:58` to include `scenarioLookup: () => undefined`. Run `npm test`; expect 817 still pass.
2. **Write the seven failing tests** (test list in §4.7). Append to `tests/cli/platform-api-runs.test.ts`. Run `npm test`; expect 7 fail with `unknown_platform_route` (because the route does not exist yet).
3. **Implement the endpoint** (§4.2). Insert the route block + the two new imports. Run `npm test`; expect 824 pass, 0 fail.
4. **Add `typecheck:dashboard` script + `pretest` chaining** (§4.5). Edit `apps/paracosm/package.json`. Run `npm test` from the paracosm root; expect tsc clean → 824 pass.
5. **Add the CI pnpm-contamination guard** (§4.6). Edit `.github/workflows/deploy.yml`. Verify locally by introducing a `node_modules/.pnpm/` substring into a copy of the lockfile and running the guard's grep manually; revert.
6. **Add the architecture doc paragraph** (§4.8). Edit `docs/ARCHITECTURE.md`.
7. **Em-dash sweep** on all changed files: `perl -ne 'print "$ARGV:$.: $_" if /\x{2014}/' <files>`. Em-dashes (U+2014) are forbidden anywhere in the codebase.
8. **Final local verification**: `npx tsc --noEmit` (root) → 0 errors; `npx tsc --noEmit -p tsconfig.build.json` → 0 errors; `npx tsc -p src/cli/dashboard --noEmit` → 0 errors; `npm test` → 824 pass / 0 fail / 1 skip; `cd src/cli/dashboard && npx vite build` → green.
9. **Manual smoke (from §7 criterion 3)**: start the server, run a real mars sim with `captureSnapshots: true`, open Library, click Replay → green "match" panel.

## §7. Success criteria

- All 7 new tests green.
- Existing 817 tests still green.
- `npx tsc --noEmit` from root: 0 errors.
- `npx tsc --noEmit -p tsconfig.build.json`: 0 errors.
- `npx tsc -p src/cli/dashboard --noEmit`: 0 errors.
- `cd src/cli/dashboard && npx vite build`: green, all chunks emit.
- Manual: starting `paracosm-dashboard`, running a real mars sim with `captureSnapshots: true`, opening Library, clicking Replay → green "match" panel; subsequent `/api/v1/runs/aggregate` shows `replaysAttempted: 1, replaysMatched: 1`.
- Deliberate off-by-one import in any `src/cli/dashboard/src/**/*.tsx` file → `npm test` fails before the test runner starts (proves §4.5 wired correctly).
- Deliberate `node_modules/.pnpm/` substring inserted into either lockfile → CI build job fails at the guard step before `npm ci` runs (proves §4.6 wired correctly).
- Em-dash sweep clean across all changed files.

## §8. References

- `src/cli/server/routes/platform-api.ts:118-160` — existing `/replay-result` POST + `:runId` GET patterns to mirror.
- `src/runtime/world-model/index.ts:582-594` — `WorldModel.replay` implementation.
- `src/runtime/world-model/index.ts:135-139` — `WorldModelReplayResult` shape.
- `src/runtime/orchestrator.ts:2049-2138` — `WorldModelReplayError` + `replaySimulation` (kernel re-execution under canonical JSON comparison).
- `src/cli/server-app.ts:380-382` — `customScenarioCatalog` declaration + built-in seeding.
- `src/cli/server-app.ts:820-824` — current `handlePlatformApiRoute` call site.
- `src/cli/dashboard/src/components/library/hooks/useReplayRun.ts` — client contract (unchanged).
- `tests/runtime/world-model/replay.test.ts:19-52` — `captureSnapshots` + `syntheticArtifact` test fixtures to copy.
- `tests/cli/platform-api-runs.test.ts:11-58` — `makeRun`, `makeRes`, `makeReq`, `ENABLED` test scaffolding.
- `apps/paracosm/.github/workflows/deploy.yml:55-88` — existing CI install + drift-warning steps the new guard slots into.
- `docs/superpowers/specs/2026-04-25-worldmodel-replay-digital-twin-schema-gate-design.md` — replay v1 spec.
- `docs/superpowers/specs/2026-04-25-library-tab-design.md` — Library tab spec; this work closes its outstanding endpoint stub.
- `docs/superpowers/NEXT_SESSION_2026-04-26_HANDOFF.md §6` — open-work list; this spec covers P0 and P1a, and adds the lockfile guard as §4.6.

## §9. Glossary

- **Lockfile contamination:** the artifact of running `npm install` from inside a pnpm workspace, which causes npm to write parent-relative paths into the lockfile. The contaminated lockfile resolves only in the original developer's monorepo and breaks every other consumer.
- **Replay precondition:** an artifact has the structural fields `WorldModelReplayError` checks for (scenario id match with target WorldModel, non-empty `kernelSnapshotsPerTurn`, non-empty `decisions`). When all three hold, replay succeeds; when any fails, the orchestrator throws `WorldModelReplayError` with a message that names the missing field.
- **Match vs divergence:** under canonical JSON serialization, the fresh `kernelSnapshotsPerTurn` produced by re-running today's progression hook either equals the artifact's recorded `kernelSnapshotsPerTurn` byte-for-byte (`matches: true`, `divergence: ''`) or differs at exactly one path which `firstDivergence` reports as a JSON-pointer (`matches: false`, `divergence: '/<path>'`).
