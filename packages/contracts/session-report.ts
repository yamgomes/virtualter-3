import type { GameId } from './index';

export interface ShoulderRepetitions {
  left: number;
  right: number;
}

export interface LowerBodyMetrics {
  kneeHeight: { left: number; right: number };
  balance: number | null;
}

export type MovementMetrics =
  | { shoulderRepetitions: ShoulderRepetitions; lowerBody?: never }
  | { lowerBody: LowerBodyMetrics; shoulderRepetitions?: never };

export interface SessionReport {
  schemaVersion: 1;
  gameId: GameId;
  title: string;
  revision: number;
  completedAtMs: number;
  activeMs: number;
  pausedMs: number;
  endReason: 'completed' | 'stopped' | 'error';
  hits: number;
  misses: number;
  points: number;
  movement: MovementMetrics | null;
}

export function validMovementMetrics(value: unknown): value is MovementMetrics {
  if (!value || typeof value !== 'object') return false;
  const { shoulderRepetitions, lowerBody } = value as Partial<MovementMetrics>;
  if (lowerBody !== undefined) {
    const percent = (n: unknown) =>
      typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 100;
    return (
      shoulderRepetitions === undefined &&
      !!lowerBody?.kneeHeight &&
      percent(lowerBody.kneeHeight.left) &&
      percent(lowerBody.kneeHeight.right) &&
      (lowerBody.balance === null || percent(lowerBody.balance))
    );
  }
  return (
    !!shoulderRepetitions &&
    [shoulderRepetitions.left, shoulderRepetitions.right].every(
      (count) => Number.isSafeInteger(count) && count >= 0
    )
  );
}
