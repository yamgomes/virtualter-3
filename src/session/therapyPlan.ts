import type { Therapy } from '@homephysio/contracts';
import { GAME_DEFINITIONS } from '@homephysio/contracts';
import type { SessionPlan } from './types';

export function therapyPlan(patientId: string, revision: number, therapy: Therapy): SessionPlan {
  const identity = {
    id: patientId,
    patientId,
    version: revision,
    displayName: 'Paciente',
    title: therapy.title,
    metrics: therapy.metrics,
    intensity: therapy.intensity,
  };
  const config = {
    repetitions: therapy.repetitions,
    timeLimitMs: therapy.targetSeconds * 1000,
    tolerance: therapy.tolerancePercent / 100,
    pointsPerHit: therapy.pointsPerHit,
    posture: {
      mode: GAME_DEFINITIONS[therapy.gameId].posture,
      tolerance: therapy.postureTolerancePercent / 100,
    },
  };
  if (therapy.gameId === 'goalkeeper') return {
    ...identity,
    gameId: 'goalkeeper',
    config,
  };

  const timedConfig = {
    ...config,
    holdMs: therapy.holdSeconds * 1000,
    sessionDurationMs: therapy.durationSeconds * 1000,
  };
  if (therapy.gameId === 'shoulder') return { ...identity, gameId: 'shoulder', config: timedConfig };
  if (therapy.gameId === 'shoulderElevation') return {
    ...identity,
    gameId: 'shoulderElevation',
    config: { ...config, timeLimitMs: Math.max(1, therapy.holdSeconds) * 1000, holdMs: therapy.holdSeconds * 1000, sets: therapy.sets, restMs: therapy.restSeconds * 1000 },
  };
  return {
    ...identity,
    gameId: 'surfing',
    config: {
      ...timedConfig,
      targets: therapy.targets.split(',').map(target => Number(target) / 100),
      side: therapy.side,
    },
  };
}
