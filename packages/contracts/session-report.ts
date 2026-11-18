export interface ShoulderRepetitions {
  left: number;
  right: number;
}

export interface MovementMetrics {
  shoulderRepetitions: ShoulderRepetitions;
}

export interface SessionReport {
  schemaVersion: 1;
  gameId: 'shoulder' | 'shoulderElevation' | 'goalkeeper';
  title: string;
  revision: number;
  completedAtMs: number;
  activeMs: number;
  pausedMs: number;
  endReason: 'completed' | 'stopped' | 'error';
  hits: number;
  misses: number;
  points: number;
  movement: MovementMetrics;
}

export function validMovementMetrics(value: unknown): value is MovementMetrics {
  if (!value || typeof value !== 'object') return false;
  const repetitions = (value as Partial<MovementMetrics>).shoulderRepetitions;
  return !!repetitions && [repetitions.left, repetitions.right].every(
    count => Number.isSafeInteger(count) && count >= 0
  );
}
