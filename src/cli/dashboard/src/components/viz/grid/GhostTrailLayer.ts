import type { CellSnapshot, GridPosition } from '../viz-types.js';

/**
 * Draw faded prior-turn colonist outlines with arrows to their current
 * positions. Only renders colonists present in BOTH turns so the effect
 * reads as "this person moved here." Skips colonists whose movement is
 * below a pixel threshold (no visible delta).
 */
export function drawGhostTrail(
  ctx: CanvasRenderingContext2D,
  currentCells: CellSnapshot[],
  currentPositions: Map<string, GridPosition>,
  previousCells: CellSnapshot[] | undefined,
  previousPositions: Map<string, GridPosition> | undefined,
): void {
  if (!previousCells || !previousPositions) return;
  const currById = new Map(currentCells.map(c => [c.agentId, c]));
  ctx.save();
  ctx.lineCap = 'round';
  for (const prev of previousCells) {
    if (!prev.alive) continue;
    const curr = currById.get(prev.agentId);
    if (!curr || !curr.alive) continue;
    const pFrom = previousPositions.get(prev.agentId);
    const pTo = currentPositions.get(prev.agentId);
    if (!pFrom || !pTo) continue;
    const dx = pTo.x - pFrom.x;
    const dy = pTo.y - pFrom.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) continue;

    // Faded prior-position outline.
    ctx.strokeStyle = 'rgba(216, 204, 176, 0.32)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(pFrom.x, pFrom.y, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow line from prior → current.
    ctx.strokeStyle = 'rgba(216, 204, 176, 0.25)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(pFrom.x, pFrom.y);
    ctx.lineTo(pTo.x, pTo.y);
    ctx.stroke();

    // Arrow head at current position (small triangle).
    const ang = Math.atan2(dy, dx);
    const ah = 4;
    ctx.fillStyle = 'rgba(216, 204, 176, 0.5)';
    ctx.beginPath();
    ctx.moveTo(pTo.x, pTo.y);
    ctx.lineTo(
      pTo.x - Math.cos(ang - 0.4) * ah,
      pTo.y - Math.sin(ang - 0.4) * ah,
    );
    ctx.lineTo(
      pTo.x - Math.cos(ang + 0.4) * ah,
      pTo.y - Math.sin(ang + 0.4) * ah,
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
