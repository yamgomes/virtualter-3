import type { PoseFrame } from '../tracking/types';
import { AutomaticCalibration } from './automaticCalibration';
import type { BilateralCalibration } from './automaticCalibration';
import { normalizeShoulder, shoulderAngle } from './shoulderMotion';

/** Elevação de cada braço em [0, 1]. Zero é repouso e um é elevação completa. */
export interface ShoulderLevels {
  left: number;
  right: number;
}

function measure(frame: PoseFrame | null) {
  if (!frame) return null;
  const left = shoulderAngle(frame, 'left');
  const right = shoulderAngle(frame, 'right');
  return left !== null && right !== null ? { left, right } : null;
}

export class ShoulderInput {
  private calibrator = new AutomaticCalibration();
  private range?: BilateralCalibration;

  get calibration() {
    return this.range;
  }

  calibrate(frame: PoseFrame | null, now: number) {
    const progress = this.calibrator.update(measure(frame), now);
    this.range = progress.result;
    return progress;
  }

  reset(): void {
    this.calibrator = new AutomaticCalibration();
    this.range = undefined;
  }

  read(frame: PoseFrame | null): ShoulderLevels | null {
    const angles = measure(frame);
    if (!angles || !this.range) return null;
    return {
      left: normalizeShoulder(angles.left, this.range.left),
      right: normalizeShoulder(angles.right, this.range.right),
    };
  }
}
