import type { BilateralCalibration, ShoulderAngles } from '../../exercise/automaticCalibration';
import type { Side } from '../../exercise/shoulderMotion';
import type { AttemptResult, GoalkeeperConfig } from '../../session/types';

export interface Shot {
  side: Side;
  degrees: number;
}

/** Cada chute é avaliado uma vez, no instante em que cruza a linha do gol. */
export class GoalkeeperGame {
  readonly config: GoalkeeperConfig;
  readonly attempts: AttemptResult[] = [];
  private readonly range: BilateralCalibration;
  shot: Shot | null = null;
  private elapsed = 0;
  private waitMs = 550;
  private lastUpdate: number | null = null;

  constructor(config: GoalkeeperConfig, range: BilateralCalibration) {
    this.config = config;
    this.range = range;
  }

  get progress(): number {
    return this.elapsed / this.config.timeLimitMs;
  }

  get hits(): number {
    return this.attempts.filter((attempt) => attempt.outcome === 'hit').length;
  }

  get completed(): boolean {
    return this.attempts.length >= this.config.repetitions;
  }

  update(angles: ShoulderAngles | null, now: number): AttemptResult['outcome'] | null {
    if (this.completed || !angles) {
      this.lastUpdate = null;
      return null;
    }
    if (this.lastUpdate !== null && now <= this.lastUpdate) return null;
    const delta = this.lastUpdate === null ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;
    if (delta > 500) return null;

    if (!this.shot) {
      this.waitMs -= delta;
      if (this.waitMs > 0) return null;
      const side = Math.random() < 0.5 ? 'left' : 'right';
      const { rest, maximum } = this.range[side];
      this.shot = { side, degrees: rest + (maximum - rest) * Math.random() };
      return null;
    }

    this.elapsed += delta;
    if (this.elapsed < this.config.timeLimitMs) return null;
    const { side, degrees } = this.shot;
    const { rest, maximum } = this.range[side];
    const margin = (maximum - rest) * this.config.tolerance;
    const outcome = Math.abs(angles[side] - degrees) <= margin ? 'hit' : 'miss';
    this.attempts.push({ index: this.attempts.length + 1, outcome, activeMs: this.config.timeLimitMs });
    this.shot = null;
    this.elapsed = 0;
    this.waitMs = 450 + Math.random() * 500;
    return outcome;
  }
}
