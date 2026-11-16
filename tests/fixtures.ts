import type { SessionPlan, SessionResult } from '../src/session/types';
export const plan: SessionPlan = {
  id: 'p',
  version: 1,
  patientId: 'jogador-demo',
  displayName: 'Jogador',
  title: 'Ombros',
  gameId: 'shoulder',
  config: {
    targets: [{ left: 0.5, right: 0.5 }],
    repetitions: 2,
    holdMs: 100,
    timeLimitMs: 1000,
    tolerance: 0.12,
  },
};
export const result: SessionResult = {
  schemaVersion: 2,
  id: 'one',
  patientId: plan.patientId,
  plan,
  gameVersion: '1.0.0',
  completedAt: '2026-01-01T00:00:00.000Z',
  durationMs: 1000,
  activeMs: 600,
  pausedMs: 400,
  endReason: 'stopped',
  hits: 1,
  misses: 0,
  points: 10,
  plannedAttempts: 2,
  attempts: [{ index: 1, outcome: 'hit', activeMs: 100 }],
  calibration: { leftRest: 0, rightRest: 0, leftMaximum: 90, rightMaximum: 90 },
};
