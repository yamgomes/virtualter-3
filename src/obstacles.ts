// Sistema de obstáculos para grade 5x5
// Os blocos representam paredes que o usuário deve desviar


export type Block = { x: number; y: number };

export const OBSTACLE_PATTERNS: Record<string, Block[]> = {
  WALL_T_HOLE: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }
  ],
  WALL_VERTICAL_HOLE: [
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 },
    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 },
    { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 },
    { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }
  ],
  WALL_HORIZONTAL_HOLE: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
    { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ],
  WALL_L_SHAPE: [
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 },
    { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ],
  WALL_U_SHAPE: [
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 },
    { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 },
    { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }
  ],
  WALL_CROSS: [
    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 3 }, { x: 2, y: 4 }
  ],
  MAZE_SIMPLE: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: 2 },
    { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ],
  WALL_MULTI_HOLES: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 0, y: 1 }, { x: 4, y: 1 },
    { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 2 },
    { x: 0, y: 3 }, { x: 4, y: 3 },
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ]
};

export function getRandomObstaclePattern(): Block[] {
  const keys = Object.keys(OBSTACLE_PATTERNS);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return OBSTACLE_PATTERNS[randomKey];
}


