import { isGameId, validMovementMetrics } from '@homephysio/contracts';
import type { GameId, MovementMetrics } from '@homephysio/contracts';
import { gamePlans, resultLimits } from '../games/planRegistry';
import type { PlanGame } from '../games/planRegistry';
import { count, number, object } from './validation';

interface PlanIdentity {
  id: string;
  version: number;
  patientId: string;
  displayName: string;
  title: string;
  metrics?: import('@homephysio/contracts').Metric[];
  intensity?: import('@homephysio/contracts').Intensity;
}
export type SessionPlan<Id extends GameId = GameId> = PlanIdentity &
  PlanGame<Id>;
export interface AttemptResult {
  index: number;
  outcome: 'hit' | 'miss';
  activeMs: number;
}
export interface GameResult {
  hits: number;
  misses: number;
  points: number;
  plannedAttempts: number;
  attempts: AttemptResult[];
  calibration: Record<string, number>;
  movement?: MovementMetrics;
}
export interface SessionResult extends GameResult {
  schemaVersion: 2;
  id: string;
  patientId: string;
  plan: SessionPlan;
  gameVersion: string;
  completedAt: string;
  durationMs: number;
  activeMs: number;
  pausedMs: number;
  endReason: 'completed' | 'stopped' | 'error';
}
/** Implementações devem fazer upsert por result.id; o mock não autentica usuários. */
export interface SessionRepository {
  publishesResults?(plan: SessionPlan): boolean;
  validateAccess?(plan: SessionPlan): Promise<boolean>;
  getPlanByCode(code: string): Promise<SessionPlan | null>;
  saveResult(result: SessionResult): Promise<void>;
}
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 500;

/** Fronteira de dados: tipos TypeScript não validam respostas da rede. */
export function isSessionPlan(value: unknown): value is SessionPlan {
  if (
    !object(value) ||
    !['id', 'patientId', 'displayName', 'title'].every((k) => text(value[k])) ||
    !count(value.version) ||
    value.version < 1 ||
    !object(value.config)
  )
    return false;
  const c = value.config;
  if (
    c.posture !== undefined &&
    (!object(c.posture) ||
      !['front', 'front-palms-up', 'side'].includes(String(c.posture.mode)) ||
      !number(c.posture.tolerance) ||
      c.posture.tolerance < 0 ||
      c.posture.tolerance > 1)
  )
    return false;
  if (
    c.sessionDurationMs !== undefined &&
    (!number(c.sessionDurationMs) ||
      c.sessionDurationMs < 1000 ||
      c.sessionDurationMs > 3600000)
  )
    return false;
  if (
    c.pointsPerHit !== undefined &&
    (!count(c.pointsPerHit) || c.pointsPerHit > 1000)
  )
    return false;
  if (
    !count(c.repetitions) ||
    c.repetitions < 1 ||
    c.repetitions > 1000 ||
    !number(c.timeLimitMs) ||
    c.timeLimitMs <= 0 ||
    c.timeLimitMs > 3600000 ||
    !number(c.tolerance) ||
    c.tolerance <= 0 ||
    c.tolerance > 0.5
  )
    return false;
  return (
    isGameId(value.gameId) &&
    (gamePlans[value.gameId].acceptsConfig?.(c) ?? true)
  );
}
export function isSessionResult(value: unknown): value is SessionResult {
  if (
    !object(value) ||
    value.schemaVersion !== 2 ||
    !text(value.id) ||
    !text(value.patientId) ||
    !isSessionPlan(value.plan) ||
    value.patientId !== value.plan.patientId ||
    !text(value.gameVersion) ||
    !text(value.completedAt) ||
    (value.movement !== undefined && !validMovementMetrics(value.movement)) ||
    !Number.isFinite(Date.parse(value.completedAt))
  )
    return false;
  const { plan } = value;
  const game = gamePlans[plan.gameId];
  const limits = resultLimits(plan);
  if (game.acceptsMovement && !game.acceptsMovement(value.movement))
    return false;
  if (
    !['completed', 'stopped', 'error'].includes(String(value.endReason)) ||
    !['durationMs', 'activeMs', 'pausedMs'].every(
      (k) => number(value[k]) && value[k] >= 0
    )
  )
    return false;
  if (
    Math.abs(
      (value.activeMs as number) +
        (value.pausedMs as number) -
        (value.durationMs as number)
    ) > 1
  )
    return false;
  if (
    !count(value.hits) ||
    !count(value.misses) ||
    !count(value.points) ||
    value.plannedAttempts !== limits.planned ||
    !Array.isArray(value.attempts) ||
    value.attempts.length > (limits.fixed ? limits.planned : 10000)
  )
    return false;
  if (
    !value.attempts.every(
      (a, i) =>
        object(a) &&
        a.index === i + 1 &&
        (a.outcome === 'hit' || a.outcome === 'miss') &&
        number(a.activeMs) &&
        a.activeMs >= 0 &&
        a.activeMs <= plan.config.timeLimitMs
    )
  )
    return false;
  if (
    value.hits !== value.attempts.filter((a) => a.outcome === 'hit').length ||
    value.misses !== value.attempts.filter((a) => a.outcome === 'miss').length
  )
    return false;
  if (
    value.endReason === 'completed' &&
    limits.fixed &&
    value.attempts.length !== value.plannedAttempts
  )
    return false;
  if (
    !object(value.calibration) ||
    !Object.values(value.calibration).every(number)
  )
    return false;
  return game.acceptsCalibration?.(value.calibration) ?? true;
}
