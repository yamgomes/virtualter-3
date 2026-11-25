import { commonConfig, defineGamePlan } from '../../session/gamePlan';
import type { GameConfig } from '../../session/gamePlan';
import { acceptsShoulderCalibration } from '../../exercise/shoulderCalibrationValidation';

export type GoalkeeperConfig = GameConfig & { sessionDurationMs?: never };

export const goalkeeperPlan = defineGamePlan('goalkeeper', {
  configure: (therapy): GoalkeeperConfig => commonConfig(therapy),
  acceptsConfig: (config) => config.sessionDurationMs === undefined,
  acceptsCalibration: acceptsShoulderCalibration,
  summary: {
    hits: ({ hits, attempts }) =>
      `${hits} defesas em ${attempts.length} chutes`,
    misses: ({ misses }) => `${misses} gols sofridos`,
    history: ({ hits, plannedAttempts }) =>
      `${hits}/${plannedAttempts} defesas`,
  },
});
