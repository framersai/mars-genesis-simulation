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
 *  so the eye tracks them without losing positional stability. */
export function drawGlyphs(
  ctx: CanvasRenderingContext2D,
  cells: CellSnapshot[],
  positions: Map<string, GridPosition>,
  sideColor: string,
  intensity = 1,
  divergedIds?: Set<string>,
  divergenceOnly = false,
  timeMs = 0,
): void {
  void ({} as DrawGlyphsOptions);
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.003);
  for (const c of cells) {
    if (!c.alive) continue;
    const pos = positions.get(c.agentId);
    if (!pos) continue;
    const diverged = divergedIds?.has(c.agentId) ?? false;
    if (divergenceOnly && !diverged) continue;
    const r = c.featured ? 5 : 3;
    const baseAlpha = c.featured ? 0.95 : 0.75;

    if (c.featured) {
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

    if (diverged) {
      // Diverged halo to pop them out of the cluster.
      ctx.strokeStyle = 'rgba(232, 180, 74, 0.9)';
      ctx.lineWidth = 2;
      ctx.globalAlpha = intensity;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = diverged ? 'rgba(224, 101, 48, 1)' : sideColor;
    ctx.lineWidth = c.featured || diverged ? 1.6 : 1;
    ctx.globalAlpha = (diverged ? 1 : baseAlpha) * intensity;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
