import type {
  BilateralCalibration,
  ShoulderAngles,
} from '../../exercise/automaticCalibration';
import type { Side } from '../../exercise/shoulderMotion';
import type { AttemptResult } from '../../session/types';
import type { GoalkeeperConfig } from './goalkeeperPlan';
import type { Intensity } from '@homephysio/contracts';

const MIN_SAME_SIDE_ELEVATION_GAP = 0.4;

export interface Shot {
  side: Side;
  degrees: number;
  progress: number;
}

/** Cada chute é avaliado uma vez, no instante em que cruza a linha do gol. */
export class GoalkeeperGame {
  readonly config: GoalkeeperConfig;
  readonly attempts: AttemptResult[] = [];
  private readonly range: BilateralCalibration;
  private readonly inFlight: {
    side: Side;
    degrees: number;
    launchedAt: number;
  }[] = [];
  private readonly launchInterval: number;
  private readonly maxInFlight: number;
  private elapsed = 0;
  private nextLaunchAt = 550;
  private launched = 0;
  private lastLaunch: {
    side: Side;
    elevation: number;
    repeated: boolean;
  } | null = null;
  private lastUpdate: number | null = null;

  constructor(
    config: GoalkeeperConfig,
    range: BilateralCalibration,
    intensity?: Intensity
  ) {
    this.config = config;
    this.range = range;
    this.maxInFlight = intensity === 'high' ? 2 : 1;
    this.launchInterval =
      intensity === 'high'
        ? 500
        : config.timeLimitMs + (intensity === 'moderate' ? 0 : 1000);
  }

  get shots(): Shot[] {
    return this.inFlight.map(({ side, degrees, launchedAt }) => ({
      side,
      degrees,
      progress: (this.elapsed - launchedAt) / this.config.timeLimitMs,
    }));
  }

  get hits(): number {
    return this.attempts.filter((attempt) => attempt.outcome === 'hit').length;
  }

  get completed(): boolean {
    return this.attempts.length >= this.config.repetitions;
  }

  update(
    angles: ShoulderAngles | null,
    now: number
  ): AttemptResult['outcome'] | null {
    if (this.completed || !angles) {
      this.lastUpdate = null;
      return null;
    }
    if (this.lastUpdate !== null && now <= this.lastUpdate) return null;
    const delta = this.lastUpdate === null ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;
    if (delta > 500) return null;

    this.elapsed += delta;
    let outcome: AttemptResult['outcome'] | null = null;
    const first = this.inFlight[0];
    if (first && this.elapsed - first.launchedAt >= this.config.timeLimitMs) {
      const { side, degrees } = first;
      const { rest, maximum } = this.range[side];
      const margin = (maximum - rest) * this.config.tolerance;
      outcome = Math.abs(angles[side] - degrees) <= margin ? 'hit' : 'miss';
      this.attempts.push({
        index: this.attempts.length + 1,
        outcome,
        activeMs: this.config.timeLimitMs,
      });
      this.inFlight.shift();
    }

    if (
      this.launched < this.config.repetitions &&
      this.elapsed >= this.nextLaunchAt &&
      this.inFlight.length < this.maxInFlight
    ) {
      this.launchShot();
      this.nextLaunchAt = this.elapsed + this.launchInterval;
      this.launched++;
    }
    return outcome;
  }

  private launchShot(): void {
    const previous = this.lastLaunch;
    const pickLeft = previous?.repeated
      ? previous.side === 'right'
      : Math.random() < 0.5;
    const side = pickLeft ? 'left' : 'right';
    const repeated = previous?.side === side;
    const elevation = repeated
      ? separatedElevation(previous.elevation)
      : Math.random();
    const { rest, maximum } = this.range[side];
    this.inFlight.push({
      side,
      degrees: rest + (maximum - rest) * elevation,
      launchedAt: this.elapsed,
    });
    this.lastLaunch = { side, elevation, repeated };
  }
}

function separatedElevation(previous: number): number {
  const lowerLength = Math.max(0, previous - MIN_SAME_SIDE_ELEVATION_GAP);
  const upperStart = previous + MIN_SAME_SIDE_ELEVATION_GAP;
  const upperLength = Math.max(0, 1 - upperStart);
  const sample = Math.random() * (lowerLength + upperLength);
  if (upperLength === 0 || sample < lowerLength) return sample;
  return upperStart + (sample - lowerLength);
}
