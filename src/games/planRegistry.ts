import type { GameId, Therapy } from '@homephysio/contracts';
import type { GameConfig, GamePlanDefinition } from '../session/gamePlan';
import { goalkeeperPlan } from './goalkeeper/goalkeeperPlan';
import { lowerBodyPlans } from './lowerBody/lowerBodyPlans';
import { shoulderPlans } from './shoulder/shoulderPlans';
import { surfingPlan } from './surfing/surfPlan';

const plans = {
  ...shoulderPlans,
  surfing: surfingPlan,
  goalkeeper: goalkeeperPlan,
  ...lowerBodyPlans,
} satisfies {
  [Id in GameId]: {
    fromTherapy: (therapy: Therapy) => { gameId: Id; config: GameConfig };
  };
};

type Configs = {
  [Id in GameId]: ReturnType<(typeof plans)[Id]['fromTherapy']>['config'];
};

export type PlanGame<Id extends GameId = GameId> = {
  [Key in Id]: { gameId: Key; config: Configs[Key] };
}[Id];

export const gamePlans: {
  [Id in GameId]: GamePlanDefinition<Id, Configs[Id]>;
} = plans;

export function resultLimits<Id extends GameId>({
  gameId,
  config,
}: PlanGame<Id>) {
  const base: GameConfig = config;
  return (
    gamePlans[gameId].resultLimits?.(config) ?? {
      planned: base.repetitions,
      fixed: base.sessionDurationMs === undefined,
    }
  );
}
