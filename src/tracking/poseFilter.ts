import { OneEuroFilter } from '../filter/oneEuroFilter';
import { LANDMARK_NAMES } from './types';
import type { LandmarkName, Landmarks, PoseFrame } from './types';

/** Um filtro por eixo e articulação. Timestamps do filtro One Euro são em segundos. */
export class PoseFilter {
  private filters = new Map<LandmarkName, { x: OneEuroFilter; y: OneEuroFilter }>();
  private previousTime: number | null = null;
  filter(frame: PoseFrame): PoseFrame {
    if (this.previousTime !== null && (frame.timestamp <= this.previousTime || frame.timestamp - this.previousTime > 1000)) this.reset();
    this.previousTime = frame.timestamp;
    const points: Landmarks = {};
    for (const name of LANDMARK_NAMES) {
      const point = frame.points[name];
      if (!point || point.visibility < 0.5) { this.filters.delete(name); continue; }
      let filter = this.filters.get(name);
      if (!filter) { filter = { x: new OneEuroFilter(30, 1, 0.02), y: new OneEuroFilter(30, 1, 0.02) }; this.filters.set(name, filter); }
      points[name] = { ...point, x: filter.x.filter(point.x, frame.timestamp / 1000), y: filter.y.filter(point.y, frame.timestamp / 1000) };
    }
    return { ...frame, points };
  }
  reset(): void { this.filters.clear(); this.previousTime = null; }
}
