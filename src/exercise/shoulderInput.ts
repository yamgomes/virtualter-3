import type { PoseFrame } from '../tracking/types';
import { AutomaticCalibration } from './automaticCalibration';
import type {
  BilateralCalibration,
  ShoulderAngles,
} from './automaticCalibration';
import { shoulderAngle } from './shoulderMotion';
import { ShoulderRepetitionCounter } from './shoulderRepetitions';

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
  private repetitions?: ShoulderRepetitionCounter;

  get calibration() {
    return this.range;
  }

  startMeasurement(): void {
    const range = this.calibrator.measuredRange;
    this.repetitions = range ? new ShoulderRepetitionCounter(range) : undefined;
  }

  get movement() {
    return (
      this.repetitions && { shoulderRepetitions: this.repetitions.result() }
    );
  }

  calibrate(frame: PoseFrame | null, now: number) {
    const progress = this.calibrator.update(measure(frame), now);
    this.range = progress.result;
    return progress;
  }

  reset(): void {
    this.calibrator = new AutomaticCalibration();
    this.range = undefined;
    this.repetitions = undefined;
  }

  read(frame: PoseFrame | null): ShoulderAngles | null {
    this.repetitions?.update(frame);
    return this.range ? measure(frame) : null;
  }
}
