import type { ShoulderLevels } from '../../exercise/shoulderInput';
import { TargetChallenge } from '../targetChallenge';
import type { TargetConfig, ChallengeEvent } from '../targetChallenge';
export type ShoulderGameConfig = TargetConfig<ShoulderLevels>;
export type ShoulderGameEvent = ChallengeEvent;
export class ShoulderGame extends TargetChallenge<ShoulderLevels> {
  constructor(config: ShoulderGameConfig) {
    super(
      config,
      (v) =>
        !!v &&
        [v.left, v.right].every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
      (v, t, tolerance) =>
        Math.abs(v.left - t.left) <= tolerance &&
        Math.abs(v.right - t.right) <= tolerance,
      () => ({ left: Math.random(), right: Math.random() })
    );
  }
}
