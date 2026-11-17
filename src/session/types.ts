import { validMovementMetrics } from '@homephysio/contracts';
import type { MovementMetrics } from '@homephysio/contracts';
import type { ShoulderLevels } from '../exercise/shoulderInput';
import type { PostureRequirement } from '../tracking/posture';

export interface ChallengeConfig {
  repetitions: number;
  holdMs: number;
  timeLimitMs: number;
  tolerance: number;
  /** Duração total ativa; ausência preserva planos antigos por tentativa. */
  sessionDurationMs?: number;
  pointsPerHit?: number;
  posture?: PostureRequirement;
}
export interface ShoulderConfig extends ChallengeConfig {
  /** Planos antigos podem registrar uma sequência fixa. */
  targets?: ShoulderLevels[];
}
export interface SurfConfig extends ChallengeConfig {
  targets: number[];
  side: 'left' | 'right';
}
export type GoalkeeperConfig = Omit<ChallengeConfig, 'holdMs' | 'sessionDurationMs'> & {
  sessionDurationMs?: never;
};
interface PlanIdentity {
  id: string;
  version: number;
  patientId: string;
  displayName: string;
  title: string;
  metrics?: import('@homephysio/contracts').Metric[];
  intensity?: import('@homephysio/contracts').Intensity;
}
export type SessionPlan = PlanIdentity &
  (
    | { gameId: 'shoulder'; config: ShoulderConfig }
    | { gameId: 'surfing'; config: SurfConfig }
    | { gameId: 'goalkeeper'; config: GoalkeeperConfig }
  );
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
  movement?: MovementMetrics;
}
/** Implementações devem fazer upsert por result.id; o mock não autentica usuários. */
export interface SessionRepository {
  publishesResults?(plan: SessionPlan): boolean;
  validateAccess?(plan: SessionPlan): Promise<boolean>;
  getPlanByCode(code: string): Promise<SessionPlan | null>;
  listResults(patientId: string): Promise<SessionResult[]>;
  saveResult(result: SessionResult): Promise<void>;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 500;
const number = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const level = (v: unknown): v is number => number(v) && v >= 0 && v <= 1;
const count = (v: unknown): v is number =>
  number(v) && Number.isInteger(v) && v >= 0;

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
  if (value.gameId === 'goalkeeper') return c.sessionDurationMs === undefined;
  if (!number(c.holdMs) || c.holdMs < 0 || c.holdMs > c.timeLimitMs)
    return false;
  if (value.gameId === 'shoulder' && c.targets === undefined) return true;
  if (!Array.isArray(c.targets) || !c.targets.length || c.targets.length > 1000)
    return false;
  if (value.gameId === 'shoulder')
    return c.targets.every((t) => object(t) && level(t.left) && level(t.right));
  return (
    value.gameId === 'surfing' &&
    (c.side === 'left' || c.side === 'right') &&
    c.targets.every(level)
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
  const plan = value.plan;
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
    value.plannedAttempts !== plan.config.repetitions ||
    !Array.isArray(value.attempts) ||
    value.attempts.length >
      (plan.config.sessionDurationMs === undefined
        ? plan.config.repetitions
        : 10000)
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
    plan.config.sessionDurationMs === undefined &&
    value.attempts.length !== plan.config.repetitions
  )
    return false;
  if (
    !object(value.calibration) ||
    !Object.values(value.calibration).every(number)
  )
    return false;
  const c = value.calibration;
  return plan.gameId === 'shoulder' || plan.gameId === 'goalkeeper'
    ? number(c.leftRest) &&
        number(c.leftMaximum) &&
        number(c.rightRest) &&
        number(c.rightMaximum) &&
        c.leftMaximum - c.leftRest >= 15 &&
        c.rightMaximum - c.rightRest >= 15
    : number(c.rest) && number(c.maximum) && Math.abs(c.maximum - c.rest) >= 10;
}
