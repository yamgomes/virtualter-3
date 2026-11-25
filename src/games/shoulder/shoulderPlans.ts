import { acceptsShoulderCalibration } from '../../exercise/shoulderCalibrationValidation';
import type { ShoulderLevels } from '../../exercise/shoulderInput';
import {
  acceptsHold,
  commonConfig,
  defineGamePlan,
  timedConfig,
  unitLevel,
} from '../../session/gamePlan';
import type { ChallengeConfig } from '../../session/gamePlan';
import { count, number, object } from '../../session/validation';

export interface ShoulderConfig extends ChallengeConfig {
  /** Planos antigos podem registrar uma sequência fixa. */
  targets?: ShoulderLevels[];
}

export interface ShoulderElevationConfig extends ChallengeConfig {
  sets: number;
  restMs: number;
}

export const shoulderPlans = {
  shoulder: defineGamePlan('shoulder', {
    configure: (therapy): ShoulderConfig => timedConfig(therapy),
    acceptsConfig: (config) =>
      acceptsHold(config) &&
      (config.targets === undefined ||
        (Array.isArray(config.targets) &&
          config.targets.length > 0 &&
          config.targets.length <= 1000 &&
          config.targets.every(
            (target) =>
              object(target) &&
              unitLevel(target.left) &&
              unitLevel(target.right)
          ))),
    acceptsCalibration: acceptsShoulderCalibration,
  }),
  shoulderElevation: defineGamePlan('shoulderElevation', {
    configure: (therapy): ShoulderElevationConfig => ({
      ...commonConfig(therapy),
      timeLimitMs: Math.max(1, therapy.holdSeconds) * 1000,
      holdMs: therapy.holdSeconds * 1000,
      sets: therapy.sets,
      restMs: therapy.restSeconds * 1000,
    }),
    acceptsConfig: (config) =>
      acceptsHold(config) &&
      config.sessionDurationMs === undefined &&
      count(config.sets) &&
      config.sets >= 1 &&
      config.sets <= 100 &&
      number(config.restMs) &&
      config.restMs >= 0 &&
      config.restMs <= 3600000,
    acceptsCalibration: acceptsShoulderCalibration,
    resultLimits: (config) => ({
      planned: config.repetitions * config.sets,
      fixed: true,
    }),
    summary: {
      hits: ({ hits, plannedAttempts }) =>
        `${hits} de ${plannedAttempts} repetições concluídas`,
      misses: ({ misses }) => `${misses} repetições não concluídas`,
    },
  }),
};
