import type { CellSnapshot, GridPosition } from '../viz-types.js';

interface DrawGlyphsOptions {
  intensity?: number;
  divergedIds?: Set<string>;
  divergenceOnly?: boolean;
  /** performance.now() — drives the featured-colonist sinusoidal pulse
   *  so it breathes at ~2s period without a per-glyph timer. */
  timeMs?: number;
}

/** Outlined colonist markers. Primary hit-test target. Featured
 *  colonists get an outer halo that sinusoidally pulses with `timeMs`
 *  so the eye tracks them without losing positional stability.
 *  `searchQuery` (case-insensitive substring) highlights matching
 *  colonists with a bright amber ring and dims non-matches. */
export function drawGlyphs(
  ctx: CanvasRenderingContext2D,
  cells: CellSnapshot[],
  positions: Map<string, GridPosition>,
  sideColor: string,
  intensity = 1,
  divergedIds?: Set<string>,
  divergenceOnly = false,
  timeMs = 0,
  searchQuery = '',
): void {
  void ({} as DrawGlyphsOptions);
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.003);
  const query = searchQuery.trim().toLowerCase();
  for (const c of cells) {
    if (!c.alive) continue;
    const pos = positions.get(c.agentId);
    if (!pos) continue;
    const diverged = divergedIds?.has(c.agentId) ?? false;
    if (divergenceOnly && !diverged) continue;
    const matchesSearch = query.length > 0 && c.name.toLowerCase().includes(query);
    const searchDim = query.length > 0 && !matchesSearch;
    const r = c.featured ? 5 : 3;
    const baseAlpha = c.featured ? 0.95 : 0.75;
    const searchAlphaMult = searchDim ? 0.25 : 1;

    if (c.featured && !searchDim) {
      // Pulsing outer halo — radius breathes ~5→10px over ~2s so
      // featured colonists call out rhythmically without moving.
      const haloR = r + 4 + pulse * 4;
      const haloAlpha = (0.2 + pulse * 0.35) * intensity;
      ctx.strokeStyle = sideColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = haloAlpha;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, haloR, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (matchesSearch) {
      // Bright amber search halo, thicker than normal rings so matches
      // pop even in dense clusters.
      const mPulse = 0.7 + 0.3 * Math.sin(timeMs * 0.006);
      ctx.strokeStyle = 'rgba(248, 225, 150, 1)';
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = intensity * mPulse;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (diverged && !searchDim) {
      ctx.strokeStyle = 'rgba(232, 180, 74, 0.9)';
      ctx.lineWidth = 2;
      ctx.globalAlpha = intensity;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = diverged ? 'rgba(224, 101, 48, 1)' : sideColor;
    ctx.lineWidth = c.featured || diverged || matchesSearch ? 1.6 : 1;
    ctx.globalAlpha = (diverged ? 1 : baseAlpha) * intensity * searchAlphaMult;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
