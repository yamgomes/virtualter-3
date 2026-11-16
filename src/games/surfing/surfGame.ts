import { TargetChallenge } from '../targetChallenge';
import type { SurfConfig } from '../../session/types';
export class SurfGame extends TargetChallenge<number> {
  constructor(config: SurfConfig) {
    super(
      config,
      (v) => Number.isFinite(v) && v >= 0 && v <= 1,
      (v, t, tolerance) => Math.abs(v - t) <= tolerance
    );
  }
}
