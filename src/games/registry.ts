import type { ActivityFactory } from './contracts';
import { ShoulderActivity } from './shoulder/shoulderActivity';
import { SurfActivity } from './surfing/surfActivity';
import { GoalkeeperActivity } from './goalkeeper/goalkeeperActivity';
import { ShoulderElevationActivity } from './shoulder/shoulderElevationActivity';
/** Único ponto de composição que conhece os jogos disponíveis. */
export const createActivity: ActivityFactory = (plan) => {
  switch (plan.gameId) {
    case 'shoulder':
      return new ShoulderActivity(plan.config);
    case 'surfing':
      return new SurfActivity(plan.config);
    case 'goalkeeper':
      return new GoalkeeperActivity(plan.config, plan.intensity);
    case 'shoulderElevation':
      return new ShoulderElevationActivity(plan.config);
  }
};
