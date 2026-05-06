# Ad-hoc probes

Standalone Node `.mjs` scripts kept for manual diagnostics. They predate the Playwright suite under `../specs/` and are useful for one-off investigations (a11y deep-dives, drawer state, viz popovers, etc.).

For repeatable regression coverage use the Playwright specs in `../specs/`. New regression coverage should land there, not here.

Run any probe with `node tests-e2e/probes/<name>.mjs`.
