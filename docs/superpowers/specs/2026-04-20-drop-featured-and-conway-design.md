---
title: "Phase E: Compact FeaturedSpotlight + Drop Conway GoL"
date: 2026-04-20
status: design — approved
scope: paracosm/src/cli/dashboard/src/components/viz/grid
parent: 2026-04-20-viz-fixes-and-mobile-ux-audit
---

# Compact FeaturedSpotlight + Drop Conway GoL

User screenshot shows two overlays competing with canvas content after Phases A-D:

1. **FeaturedSpotlight cards** took a full-width band (`top: 60, left: 8, right: 8`) for 6s on every featured-cell turn. Keep the feature — a new featured colonist IS worth surfacing — but move to a non-intrusive corner pill that doesn't overtake the canvas.
2. **Conway GoL tiles** read as ambient noise. Phase A made the patterns mood-driven, but without a visible legend the viewer has no way to decode the mapping. Meaningful in intent, noise in perception.

## FeaturedSpotlight rework

Redesign the in-canvas spotlight to be:

- **Corner-pinned** at `bottom: 12, right: 12` (far from glyph clusters which tend to cluster center-left due to layout).
- **Compact single line per featured colonist** — `★ Carlos Costa · AGRICULTURE` on one row. No mood text (hover tooltip covers that). No description block.
- **Stacked vertically** with 4px gap when more than one fires in the same turn. Cap at 2 visible (same as current `.slice(0, 2)`).
- **Fixed width** ~220px so it never spans the canvas. Overflow-ellipsis on long names.
- **Same 6s auto-dismiss + click-to-open-drilldown** behavior preserved.
- **Pointer-events-none on the container**, pointer-events-auto on the pill buttons so the empty space above/beside them stays passthrough for hover/tap on glyphs underneath.

Result: a subtle bottom-right pill stack announces "new featured colonist arrived" without blocking the main viz. Identical data path; only presentation compresses.

## Conway goes

- `components/viz/grid/GameOfLifeLayer.ts` — delete the file; remove all imports, refs, and the `drawGol` call + seed + cache logic in `LivingSwarmGrid.tsx`.
- Related state in `LivingSwarmGrid.tsx`: `golStateRef`, `lastGolTurnRef`, `golCacheRef`, and the ~50-line Conway seed + warmup + cache block inside the render effect.

## What stays

- RD biome (WebGL Gray-Scott)
- Colonist glyphs
- Event flares (birth / death / forge / crisis)
- HUD corners (leader name + year)
- Hover tooltip + click-to-popover
- Roster drawer
- Dept rings (off by default, still available via settings)

## What about "how do I know who's featured?"

Featured colonists already get a visual distinction:
- Larger glyph radius (r=5 vs r=3 — see [GlyphLayer.ts:55](../../../src/cli/dashboard/src/components/viz/grid/GlyphLayer.ts#L55))
- Static outer ring in side color
- "FEATURED" badge in the hover tooltip + the click popover
- Roster drawer lists them with a star marker

The spotlight card added nothing these didn't already provide.

## Testing

- `tsc --noEmit` clean
- `npm run build` clean
- Manual smoke: open the VIZ tab on a running sim, confirm no spotlight cards appear when a new featured cell shows up, confirm no scattered amber/teal tiles appear behind the glyphs.

## Commit sketch

```
viz(grid): drop FeaturedSpotlight + Conway GoL overlays

Both were speculative ambient chrome that ended up blocking the
actual signal. FeaturedSpotlight duplicated information already
available in the HUD, roster drawer, and hover tooltip. Conway
tiles were mood-driven after Phase A but still read as noise
without a visible legend. Canvas now shows RD biome + glyphs +
flares + HUD corners only.

Featured colonists keep their distinction (larger glyph, outer
ring, hover tooltip badge).
```
