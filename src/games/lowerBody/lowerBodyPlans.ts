import type { Therapy } from '@homephysio/contracts';
import { commonConfig, defineGamePlan } from '../../session/gamePlan';
import type { GameConfig, GamePlanOptions } from '../../session/gamePlan';
import { number, object } from '../../session/validation';

export interface LowerBodyConfig extends GameConfig {
  sessionDurationMs: number;
}

function configure(therapy: Therapy): LowerBodyConfig {
  return {
    ...commonConfig(therapy),
    sessionDurationMs: therapy.durationSeconds * 1000,
  };
}

function timedSession(therapy: Therapy): LowerBodyConfig {
  const config = configure(therapy);
  return { ...config, timeLimitMs: config.sessionDurationMs };
}

const shared: Pick<
  GamePlanOptions<LowerBodyConfig>,
  'acceptsConfig' | 'acceptsCalibration' | 'acceptsMovement'
> = {
  acceptsConfig: (config) =>
    config.sessionDurationMs !== undefined &&
    (config.posture === undefined ||
      (object(config.posture) && config.posture.mode === 'front')),
  acceptsCalibration: (c) =>
    number(c.leftRest) &&
    c.leftRest > 0 &&
    number(c.rightRest) &&
    c.rightRest > 0 &&
    number(c.torsoLean) &&
    number(c.leftMaximum) &&
    c.leftMaximum >= 0.1 &&
    number(c.rightMaximum) &&
    c.rightMaximum >= 0.1,
  acceptsMovement: (movement) => !!movement?.lowerBody,
};

export const lowerBodyPlans = {
  kneeRaise: defineGamePlan('kneeRaise', {
    ...shared,
    configure: timedSession,
    summary: {
      hits: ({ hits, plannedAttempts }) =>
        `${hits} levantamentos (meta mínima de ${plannedAttempts})`,
      misses: ({ hits, plannedAttempts }) =>
        `${Math.max(0, plannedAttempts - hits)} levantamentos faltaram para a meta`,
      history: ({ hits, plannedAttempts }) =>
        `${hits}/${plannedAttempts} levantamentos`,
    },
  }),
  kneeJuggle: defineGamePlan('kneeJuggle', {
    ...shared,
    configure,
    resultLimits: (config) => ({ planned: config.repetitions, fixed: true }),
    summary: {
      hits: ({ hits, attempts }) =>
        `${hits} toques em ${attempts.length} bolas`,
      misses: ({ misses }) => `${misses} bolas perdidas`,
      history: ({ hits, plannedAttempts }) =>
        `${hits}/${plannedAttempts} toques`,
    },
  }),
  walking: defineGamePlan('walking', {
    ...shared,
    configure: timedSession,
    resultLimits: () => ({ planned: 0, fixed: true }),
    summary: {
      history: ({ activeMs }) => `${Math.round(activeMs / 1000)} s ativos`,
    },
  }),
};
