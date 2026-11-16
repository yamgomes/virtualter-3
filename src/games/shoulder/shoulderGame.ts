import type { ShoulderLevels } from '../../exercise/shoulderInput';
import type { BilateralCalibration, ShoulderAngles } from '../../exercise/automaticCalibration';
import { TargetChallenge } from '../targetChallenge';
import type { TargetConfig, ChallengeEvent } from '../targetChallenge';
export type ShoulderGameConfig = TargetConfig<ShoulderLevels>;
export type ShoulderGameEvent = ChallengeEvent;
export class ShoulderGame extends TargetChallenge<ShoulderAngles> {
  constructor(config: ShoulderGameConfig, range: BilateralCalibration) {
    const leftSpan = range.left.maximum - range.left.rest;
    const rightSpan = range.right.maximum - range.right.rest;
    const targets = config.targets?.map((target) => {
      if (!target || ![target.left, target.right].every((value) => value >= 0 && value <= 1))
        throw new Error('Alvo de ombro inválido');
      return {
        left: range.left.rest + leftSpan * target.left,
        right: range.right.rest + rightSpan * target.right,
      };
    });
    super(
      { ...config, targets },
      (v) =>
        !!v &&
        [v.left, v.right].every((n) => Number.isFinite(n) && n >= 0 && n <= 180),
      (v, t, tolerance) =>
        Math.abs(v.left - t.left) <= leftSpan * tolerance &&
        Math.abs(v.right - t.right) <= rightSpan * tolerance,
      () => ({
        left: range.left.rest + Math.random() * leftSpan,
        right: range.right.rest + Math.random() * rightSpan,
      })
    );
  }
}
