import { OneEuroFilter } from '../../src/filter/oneEuroFilter';

export type Point = { x: number; y: number; visibility?: number };
export type Side = 'left' | 'right';

/** Ângulo projetado entre o tronco e o braço. Não é uma medida clínica 3D. */
export function armAngle(points: Point[], side: Side, aspect = 1): number | null {
  const indexes = side === 'left' ? [11, 13, 23] : [12, 14, 24];
  const [shoulder, elbow, hip] = indexes.map(i => points[i]);
  if ([shoulder, elbow, hip].some(p => !p || (p.visibility ?? 1) < 0.5)) return null;
  const ax = (elbow.x - shoulder.x) * aspect, ay = elbow.y - shoulder.y;
  const bx = (hip.x - shoulder.x) * aspect, by = hip.y - shoulder.y;
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (length < 0.0001) return null;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / length))) * 180 / Math.PI;
}

export class MotionFilter {
  private filter = new OneEuroFilter(30, 1, 0.02);
  update(angle: number, time: number): number { return this.filter.filter(angle, time / 1000); }
  reset(): void { this.filter.reset(); }
}

export function normalizeAngle(angle: number, rest: number, maximum: number): number {
  return Math.max(0, Math.min(1, (angle - rest) / (maximum - rest)));
}
