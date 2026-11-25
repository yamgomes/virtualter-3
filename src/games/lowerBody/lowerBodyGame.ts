import type { LowerBodyGameId, LowerBodyMetrics } from '@homephysio/contracts';
import type { AttemptResult } from '../../session/types';
import type { LowerBodyConfig } from './lowerBodyPlans';
import { LEGS } from './legTracking';
import type { KneeLevels, Leg, LegMovement } from './legTracking';

export const LIFT_HEIGHT = 0.75;

export class LowerBodyGame {
  readonly mode: LowerBodyGameId;
  readonly config: LowerBodyConfig;
  private lastUpdate: number | null = null;
  private activeMs = 0;
  private attemptMs = 0;
  private lastHitMs = -Infinity;
  private armed: Record<Leg, boolean> = { left: false, right: false };
  private recorded: AttemptResult[] = [];
  private peak: KneeLevels = { left: 0, right: 0 };
  private balanceTotal = 0;
  private balanceMs = 0;
  private lastStep: Leg | null = null;
  private contactMs: number | null = null;
  hits = 0;
  steps = 0;
  completed = false;

  constructor(mode: LowerBodyGameId, config: LowerBodyConfig) {
    this.mode = mode;
    this.config = config;
  }

  get remainingMs(): number {
    return Math.max(0, this.config.sessionDurationMs - this.activeMs);
  }

  get attempts(): AttemptResult[] {
    return [...this.recorded];
  }

  get plannedAttempts(): number {
    return this.mode === 'walking' ? 0 : this.config.repetitions;
  }

  get ball() {
    if (this.completed || this.mode !== 'kneeJuggle') return null;
    const flight = this.config.timeLimitMs;
    const contactStart = flight - Math.min(500, flight * 0.25);
    return {
      side: LEGS[this.recorded.length % LEGS.length],
      progress: Math.min(1, this.attemptMs / flight),
      contactProgress: contactStart / flight,
      ready: this.attemptMs >= contactStart && this.attemptMs <= flight,
      bounced:
        this.contactMs === null
          ? null
          : Math.min(1, (this.attemptMs - this.contactMs) / this.bounceMs),
    };
  }

  private get bounceMs(): number {
    return Math.min(450, this.config.timeLimitMs / 2);
  }

  get metrics(): LowerBodyMetrics {
    return {
      kneeHeight: {
        left: Math.round(100 * this.peak.left),
        right: Math.round(100 * this.peak.right),
      },
      balance: this.balanceMs
        ? Math.round((100 * this.balanceTotal) / this.balanceMs)
        : null,
    };
  }

  update(movement: LegMovement | null, now: number): void {
    if (this.completed) return;
    if (!movement || !Number.isFinite(now)) {
      this.lastUpdate = null;
      this.armed.left = this.armed.right = false;
      return;
    }
    if (this.lastUpdate !== null && now <= this.lastUpdate) return;
    let delta = this.lastUpdate === null ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;
    if (delta > 500) {
      this.armed.left = this.armed.right = false;
      delta = 0;
    }
    if (this.mode !== 'kneeJuggle') delta = Math.min(delta, this.remainingMs);
    this.activeMs += delta;
    this.attemptMs += delta;
    this.balanceTotal += movement.balance * delta;
    this.balanceMs += delta;

    const goal = this.mode === 'walking' ? 0.25 : LIFT_HEIGHT;
    const lifts = LEGS.filter((side) => {
      const height = movement.knees[side];
      this.peak[side] = Math.max(this.peak[side], height);
      if (height <= goal / 2) this.armed[side] = true;
      if (!this.armed[side] || height < goal) return false;
      this.armed[side] = false;
      return true;
    });

    if (this.mode === 'kneeJuggle') {
      this.updateBall(lifts);
      return;
    }
    if (this.mode === 'walking') {
      const step = lifts.find((side) => side !== this.lastStep);
      if (step) {
        this.steps++;
        this.lastStep = step;
      }
    } else if (lifts.length && this.activeMs - this.lastHitMs >= 400) {
      this.record(true);
      this.lastHitMs = this.activeMs;
    }
    this.completed = this.remainingMs === 0;
  }

  private updateBall(lifts: Leg[]): void {
    const ball = this.ball!;
    if (this.contactMs === null && ball.ready && lifts.includes(ball.side))
      this.contactMs = this.attemptMs;
    const deadline =
      this.contactMs === null
        ? this.config.timeLimitMs
        : this.contactMs + this.bounceMs;
    if (this.attemptMs < deadline) return;
    if (this.contactMs !== null) this.attemptMs = this.contactMs;
    this.record(this.contactMs !== null);
    this.contactMs = null;
    this.completed = this.recorded.length >= this.config.repetitions;
  }

  private record(hit: boolean): void {
    this.recorded.push({
      index: this.recorded.length + 1,
      outcome: hit ? 'hit' : 'miss',
      activeMs: Math.min(this.attemptMs, this.config.timeLimitMs),
    });
    if (hit) this.hits++;
    this.attemptMs = 0;
  }
}
