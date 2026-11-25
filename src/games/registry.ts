import type { GameId } from '@homephysio/contracts';
import type { SessionPlan } from '../session/types';
import type { ActivityFactory, GameActivity } from './contracts';
import { createShoulder } from './shoulder/shoulderActivity';
import { createSurfing } from './surfing/surfActivity';
import { createGoalkeeper } from './goalkeeper/goalkeeperActivity';
import { createShoulderElevation } from './shoulder/shoulderElevationActivity';
import { lowerBodyFactories } from './lowerBody/lowerBodyActivity';

const factories: { [Id in GameId]: ActivityFactory<Id> } = {
  shoulder: createShoulder,
  surfing: createSurfing,
  goalkeeper: createGoalkeeper,
  shoulderElevation: createShoulderElevation,
  ...lowerBodyFactories,
};

export function createActivity<Id extends GameId>(
  plan: SessionPlan<Id>
): GameActivity {
  return factories[plan.gameId](plan);
}
