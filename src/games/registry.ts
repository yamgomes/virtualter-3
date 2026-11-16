import type { ActivityFactory } from './contracts';
import { ShoulderActivity } from './shoulder/shoulderActivity';
import { SurfActivity } from './surfing/surfActivity';
/** Único ponto de composição que conhece os jogos disponíveis. */
export const createActivity: ActivityFactory = (plan) => {
  switch (plan.gameId) {
    case 'shoulder':
      return new ShoulderActivity(plan.config);
    case 'surfing':
      return new SurfActivity(plan.config);
  }
};
