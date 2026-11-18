import type { ShoulderRepetitions } from '@homephysio/contracts';
import type { PoseFrame } from '../tracking/types';
import { MAX_POSE_AGE_MS } from '../tracking/poseBuffer';
import type { BilateralCalibration } from './automaticCalibration';
import { normalizeShoulder, shoulderAngle } from './shoulderMotion';

/** Conta a subida perto do máximo uma vez, após o braço voltar a uma posição mais baixa. */
export class ShoulderRepetitionCounter {
  private readonly armed = { left: false, right: false };
  private readonly counts = { left: 0, right: 0 };
  private readonly range: BilateralCalibration;
  private lastTimestamp: number | null = null;

  constructor(range: BilateralCalibration) {
    this.range = range;
  }

  update(frame: PoseFrame | null): void {
    if (
      !frame ||
      (this.lastTimestamp !== null &&
        frame.timestamp - this.lastTimestamp > MAX_POSE_AGE_MS)
    ) {
      this.armed.left = this.armed.right = false;
    }
    this.lastTimestamp = frame?.timestamp ?? null;
    for (const side of ['left', 'right'] as const) {
      const angle = frame ? shoulderAngle(frame, side) : null;
      if (angle === null) {
        this.armed[side] = false;
        continue;
      }
      const level = normalizeShoulder(angle, this.range[side]);
      if (level <= 0.7) this.armed[side] = true;
      else if (level >= 0.9 && this.armed[side]) {
        this.counts[side]++;
        this.armed[side] = false;
      }
    }
  }

  result(): ShoulderRepetitions {
    return { ...this.counts };
  }
}
