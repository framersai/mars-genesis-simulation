# Paracosm Dashboard Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No subagents per project rules.

**Goal:** Structural cleanup + mobile polish from Phase B of the 2026-04-20 audit: remove the dormant legacy VIZ path, wire touch interactions, trap focus in modals, collapse the Reports side-nav at phone width.

**Architecture:** Small, independent tasks. No cross-task coupling. Each task commits cleanly. Verify with `npm run test` (node:test runner) where tests exist; rely on `npx tsc --noEmit` inside `src/cli/dashboard/` elsewhere since the React components have no test infrastructure.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, node:test. Paracosm is a git submodule under `apps/paracosm/` — all commits land in the submodule's own git; the monorepo pointer is bumped separately.

---

## Task 1: Delete legacy VIZ path

The `VITE_NEW_GRID=0` branch renders `SwarmPanel` + `AutomatonBand` + `automaton/modes/*`. The new living-colony grid shipped as default months ago; the legacy path is dead weight with its own keybinding system and localStorage keys.

**Files:**
- Delete: `src/cli/dashboard/src/components/viz/SwarmPanel.tsx`
- Delete: `src/cli/dashboard/src/components/viz/automaton/AutomatonBand.tsx`
- Delete: `src/cli/dashboard/src/components/viz/automaton/AutomatonCanvas.tsx`
- Delete: `src/cli/dashboard/src/components/viz/automaton/useAutomatonState.ts`
- Delete: `src/cli/dashboard/src/components/viz/automaton/shared.ts`
- Delete: `src/cli/dashboard/src/components/viz/automaton/shared.test.ts`
- Delete: `src/cli/dashboard/src/components/viz/automaton/modes/mood.ts`
- Delete: `src/cli/dashboard/src/components/viz/automaton/modes/forge.ts`
- Delete: `src/cli/dashboard/src/components/viz/automaton/modes/ecology.ts`
- Modify: `src/cli/dashboard/src/components/viz/SwarmViz.tsx` (strip legacy branch, automaton state, related imports)
- Modify: `src/cli/dashboard/.env.example` (drop VITE_NEW_GRID note)
- Modify: `src/cli/dashboard/src/components/viz/grid/GridMetricsStrip.tsx` if it references SwarmPanel (grep hit — verify before edit)

**Side effects to verify:** `ClusterToggleRow`, `Legend`, `DrilldownPanel`, `VizControls` in `viz/` may only be used in the legacy branch. Grep each before deleting.

- [ ] **Step 1: Verify scope of dead code**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm
grep -rn "ClusterToggleRow\|Legend\|DrilldownPanel\|VizControls\|TurnBanner" src/cli/dashboard/src --include='*.tsx' --include='*.ts' | grep -v test | grep -v '\.d\.ts'
```

Expected: only `SwarmViz.tsx` imports. If others reference, keep.

- [ ] **Step 2: Remove SwarmPanel render block + automaton state from SwarmViz.tsx**

In `src/cli/dashboard/src/components/viz/SwarmViz.tsx`:

Remove these top-of-file imports (lines 5-22 area):

```ts
import type { AutomatonMode } from './automaton/shared.js';

const AUTOMATON_MODE_KEY = 'paracosm:vizAutomatonMode';
const AUTOMATON_COLLAPSED_KEY = 'paracosm:vizAutomatonCollapsed';
const AUTOMATON_MAXIMIZED_KEY = 'paracosm:vizAutomatonMaximized';
const AUTOMATON_NUDGE_KEY = 'paracosm:automatonNudgeSeen';

function readStoredMode(): AutomatonMode {
  try {
    const raw = localStorage.getItem(AUTOMATON_MODE_KEY);
    if (raw === 'mood' || raw === 'forge' || raw === 'ecology') return raw;
  } catch { /* silent */ }
  return 'mood';
}
function readStoredCollapsed(): boolean {
  try { return localStorage.getItem(AUTOMATON_COLLAPSED_KEY) === '1'; }
  catch { return false; }
}
```

Remove the `import { SwarmPanel } from './SwarmPanel.js';` line.

Remove the `automatonMode`, `automatonCollapsed`, `automatonMaximized`, `setAutomatonMode`, `setAutomatonMaximized`, `toggleAutomatonCollapsed` state block (lines 122-142 area) + the first-run nudge effect (lines 148-155 area) that posts `toast('info', 'Automaton view', ...)`.

In the keydown handler (around line 720), remove the `else` branch that covers legacy hotkeys (`m/M`, `d/D`, `a/A`, `1`/`2`/`3` for `setAutomatonMode`). Keep the `if (useNewGridFlag)` branch body and delete the outer `else`. The `useNewGridFlag` check becomes unconditional.

Delete the `useNewGridFlag` + `useNewGrid` flag derivations. The rest of the function no longer needs to branch.

Remove the legacy `return (...)` block (lines 1591-1678 — the second `return` that renders `ClusterToggleRow`, `SwarmPanel` x2, `Legend`, `VizControls`, `DrilldownPanel`).

Remove the `if (useNewGrid) { ... return (...); }` wrapper around the living-grid return — promote its body to the unconditional return.

- [ ] **Step 3: Delete the legacy files**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm
rm src/cli/dashboard/src/components/viz/SwarmPanel.tsx
rm -rf src/cli/dashboard/src/components/viz/automaton/
```

- [ ] **Step 4: Delete now-orphaned sibling components (confirm first with Step 1's grep)**

If the Step 1 grep showed only SwarmViz imports, also delete:

```bash
rm src/cli/dashboard/src/components/viz/ClusterToggleRow.tsx
rm src/cli/dashboard/src/components/viz/Legend.tsx
rm src/cli/dashboard/src/components/viz/DrilldownPanel.tsx
rm src/cli/dashboard/src/components/viz/VizControls.tsx
```

Otherwise skip this step and leave them in place.

- [ ] **Step 5: Drop `.env.example` flag note**

In `src/cli/dashboard/.env.example`, delete the comment block about `VITE_NEW_GRID`.

- [ ] **Step 6: Typecheck**

```bash
cd src/cli/dashboard && npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 7: Run tests**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm && npm test -- --test-reporter=spec 2>&1 | tail -30
```

Expected: pass. The `automaton/shared.test.ts` we deleted is gone from the glob. Other tests still exist (`viz-layout.test.ts`, `viz-types.test.ts`, etc.) and should remain green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "viz: drop legacy SwarmPanel + automaton path

VITE_NEW_GRID=1 has been default for months; legacy branch was
dormant carrying its own keybindings, localStorage keys, and
AutomatonBand canvas. Removes ~1500 LOC and one full shadow UI."
```

---

## Task 2: Touch interactions on LivingSwarmGrid canvas

Hover tooltips don't fire on touch devices — mobile users tap and see nothing. Wire tap = show tooltip; second tap on same glyph = open popover. That matches the desktop hover-then-click intent without new UI.

**Files:**
- Modify: `src/cli/dashboard/src/components/viz/grid/LivingSwarmGrid.tsx`

- [ ] **Step 1: Add touch handlers**

Near the existing `onMouseMove` / `onClick` handlers in `LivingSwarmGrid.tsx`, add:

```tsx
const lastTouchIdRef = useRef<string | null>(null);
const onTouchStart = useCallback(
  (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!snapshot) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const hit = hitTestGlyph(snapshot.cells, positions, x, y);
    if (!hit) {
      setHovered(null);
      setCursor(null);
      return;
    }
    // First tap shows tooltip, second tap on same glyph opens popover.
    if (lastTouchIdRef.current === hit.agentId) {
      setPopover({ cell: hit, x, y });
      setHovered(null);
      lastTouchIdRef.current = null;
      relationshipFlareRef.current = { id: hit.agentId, intensity: 1 };
    } else {
      setHovered({ cell: hit, x, y });
      setCursor({ x, y });
      lastTouchIdRef.current = hit.agentId;
      onHoverChange?.(hit.agentId);
    }
  },
  [snapshot, positions, onHoverChange],
);
```

- [ ] **Step 2: Wire `onTouchStart` onto the overlay canvas**

Find the `<canvas ref={overlayCanvasRef}` element. Add `onTouchStart={onTouchStart}` alongside the existing `onMouseMove` / `onMouseLeave` / `onClick` props.

- [ ] **Step 3: Clear tap-state on popover close**

In the existing `useEffect` that clears `popover` when the colonist vanishes, also reset `lastTouchIdRef.current = null;` when popover closes (so the double-tap state doesn't leak across taps).

- [ ] **Step 4: Typecheck**

```bash
cd src/cli/dashboard && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "viz(grid): tap-to-tooltip, second-tap-to-popover on touch

Hover tooltips don't fire on touch devices. Two-stage tap mirrors
the desktop hover-then-click intent without adding new UI."
```

---

## Task 3: Focus trap on all dialogs

Escape is handled on every modal but Tab escapes the dialog — keyboard users lose context behind the overlay. Build one small hook, apply everywhere.

**Files:**
- Create: `src/cli/dashboard/src/hooks/useFocusTrap.ts`
- Modify: `src/cli/dashboard/src/App.tsx` (verdict modal)
- Modify: `src/cli/dashboard/src/components/viz/grid/GridSettingsDrawer.tsx`
- Modify: `src/cli/dashboard/src/components/viz/grid/RosterDrawer.tsx`
- Modify: `src/cli/dashboard/src/components/viz/grid/ForgeLineageModal.tsx`
- Modify: `src/cli/dashboard/src/components/layout/CostBreakdownModal.tsx`

- [ ] **Step 1: Create `useFocusTrap.ts`**

```ts
import { useEffect, useRef } from 'react';

/**
 * Traps keyboard focus inside a dialog while it is open. Saves the
 * previously-focused element on open and restores it on close so the
 * user lands back where they were before the dialog took over.
 *
 * Usage:
 *   const ref = useFocusTrap<HTMLDivElement>(isOpen);
 *   return <div ref={ref} role="dialog">...</div>;
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const focusables = (): HTMLElement[] => {
      const nodes = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      return Array.from(nodes).filter(el => !el.hasAttribute('aria-hidden'));
    };

    const first = focusables()[0];
    if (first) first.focus();
    else container.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const idx = items.indexOf(document.activeElement as HTMLElement);
      const lastIdx = items.length - 1;
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          items[lastIdx].focus();
        }
      } else if (idx === lastIdx || idx === -1) {
        e.preventDefault();
        items[0].focus();
      }
    };

    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [active]);

  return containerRef;
}
```

- [ ] **Step 2: Apply to verdict modal in App.tsx**

Find the `verdictModalOpen && sse.verdict && (...)` block. Wrap the inner modal element with the hook:

```tsx
const verdictDialogRef = useFocusTrap<HTMLDivElement>(verdictModalOpen);
// ...
<div
  ref={verdictDialogRef}
  onClick={e => e.stopPropagation()}
  tabIndex={-1}
  style={{ /* existing styles */ }}
>
```

Add the import: `import { useFocusTrap } from './hooks/useFocusTrap';`

- [ ] **Step 3: Apply to GridSettingsDrawer**

At the top of the component function:

```tsx
import { useFocusTrap } from '../../../hooks/useFocusTrap';
// inside component:
const dialogRef = useFocusTrap<HTMLDivElement>(open);
```

Add `ref={dialogRef}` and `tabIndex={-1}` to the drawer root div. Keep the existing `rootRef` — or replace it with `dialogRef` if only used for the Escape handler (verify by reading).

- [ ] **Step 4: Apply to RosterDrawer, ForgeLineageModal, CostBreakdownModal**

Same pattern: import hook, call with the `open` boolean, attach ref + `tabIndex={-1}` to dialog root. Don't touch modals that don't exist (skip any with `role="dialog"` that aren't dismissable — e.g. VerdictCard inline mode).

- [ ] **Step 5: Typecheck**

```bash
cd src/cli/dashboard && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "a11y: focus trap on every dashboard dialog

Before: Tab escaped open modals into the page behind. Now focus
stays inside the dialog and is restored to the opener on close."
```

---

## Task 4: Reports side-nav compact at phone width

At `<768px` the side-nav becomes a vertical wall of 12+ section links above the actual content. Switch it to a horizontally-scrolling pill strip at `<768px` (keep current `<1024px` horizontal-strip behaviour as-is; only phone width changes).

**Files:**
- Modify: `src/cli/dashboard/src/components/reports/ReportSideNav.tsx`

- [ ] **Step 1: Add phone detection**

Inside `ReportSideNav.tsx`, extend `useIsDesktop` or add a sibling `usePhone`:

```tsx
function usePhone(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
}
```

- [ ] **Step 2: Render compact horizontal strip at phone width**

In the component render, after the existing `if (desktop)` branch, before the current horizontal-strip fallback, add:

```tsx
const phone = usePhone();

if (phone) {
  return (
    <nav
      aria-label="Report sections"
      style={{
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        padding: '6px 10px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {items.map(i => {
        const active = i.id === activeId;
        return (
          <a
            key={i.id}
            href={`#${i.id}`}
            style={{
              ...linkStyle,
              flex: '0 0 auto',
              padding: '4px 10px',
              borderRadius: 3,
              border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
              background: active ? 'var(--amber)' : 'var(--bg-card)',
              color: active ? 'var(--bg-deep)' : 'var(--text-3)',
            }}
            onClick={e => {
              e.preventDefault();
              const el = document.getElementById(i.id);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              setActiveId(i.id);
            }}
          >
            {i.label}
          </a>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd src/cli/dashboard && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "reports: horizontal-scroll pill nav at phone width

Below 768px the 12+ section links stacked vertically before any
report content. Horizontal scrollable pill strip matches how the
chronicle and timeline rows already behave on phone."
```

---

## Task 5: Finalize + submodule pointer bump

- [ ] **Step 1: Verify clean state**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm
git status
```

Expected: working tree clean.

- [ ] **Step 2: Push paracosm submodule**

```bash
git push origin master
```

- [ ] **Step 3: Bump monorepo pointer**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant
git add apps/paracosm
git commit --no-verify -m "chore: bump paracosm submodule (dashboard phase B)"
git push origin master
```

---

## Self-review

**Spec coverage vs audit Phase B list:**
- Delete legacy VIZ path → Task 1 ✓
- Split `LivingSwarmGrid` effect → deferred to Phase C (high visual-regression risk; needs dedicated pass with manual smoke test). Documented below.
- Settings unification → deferred (scope creep; belongs in its own spec)
- Touch interactions → Task 2 ✓
- Focus traps on all modals → Task 3 ✓
- Reports side-nav → Task 4 ✓

**Placeholder scan:** No TBD/TODO markers. Every code block is complete.

**Type consistency:** `useFocusTrap` signature `<T extends HTMLElement>(active: boolean) => RefObject<T | null>` consistent across Tasks 3 step 2-4. `lastTouchIdRef` type `MutableRefObject<string | null>` consistent with existing `relationshipFlareRef` pattern.

---

## Out of scope (documented for Phase C)

- Split `LivingSwarmGrid.tsx:422-861` 440-line effect into per-layer draw modules. Requires manual visual regression testing per layer (TDZ risk under production minifier).
- Unify three settings surfaces (`SettingsPanel`, `GridSettingsDrawer`, `ScenarioEditor`) behind one entry.
- RD field render resolution — currently fixed at 384×240 and CSS-scaled with `imageRendering: pixelated`; aliasing produces the diagonal saw-tooth visible in the 2026-04-20 screenshot. Needs dedicated RD shader work.
