---
title: "Phase C3.A: Settings Visual Consistency"
date: 2026-04-20
status: design — approved
scope: paracosm/src/cli/dashboard/src/components/settings + viz/grid/GridSettingsDrawer
parent: 2026-04-20-viz-fixes-and-mobile-ux-audit
---

# Settings Visual Consistency

Three settings surfaces today — `SettingsPanel`, `GridSettingsDrawer`, `ScenarioEditor` — use arbitrarily different typography for conceptually identical pieces (labels, section headers, reset buttons). Nothing about the container difference (tab page vs floating drawer vs inline) justifies 12px vs 9px labels. This spec fixes the typography divergence without touching container structure.

## Current divergence

| Property | SettingsPanel | GridSettingsDrawer |
|---|---|---|
| Label font-size | 12px | 9px |
| Label letter-spacing | 0.5px | 0.06em–0.12em |
| Label weight | 700 | 800 |
| Section header | `<legend>` 14px mono uppercase | inline 9px header |

`ScenarioEditor` has its own set of inline styles that don't match either of the above.

## Fix

Add `src/cli/dashboard/src/components/settings/shared/settingsStyles.ts` exporting style constants:

```ts
import type { CSSProperties } from 'react';

/** Uppercase monospace label applied above every form control in the
 *  settings surfaces. One source of truth so new panels don't invent
 *  their own 11px/13px/14px variants. */
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

/** Section header — larger than a label, functions as a visual chunk
 *  break. Used in <legend> and standalone header divs alike. */
export const SETTINGS_SECTION_HEADER_STYLE: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-2)',
};

/** Small-print description under a section header or between a label
 *  and its control. Subdued so it reads as meta. */
export const SETTINGS_DESCRIPTION_STYLE: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-3)',
  lineHeight: 1.6,
};

/** Reset-to-defaults button. Same across GridSettingsDrawer and
 *  any future panel that needs a reset affordance. */
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

## Chosen values

The final values are a compromise between the two existing surfaces:

- Font-size: **11px** for labels (between 9 and 12). Large enough to read, small enough for the drawer.
- Weight: **700** (SettingsPanel's value). 800 feels heavier than needed.
- Letter-spacing: **0.08em**. GridSettingsDrawer's 0.12em was too airy; SettingsPanel's 0.5px was too tight.
- Font-family: **var(--mono)**. Both surfaces already use mono for labels in practice; making it explicit.

## Apply

`GridSettingsDrawer.tsx`:
- "Viz Settings" header → `SETTINGS_SECTION_HEADER_STYLE`
- Row labels → `SETTINGS_LABEL_STYLE`
- "Reset to defaults" button → `SETTINGS_RESET_BUTTON_STYLE`

`SettingsPanel.tsx`:
- The local `labelStyle` constant → replaced by `SETTINGS_LABEL_STYLE` import
- `<legend>` styles → `SETTINGS_SECTION_HEADER_STYLE`
- Description text under legends → `SETTINGS_DESCRIPTION_STYLE`

`ScenarioEditor.tsx`:
- Any label / section / description → matching shared style.

## Out of scope

- No container-structure changes. Tab page stays a tab, drawer stays a drawer, inline scenario editor stays inline.
- No color/palette shifts. All styles continue to use `var(--text-*)` / `var(--bg-*)` tokens.
- No new React components. Style constants only — lightest possible coupling.
- `HexacoSlider`, `LeaderConfig`, `LoadPriorRunsCTA` kept as-is unless their label styles are visible in the surfaces we're touching.

## Testing

Visual sanity — boot the dev server, open the Settings tab + open the VIZ grid settings drawer, confirm labels read as the same typography family. No unit tests (these are CSS constants).

Typecheck + build clean.

## Commit sketch

```
settings: unify label + section + reset typography across surfaces

SettingsPanel, GridSettingsDrawer, ScenarioEditor had divergent
label sizes (12px vs 9px), weights (700 vs 800), and letter
spacing (0.5px vs 0.12em). Extract the common values into
settings/shared/settingsStyles.ts and apply across all three so
the surfaces read as one design language.
```
