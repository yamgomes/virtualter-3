import { createCalibration } from './shoulderMotion';
import type { Calibration } from './shoulderMotion';

export interface ShoulderValues { left: number; right: number }
export interface BilateralCalibration { left: Calibration; right: Calibration }
export type CalibrationStage = 'rest' | 'maximum' | 'complete';
export interface CalibrationProgress { stage: CalibrationStage; progress: number; message: string; result?: BilateralCalibration }

/** Aguarda posições estáveis e valida a amplitude de cada ombro separadamente. */
export class AutomaticCalibration {
  private stage: CalibrationStage = 'rest';
  private anchor: ShoulderValues | null = null;
  private start: number | null = null;
  private lastTime: number | null = null;
  private rest: ShoulderValues | null = null;
  private result: BilateralCalibration | undefined;
  private readonly holdTimeMs: number;
  private readonly toleranceDegrees: number;
  constructor(holdTimeMs = 1800, toleranceDegrees = 8) { this.holdTimeMs = holdTimeMs; this.toleranceDegrees = toleranceDegrees; }
  update(angles: ShoulderValues | null, now: number): CalibrationProgress {
    if (this.stage === 'complete') return { stage: this.stage, progress: 1, message: 'Calibração concluída.', result: this.result };
    if (!angles || !Number.isFinite(angles.left) || !Number.isFinite(angles.right) || !Number.isFinite(now)) {
      this.resetHold(); return { stage: this.stage, progress: 0, message: 'Enquadre os dois ombros, cotovelos e quadris.' };
    }
    if (this.lastTime !== null && (now <= this.lastTime || now - this.lastTime > 500)) this.resetHold();
    this.lastTime = now;
    if (this.stage === 'maximum' && this.rest && (angles.left - this.rest.left < 15 || angles.right - this.rest.right < 15)) {
      this.resetHold(); return { stage: this.stage, progress: 0, message: 'Levante os dois braços até uma altura confortável e mantenha.' };
    }
    if (!this.anchor || Math.abs(angles.left - this.anchor.left) > this.toleranceDegrees || Math.abs(angles.right - this.anchor.right) > this.toleranceDegrees) {
      this.anchor = { ...angles }; this.start = now;
    }
    const progress = Math.min(1, (now - this.start!) / this.holdTimeMs);
    if (progress < 1) return { stage: this.stage, progress, message: 'Mantenha os dois braços parados por um instante.' };
    if (this.stage === 'rest') {
      this.rest = { ...angles }; this.stage = 'maximum'; this.resetHold();
      return { stage: this.stage, progress: 0, message: 'Agora levante os dois braços até uma altura confortável.' };
    }
    const left = createCalibration(this.rest!.left, angles.left), right = createCalibration(this.rest!.right, angles.right);
    if (!left || !right) { this.resetHold(); return { stage: this.stage, progress: 0, message: 'Não foi possível definir o alcance. Tente novamente.' }; }
    this.stage = 'complete'; this.result = { left, right };
    return { stage: this.stage, progress: 1, message: 'Calibração concluída.', result: this.result };
  }
  private resetHold(): void { this.anchor = null; this.start = null; this.lastTime = null; }
}
