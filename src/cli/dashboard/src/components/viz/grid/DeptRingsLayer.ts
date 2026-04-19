import type { CellSnapshot, GridPosition } from '../viz-types.js';

const DEPT_COLORS: Record<string, string> = {
  medical: 'rgba(78, 205, 196, 0.4)',
  engineering: 'rgba(232, 180, 74, 0.4)',
  agriculture: 'rgba(106, 173, 72, 0.4)',
  psychology: 'rgba(155, 107, 158, 0.4)',
  governance: 'rgba(224, 101, 48, 0.4)',
  research: 'rgba(149, 107, 216, 0.4)',
  science: 'rgba(149, 107, 216, 0.4)',
  ops: 'rgba(200, 122, 58, 0.4)',
  operations: 'rgba(200, 122, 58, 0.4)',
};

function deptRingColor(dept: string): string {
  const key = (dept || '').toLowerCase();
  return DEPT_COLORS[key] ?? 'rgba(168, 152, 120, 0.35)';
}

/**
 * Draw faint dept-cluster ring boundaries under the colonist glyphs.
 * One ring per dept; radius = max(distance from centroid) + 8px
 * padding. Dotted stroke keeps them unobtrusive so they read as
 * spatial hints, not content.
 */
export function drawDeptRings(
  ctx: CanvasRenderingContext2D,
  cells: CellSnapshot[],
  positions: Map<string, GridPosition>,
): void {
  const byDept = new Map<string, { cx: number; cy: number; r: number }>();
  // First pass: compute centroid.
  const acc = new Map<string, { x: number; y: number; n: number }>();
  for (const c of cells) {
    if (!c.alive) continue;
    const p = positions.get(c.agentId);
    if (!p) continue;
    const key = (c.department || 'unknown').toLowerCase();
    const slot = acc.get(key) ?? { x: 0, y: 0, n: 0 };
    slot.x += p.x;
    slot.y += p.y;
    slot.n += 1;
    acc.set(key, slot);
  }
  for (const [k, v] of acc.entries()) {
    if (v.n < 2) continue; // single-colonist clusters get no ring
    byDept.set(k, { cx: v.x / v.n, cy: v.y / v.n, r: 0 });
  }
  // Second pass: max distance = ring radius.
  for (const c of cells) {
    if (!c.alive) continue;
    const p = positions.get(c.agentId);
    if (!p) continue;
    const key = (c.department || 'unknown').toLowerCase();
    const slot = byDept.get(key);
    if (!slot) continue;
    const d = Math.hypot(p.x - slot.cx, p.y - slot.cy);
    if (d > slot.r) slot.r = d;
  }
  ctx.save();
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1;
  for (const [dept, slot] of byDept.entries()) {
    if (slot.r < 6) continue;
    ctx.strokeStyle = deptRingColor(dept);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(slot.cx, slot.cy, slot.r + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}
