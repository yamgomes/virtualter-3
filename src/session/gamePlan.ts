import { GAME_DEFINITIONS } from '@homephysio/contracts';
import type { GameId, MovementMetrics, Therapy } from '@homephysio/contracts';
import type { PostureRequirement } from '../tracking/posture';
import { number } from './validation';

export interface GameConfig {
  repetitions: number;
  timeLimitMs: number;
  tolerance: number;
  sessionDurationMs?: number;
  pointsPerHit?: number;
  posture?: PostureRequirement;
}

export interface ChallengeConfig extends GameConfig {
  holdMs: number;
}

interface ResultLimits {
  planned: number;
  fixed: boolean;
}

type ResultText = Pick<
  import('./types').SessionResult,
  'hits' | 'misses' | 'plannedAttempts' | 'attempts'
>;

export interface GamePlanOptions<Config extends GameConfig> {
  configure: (therapy: Therapy) => Config;
  acceptsConfig?: (config: Record<string, unknown>) => boolean;
  resultLimits?: (config: Config) => ResultLimits;
  acceptsCalibration?: (calibration: Record<string, unknown>) => boolean;
  acceptsMovement?: (movement: MovementMetrics | undefined) => boolean;
  summary?: {
    hits?: (result: ResultText) => string;
    misses?: (result: ResultText) => string;
  };
}

export interface GamePlanDefinition<
  Id extends GameId,
  Config extends GameConfig,
> extends Omit<GamePlanOptions<Config>, 'configure'> {
  fromTherapy: (therapy: Therapy) => { gameId: Id; config: Config };
}

export function defineGamePlan<Id extends GameId, Config extends GameConfig>(
  gameId: Id,
  { configure, ...options }: GamePlanOptions<Config>
): GamePlanDefinition<Id, Config> {
  return {
    ...options,
    fromTherapy: (therapy) => ({ gameId, config: configure(therapy) }),
  };
}

export function commonConfig(
  therapy: Therapy
): Omit<GameConfig, 'sessionDurationMs'> {
  return {
    repetitions: therapy.repetitions,
    timeLimitMs: therapy.targetSeconds * 1000,
    tolerance: therapy.tolerancePercent / 100,
    pointsPerHit: therapy.pointsPerHit,
    posture: {
      mode: GAME_DEFINITIONS[therapy.gameId].posture,
      tolerance: therapy.postureTolerancePercent / 100,
    },
  };
}

export function timedConfig(therapy: Therapy): ChallengeConfig {
  return {
    ...commonConfig(therapy),
    holdMs: therapy.holdSeconds * 1000,
    sessionDurationMs: therapy.durationSeconds * 1000,
  };
}

export function acceptsHold(config: Record<string, unknown>): boolean {
  return (
    number(config.holdMs) &&
    number(config.timeLimitMs) &&
    config.holdMs >= 0 &&
    config.holdMs <= config.timeLimitMs
  );
}

export function unitLevel(value: unknown): value is number {
  return number(value) && value >= 0 && value <= 1;
}
