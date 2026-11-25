import {
  acceptsHold,
  defineGamePlan,
  timedConfig,
  unitLevel,
} from '../../session/gamePlan';
import type { ChallengeConfig } from '../../session/gamePlan';
import { number } from '../../session/validation';

export interface SurfConfig extends ChallengeConfig {
  targets: number[];
  side: 'left' | 'right';
}

export const surfingPlan = defineGamePlan('surfing', {
  configure: (therapy): SurfConfig => ({
    ...timedConfig(therapy),
    targets: therapy.targets.split(',').map((target) => Number(target) / 100),
    side: therapy.side,
  }),
  acceptsConfig: (config) =>
    acceptsHold(config) &&
    (config.side === 'left' || config.side === 'right') &&
    Array.isArray(config.targets) &&
    config.targets.length > 0 &&
    config.targets.length <= 1000 &&
    config.targets.every(unitLevel),
  acceptsCalibration: (c) =>
    number(c.rest) && number(c.maximum) && Math.abs(c.maximum - c.rest) >= 10,
});
