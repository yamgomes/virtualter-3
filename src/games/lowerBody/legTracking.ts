import type { Landmark, PoseFrame } from '../../tracking/types';

export const LEGS = ['left', 'right'] as const;
export type Leg = (typeof LEGS)[number];
export type KneeLevels = Record<Leg, number>;

export interface StandingPose {
  leftRest: number;
  rightRest: number;
  torsoLean: number;
}

export interface LegMovement {
  knees: KneeLevels;
  balance: number;
}

export interface LegCalibration extends StandingPose {
  leftMaximum: number;
  rightMaximum: number;
}

export type LegPoseIssue =
  'frame' | 'torso' | 'leftKnee' | 'rightKnee' | 'knees' | 'distance';

type LegPoseObservation =
  | { sample: StandingPose; issue?: never }
  | { sample: null; issue: LegPoseIssue };

function inFrame(point: Landmark | undefined): point is Landmark {
  return (
    !!point &&
    [point.x, point.y, point.visibility].every(Number.isFinite) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1 &&
    point.visibility >= 0.5
  );
}

export function observeLegPose(frame: PoseFrame | null): LegPoseObservation {
  if (!frame || !Number.isFinite(frame.aspectRatio) || frame.aspectRatio <= 0)
    return { sample: null, issue: 'frame' };
  const {
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
  } = frame.points;
  if (
    !inFrame(leftShoulder) ||
    !inFrame(rightShoulder) ||
    !inFrame(leftHip) ||
    !inFrame(rightHip)
  )
    return { sample: null, issue: 'torso' };
  const leftVisible = inFrame(leftKnee);
  const rightVisible = inFrame(rightKnee);
  if (!leftVisible || !rightVisible)
    return {
      sample: null,
      issue: leftVisible ? 'rightKnee' : rightVisible ? 'leftKnee' : 'knees',
    };

  const lean =
    ((leftShoulder.x + rightShoulder.x - leftHip.x - rightHip.x) *
      frame.aspectRatio) /
    2;
  const torso = Math.hypot(
    lean,
    (leftHip.y + rightHip.y - leftShoulder.y - rightShoulder.y) / 2
  );
  if (torso < 0.04) return { sample: null, issue: 'distance' };
  return {
    sample: {
      leftRest: (leftKnee.y - leftHip.y) / torso,
      rightRest: (rightKnee.y - rightHip.y) / torso,
      torsoLean: lean / torso,
    },
  };
}

const fraction = (amount: number) => Math.min(1, Math.max(0, amount));

function kneeLift(pose: StandingPose, rest: StandingPose, side: Leg): number {
  const key = side === 'left' ? 'leftRest' : 'rightRest';
  return 1 - pose[key] / rest[key];
}

export function measureLegMovement(
  pose: StandingPose,
  rest: LegCalibration
): LegMovement {
  return {
    knees: {
      left: fraction(kneeLift(pose, rest, 'left') / rest.leftMaximum),
      right: fraction(kneeLift(pose, rest, 'right') / rest.rightMaximum),
    },
    balance: fraction(1 - Math.abs(pose.torsoLean - rest.torsoLean) / 0.45),
  };
}

export class KneeCalibration {
  private first: StandingPose | null = null;
  private rest: StandingPose | null = null;
  private since = 0;
  private last: number | null = null;
  private peak = 0;
  private loweredSince: number | null = null;
  private leftMaximum = 0;
  result: LegCalibration | null = null;

  get stage(): 'rest' | Leg {
    if (!this.rest) return 'rest';
    return this.leftMaximum === 0 ? 'left' : 'right';
  }

  get lifted(): boolean {
    return this.peak >= 0.1;
  }

  update(sample: StandingPose | null, now: number): number {
    if (this.result) return 1;
    if (this.last !== null && now <= this.last) return this.progress();
    if (
      !sample ||
      !Number.isFinite(now) ||
      (this.last !== null && now - this.last > 500)
    ) {
      this.first = null;
      this.last = null;
      this.peak = 0;
      this.loweredSince = null;
      return this.progress();
    }
    this.last = now;
    if (!this.rest) {
      this.measureRest(sample, now);
    } else {
      this.measureMaximum(
        sample,
        now,
        this.leftMaximum === 0 ? 'left' : 'right'
      );
    }
    return this.progress();
  }

  private measureRest(sample: StandingPose, now: number): void {
    if (
      sample.leftRest < 0.35 ||
      sample.rightRest < 0.35 ||
      Math.abs(sample.leftRest - sample.rightRest) > 0.2
    ) {
      this.first = null;
      return;
    }
    if (
      !this.first ||
      Math.abs(sample.leftRest - this.first.leftRest) > 0.08 ||
      Math.abs(sample.rightRest - this.first.rightRest) > 0.08 ||
      Math.abs(sample.torsoLean - this.first.torsoLean) > 0.08
    ) {
      this.first = sample;
      this.since = now;
    }
    if (now - this.since >= 1000) this.rest = sample;
  }

  private measureMaximum(sample: StandingPose, now: number, side: Leg): void {
    const height = kneeLift(sample, this.rest!, side);
    const otherHeight = kneeLift(
      sample,
      this.rest!,
      side === 'left' ? 'right' : 'left'
    );
    if (otherHeight > 0.12) {
      this.peak = 0;
      this.loweredSince = null;
      return;
    }
    this.peak = Math.max(this.peak, height);
    if (!this.lifted || height > 0.05) {
      this.loweredSince = null;
      return;
    }
    this.loweredSince ??= now;
    if (now - this.loweredSince < 200) return;
    if (side === 'left') this.leftMaximum = this.peak;
    else
      this.result = {
        ...this.rest!,
        leftMaximum: this.leftMaximum,
        rightMaximum: this.peak,
      };
    this.peak = 0;
    this.loweredSince = null;
  }

  private progress(): number {
    if (this.result) return 1;
    if (!this.rest)
      return this.first && this.last !== null
        ? (this.last - this.since) / 3000
        : 0;
    return ((this.stage === 'left' ? 1 : 2) + (this.lifted ? 0.65 : 0)) / 3;
  }
}
