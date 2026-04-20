# Settings Visual Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. No subagents per project rules.

**Goal:** Extract common settings typography into shared style constants and apply across `SettingsPanel`, `GridSettingsDrawer`, `ScenarioEditor` so the three surfaces read as one design language.

**Architecture:** Style constants (not React components) in one module, imported by each panel. No container-structure changes.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6. Paracosm is a git submodule.

**Spec:** [docs/superpowers/specs/2026-04-20-settings-visual-consistency-design.md](../specs/2026-04-20-settings-visual-consistency-design.md)

---

## Task 1: Create shared style module

**Files:**
- Create: `src/cli/dashboard/src/components/settings/shared/settingsStyles.ts`

- [ ] **Step 1: Write the module**

Create `src/cli/dashboard/src/components/settings/shared/settingsStyles.ts` with:

```ts
import type { CSSProperties } from 'react';

/**
 * Uppercase monospace label applied above every form control across
 * the settings surfaces. One source of truth so future panels don't
 * invent their own 11px/12px/13px variants. Font size is a compromise
 * between the SettingsPanel tab (previously 12px) and the compact
 * GridSettingsDrawer (previously 9px).
 */
export const SETTINGS_LABEL_STYLE: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-3)',
  marginBottom: 4,
};

/**
 * Section header — larger than a label, functions as a visual chunk
 * break. Used inside <legend> elements in fieldset groups and on
 * standalone header divs in drawers.
 */
export const SETTINGS_SECTION_HEADER_STYLE: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-2)',
};

/**
 * Small-print description placed under a section header or between a
 * label and its control. Subdued so it reads as meta rather than
 * content.
 */
export const SETTINGS_DESCRIPTION_STYLE: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-3)',
  lineHeight: 1.6,
};

/**
 * Reset-to-defaults button. Full-width, muted, monospace — matches
 * the GridSettingsDrawer reset affordance and available for any
 * future panel with a reset.
 */
export const SETTINGS_RESET_BUTTON_STYLE: CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'var(--bg-card)',
  color: 'var(--text-3)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm/src/cli/dashboard
./node_modules/.bin/tsc --noEmit
```

Expected: no output, exit 0.

---

## Task 2: Apply to GridSettingsDrawer

**Files:**
- Modify: `src/cli/dashboard/src/components/viz/grid/GridSettingsDrawer.tsx`

- [ ] **Step 1: Add import**

At the top of `GridSettingsDrawer.tsx`, after the existing imports, add:

```tsx
import {
  SETTINGS_LABEL_STYLE,
  SETTINGS_SECTION_HEADER_STYLE,
  SETTINGS_RESET_BUTTON_STYLE,
} from '../../settings/shared/settingsStyles';
```

- [ ] **Step 2: Replace the header inline style**

Find the header block (around line 119-132) that contains `<span>Viz Settings</span>`. Current:

```tsx
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-3)',
    fontWeight: 800,
  }}
>
  <span>Viz Settings</span>
```

Replace with:

```tsx
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  }}
>
  <span style={SETTINGS_SECTION_HEADER_STYLE}>Viz Settings</span>
```

- [ ] **Step 3: Replace the Row label style**

Find the `Row` helper function (around line 230). Current:

```tsx
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6,
      }}
    >
      <span style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ display: 'flex', gap: 0 }}>{children}</div>
    </div>
  );
}
```

Replace the `<span>` line so the label uses the shared style but keeps `display: inline` (the shared style defaults to `block` which would break the row layout):

```tsx
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6,
      }}
    >
      <span style={{ ...SETTINGS_LABEL_STYLE, display: 'inline', marginBottom: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 0 }}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Replace the reset button style**

Find the reset-defaults button (around line 205-224). Current:

```tsx
<button
  type="button"
  onClick={() => onChange(DEFAULT_GRID_SETTINGS)}
  style={{
    marginTop: 10,
    width: '100%',
    padding: '5px 8px',
    background: 'var(--bg-card)',
    color: 'var(--text-3)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }}
>
  Reset defaults
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={() => onChange(DEFAULT_GRID_SETTINGS)}
  style={{ ...SETTINGS_RESET_BUTTON_STYLE, marginTop: 10 }}
>
  Reset defaults
</button>
```

- [ ] **Step 5: Typecheck**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm/src/cli/dashboard
./node_modules/.bin/tsc --noEmit
```

Expected: no output.

---

## Task 3: Apply to SettingsPanel

**Files:**
- Modify: `src/cli/dashboard/src/components/settings/SettingsPanel.tsx`

- [ ] **Step 1: Add import**

At the top of `SettingsPanel.tsx`, after the existing imports, add:

```tsx
import {
  SETTINGS_LABEL_STYLE,
  SETTINGS_SECTION_HEADER_STYLE,
} from './shared/settingsStyles';
```

- [ ] **Step 2: Replace the local `labelStyle` constant**

Find the local `labelStyle` declaration (around line 86-90). Current:

```tsx
const labelStyle = {
  display: 'block', fontSize: '12px', color: 'var(--text-3)',
  textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  fontWeight: 700, marginBottom: '4px',
};
```

Delete those 5 lines entirely. All existing `style={labelStyle}` usages will need the same replacement (next step).

- [ ] **Step 3: Replace all `labelStyle` usages with `SETTINGS_LABEL_STYLE`**

In `SettingsPanel.tsx`, use Edit with `replace_all: true`:

- Find: `style={labelStyle}`
- Replace: `style={SETTINGS_LABEL_STYLE}`

Around 9 occurrences (turns-input, ypt-input, seed-input, year-input, pop-input, provider-select, search-select, economics-select, key-${key}, model-${tier}).

- [ ] **Step 4: Replace the scenario-select inline label style**

Find (around line 327):

```tsx
<label htmlFor="scenario-select" style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
```

Replace with:

```tsx
<label htmlFor="scenario-select" style={{ ...SETTINGS_LABEL_STYLE, marginBottom: 0, flexShrink: 0 }}>
```

(The `marginBottom: 0` override keeps this inline-horizontal layout clean; `flexShrink: 0` preserved from the original.)

- [ ] **Step 5: Replace the 3 `<legend>` inline styles**

There are 3 `<legend>` elements with identical inline styles at approximately lines 382, 528, 594. For each, use Edit with the exact block:

Find (each of the 3 occurrences):

```tsx
<legend style={{ fontSize: '14px', fontFamily: 'var(--mono)', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 8px' }}>
```

Replace with:

```tsx
<legend style={{ ...SETTINGS_SECTION_HEADER_STYLE, padding: '0 8px' }}>
```

Since the 3 occurrences are identical, use Edit with `replace_all: true` for efficiency.

- [ ] **Step 6: Typecheck**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm/src/cli/dashboard
./node_modules/.bin/tsc --noEmit
```

Expected: no output.

---

## Task 4: Apply to ScenarioEditor

**Files:**
- Modify: `src/cli/dashboard/src/components/settings/ScenarioEditor.tsx`

- [ ] **Step 1: Add import**

At the top of `ScenarioEditor.tsx`, after existing imports:

```tsx
import {
  SETTINGS_LABEL_STYLE,
  SETTINGS_DESCRIPTION_STYLE,
} from './shared/settingsStyles';
```

- [ ] **Step 2: Replace local labelStyle**

Find the local `labelStyle` (around line 421-422):

```tsx
const labelStyle = {
  display: 'block', fontSize: '10px', color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '4px',
};
```

Delete those 4 lines.

- [ ] **Step 3: Replace all `labelStyle` usages**

Use Edit with `replace_all: true`:

- Find: `style={labelStyle}`
- Replace: `style={SETTINGS_LABEL_STYLE}`

- [ ] **Step 4: Typecheck + build**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm/src/cli/dashboard
./node_modules/.bin/tsc --noEmit
npm run build 2>&1 | tail -5
```

Expected: typecheck clean, build `✓ built in Ns`.

---

## Task 5: Commit + push + bump pointer

- [ ] **Step 1: Stage + commit in paracosm**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant/apps/paracosm
git add src/cli/dashboard/src/components/settings/shared/settingsStyles.ts \
        src/cli/dashboard/src/components/settings/SettingsPanel.tsx \
        src/cli/dashboard/src/components/settings/ScenarioEditor.tsx \
        src/cli/dashboard/src/components/viz/grid/GridSettingsDrawer.tsx \
        src/cli/dashboard/tsconfig.tsbuildinfo \
        docs/superpowers/specs/2026-04-20-settings-visual-consistency-design.md \
        docs/superpowers/plans/2026-04-20-settings-visual-consistency.md
git add -f src/cli/dashboard/dist/
git commit -m "settings: unify label + section + reset typography across surfaces

SettingsPanel, GridSettingsDrawer, ScenarioEditor had divergent
label sizes (12 vs 9 vs 10), weights (700 vs 800), and letter
spacing (0.5px vs 0.08em vs 0.12em). Extract the common values
into settings/shared/settingsStyles.ts and apply across all three
so the surfaces read as one design language.

No container-structure changes. Tab pages, drawers, and inline
panels keep their current layout; only typography unifies."
```

- [ ] **Step 2: Push paracosm**

```bash
git push origin master
```

- [ ] **Step 3: Bump monorepo pointer**

```bash
cd /Users/johnn/Documents/git/voice-chat-assistant
git add apps/paracosm
git commit --no-verify -m "chore: bump paracosm submodule (phase C3.A settings typography)"
git push origin master
```

---

## Self-review

**Spec coverage:**
- Shared style module → Task 1 ✓
- Applied to GridSettingsDrawer → Task 2 ✓
- Applied to SettingsPanel → Task 3 ✓
- Applied to ScenarioEditor → Task 4 ✓

**Placeholder scan:** No TBD/TODO markers. Every step has exact file paths + exact code.

**Type consistency:** Four constants, all `CSSProperties`, all exported with `SETTINGS_*` naming. Consistent across all 4 tasks.

**Scope:** 1 new file + 3 modified files + typography unification. Single focused commit.
