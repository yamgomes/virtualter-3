import type { GameActivity, PreparationProgress } from '../contracts';
import type { PoseFrame } from '../../tracking/types';
import type { ShoulderConfig } from '../../session/types';
import { AutomaticCalibration } from '../../exercise/automaticCalibration';
import type { BilateralCalibration } from '../../exercise/automaticCalibration';
import { shoulderAngle } from '../../exercise/shoulderMotion';
import { ShoulderSession } from './shoulderSession';

function measure(frame: PoseFrame | null) {
  const left = frame && shoulderAngle(frame, 'left'),
    right = frame && shoulderAngle(frame, 'right');
  return left !== null && right !== null ? { left, right } : null;
}
export class ShoulderActivity implements GameActivity {
  readonly version = '1.0.0';
  readonly instructions =
    'Fique de frente para a câmera. Enquadre os dois ombros, cotovelos e quadris. Primeiro mantenha os braços em repouso; depois levante ambos até uma altura confortável.';
  readonly planDescription: string;
  readonly posture;
  private config: ShoulderConfig;
  private calibrator = new AutomaticCalibration();
  private calibration: BilateralCalibration | null = null;
  private session: ShoulderSession | null = null;
  constructor(config: ShoulderConfig) {
    this.config = config;
    this.posture = { mode: 'front' as const, tolerance: config.posture?.tolerance ?? 0.2 };
    this.planDescription = `${config.repetitions} acertos mínimos · manter por ${config.holdMs / 1000} s · ${config.timeLimitMs / 1000} s por alvo.`;
  }
  calibrate(frame: PoseFrame | null, now: number): PreparationProgress {
    const progress = this.calibrator.update(measure(frame), now);
    if (progress.result) this.calibration = progress.result;
    return {
      title:
        progress.stage === 'rest'
          ? 'Comece em repouso.'
          : 'Encontre seu alcance.',
      message: progress.message,
      progress: progress.progress,
      complete: !!progress.result,
    };
  }
  resetCalibration(): void {
    this.calibrator = new AutomaticCalibration();
    this.calibration = null;
  }
  start(stage: HTMLElement, panel: HTMLElement): void {
    if (!this.calibration) throw new Error('Calibração necessária');
    this.session = new ShoulderSession(
      this.config,
      this.calibration,
      stage,
      panel
    );
  }
  update(frame: PoseFrame | null, now: number) {
    const angles = measure(frame);
    return {
      tracking: angles !== null,
      completed: this.session?.update(angles, now) ?? false,
    };
  }
  render(now: number): void {
    this.session?.render(now);
  }
  result() {
    if (!this.session) throw new Error('Jogo não iniciado');
    return this.session.result();
  }
  dispose(): void {
    this.session?.dispose();
    this.session = null;
  }
}
