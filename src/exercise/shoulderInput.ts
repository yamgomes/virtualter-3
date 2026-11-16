import type { PoseFrame } from '../tracking/types';
import { AutomaticCalibration } from './automaticCalibration';
import type { BilateralCalibration, ShoulderAngles } from './automaticCalibration';
import { shoulderAngle } from './shoulderMotion';

/** Níveis usados pelos alvos fixos de planos antigos. */
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

  read(frame: PoseFrame | null): ShoulderAngles | null {
    return this.range ? measure(frame) : null;
  }
}
