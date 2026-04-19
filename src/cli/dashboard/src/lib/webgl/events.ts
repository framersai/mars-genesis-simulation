import type { Deposit } from './grayScott.js';
import type { ActiveFlare } from '../../components/viz/grid/flareQueue.js';

/**
 * Translate active flares into per-frame chemistry deposits. Each
 * flare paints additional U or V into the field; intensity fades
 * across the flare's lifetime.
 */
export function flaresToDeposits(
  flares: ActiveFlare[],
  gridW: number,
  gridH: number,
): Deposit[] {
  void gridW;
  void gridH;
  const out: Deposit[] = [];
  for (const f of flares) {
    const t = f.progress;
    const falloff = 1 - t;
    switch (f.kind) {
      case 'birth': {
        const r = 2 + Math.floor(t * 6);
        out.push({ x: f.x, y: f.y, channel: 0, strength: 0.3 * falloff, radius: r });
        break;
      }
      case 'death': {
        const r = 2 + Math.floor(t * 4);
        out.push({ x: f.x, y: f.y, channel: 1, strength: 0.25 * falloff, radius: r });
        break;
      }
      case 'forge_approved': {
        out.push({ x: f.x, y: f.y, channel: 0, strength: 0.18 * falloff, radius: 3 });
        break;
      }
      case 'forge_rejected': {
        out.push({ x: f.x, y: f.y, channel: 1, strength: 0.14 * falloff, radius: 2 });
        break;
      }
      case 'reuse': {
        const ex = f.endX ?? f.x;
        const ey = f.endY ?? f.y;
        const cx = f.x + (ex - f.x) * t;
        const cy = f.y + (ey - f.y) * t;
        out.push({ x: cx, y: cy, channel: 0, strength: 0.12 * falloff, radius: 2 });
        break;
      }
      case 'crisis': {
        const r = 4 + Math.floor(t * 12);
        out.push({ x: f.x, y: f.y, channel: 1, strength: 0.22 * falloff, radius: r });
        break;
      }
    }
  }
  return out;
}
