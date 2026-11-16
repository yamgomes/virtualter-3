import type { AttemptResult } from '../session/types';
export interface TargetConfig<T> {
  targets?: readonly T[];
  repetitions: number;
  holdMs: number;
  timeLimitMs: number;
  tolerance?: number;
  sessionDurationMs?: number;
  pointsPerHit?: number;
}
export type ChallengeEvent = {
  type: 'hit' | 'miss' | 'completed';
  completed: number;
  hits: number;
  points: number;
};
/** Mecânica opcional de manter um alvo: nenhum detector ou objeto gráfico. */
export class TargetChallenge<T> {
  readonly tolerance: number;
  readonly config: TargetConfig<T>;
  private lastUpdate: number | null = null;
  private heldMs = 0;
  private wasMatching = false;
  private elapsed = 0;
  private sessionElapsed = 0;
  private finished = false;
  private requiresExit = false;
  private history: AttemptResult[] = [];
  private matches: (value: T, target: T, tolerance: number) => boolean;
  private valid: (value: T) => boolean;
  private readonly selectTarget: (index: number) => T;
  private currentTarget: T;
  constructor(
    config: TargetConfig<T>,
    valid: (value: T) => boolean,
    matches: (value: T, target: T, tolerance: number) => boolean,
    generateTarget?: () => T
  ) {
    const targets = config.targets;
    if (
      (targets ? !targets.length || !targets.every(valid) : !generateTarget) ||
      !Number.isInteger(config.repetitions) ||
      config.repetitions < 1 ||
      !Number.isFinite(config.holdMs) ||
      config.holdMs < 0 ||
      !Number.isFinite(config.timeLimitMs) ||
      config.timeLimitMs <= 0 ||
      config.holdMs > config.timeLimitMs ||
      (config.tolerance !== undefined &&
        (!Number.isFinite(config.tolerance) ||
          config.tolerance <= 0 ||
          config.tolerance > 0.5))
    )
      throw new Error('Configuração do jogo inválida');
    this.config = structuredClone(config);
    this.tolerance = config.tolerance ?? 0.12;
    this.valid = valid;
    this.matches = matches;
    const fixedTargets = this.config.targets;
    this.selectTarget = fixedTargets
      ? (index) => fixedTargets[index % fixedTargets.length]
      : generateTarget!;
    this.currentTarget = this.selectTarget(0);
  }
  get target(): T {
    return this.currentTarget;
  }
  get completed(): number {
    return this.history.length;
  }
  get hits(): number {
    return this.history.filter((a) => a.outcome === 'hit').length;
  }
  get points(): number {
    return this.hits * (this.config.pointsPerHit ?? 10);
  }
  get remainingMs(): number {
    return Math.max(
      0,
      this.config.sessionDurationMs !== undefined
        ? this.config.sessionDurationMs - this.sessionElapsed
        : this.config.timeLimitMs - this.elapsed
    );
  }
  get attempts(): AttemptResult[] {
    return this.history.map((a) => ({ ...a }));
  }
  update(value: T | null, now: number): ChallengeEvent[] {
    if (
      this.finished ||
      (this.config.sessionDurationMs === undefined &&
        this.completed >= this.config.repetitions) ||
      value === null ||
      !this.valid(value) ||
      !Number.isFinite(now)
    ) {
      this.heldMs = 0;
      this.wasMatching = false;
      this.lastUpdate = null;
      return [];
    }
    if (this.lastUpdate !== null && now <= this.lastUpdate) return [];
    const delta = this.lastUpdate === null ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;
    if (delta > 500) {
      this.heldMs = 0;
      this.wasMatching = false;
      return [];
    }
    const step = Math.min(
      delta,
      this.config.timeLimitMs - this.elapsed,
      this.config.sessionDurationMs === undefined
        ? delta
        : this.config.sessionDurationMs - this.sessionElapsed
    );
    this.elapsed += step;
    this.sessionElapsed += step;
    const rawMatch = this.matches(value, this.target, this.tolerance);
    if (!rawMatch) this.requiresExit = false;
    const matches = rawMatch && !this.requiresExit;
    this.heldMs = matches && this.wasMatching ? this.heldMs + step : 0;
    this.wasMatching = matches;
    const success = matches && this.heldMs >= this.config.holdMs;
    const expired =
      this.config.sessionDurationMs !== undefined &&
      this.sessionElapsed >= this.config.sessionDurationMs;
    if (!success && this.elapsed < this.config.timeLimitMs && !expired)
      return [];
    if (!success && expired && this.elapsed < this.config.timeLimitMs) {
      this.finished = true;
      return [
        {
          type: 'completed',
          completed: this.completed,
          hits: this.hits,
          points: this.points,
        },
      ];
    }
    this.history.push({
      index: this.completed + 1,
      outcome: success ? 'hit' : 'miss',
      activeMs: this.elapsed,
    });
    this.elapsed = 0;
    this.heldMs = 0;
    this.wasMatching = false;
    this.requiresExit = success && this.config.sessionDurationMs !== undefined;
    const event: ChallengeEvent = {
      type: success ? 'hit' : 'miss',
      completed: this.completed,
      hits: this.hits,
      points: this.points,
    };
    this.finished =
      expired ||
      (this.config.sessionDurationMs === undefined &&
        this.completed === this.config.repetitions);
    if (!this.finished) {
      this.currentTarget = this.selectTarget(this.completed);
      if (!this.config.targets) {
        this.requiresExit = success && this.matches(value, this.target, this.tolerance);
      }
    }
    return this.finished ? [event, { ...event, type: 'completed' }] : [event];
  }
}
