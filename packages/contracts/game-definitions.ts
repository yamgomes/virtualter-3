import { lowerBodyDefinitions } from './games/lowerBody';
import { shoulderDefinitions } from './games/shoulder';
import { surfingDefinitions } from './games/surfing';
import { goalkeeperDefinitions } from './games/goalkeeper';
import type { GameDefinition } from './game-definition';

export {
  DEFAULT_GOALKEEPER_FLIGHT_MS,
  NUMERIC_LIMITS,
} from './game-definition';
export type {
  GameDefinition,
  TherapyField,
  TherapySettings,
} from './game-definition';

const definitions = {
  ...lowerBodyDefinitions,
  ...shoulderDefinitions,
  ...surfingDefinitions,
  ...goalkeeperDefinitions,
};

export const GAME_DEFINITIONS: Record<
  keyof typeof definitions,
  GameDefinition
> = definitions;
