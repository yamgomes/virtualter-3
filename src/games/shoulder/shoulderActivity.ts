import type {
  ActivityFactory,
  GameActivity,
  PreparationProgress,
} from '../contracts';
import { GAME_DEFINITIONS } from '@homephysio/contracts';
import type { PoseFrame } from '../../tracking/types';
import type { ShoulderConfig } from './shoulderPlans';
import { ShoulderInput } from '../../exercise/shoulderInput';
import { ShoulderSession } from './shoulderSession';

export class ShoulderActivity implements GameActivity {
  readonly version = '1.5.0';
  readonly instructions =
    'Fique de frente para a câmera. Enquadre os dois ombros, cotovelos e quadris. Primeiro mantenha os braços em repouso. Depois levante cada braço até a altura máxima que conseguir confortavelmente.';
  readonly planDescription: string;
  readonly posture;
  private config: ShoulderConfig;
  private readonly input = new ShoulderInput();
  private session: ShoulderSession | null = null;
  constructor(config: ShoulderConfig) {
    this.config = config;
    const { posture, defaults } = GAME_DEFINITIONS.shoulder;
    this.posture = {
      mode: posture,
      tolerance:
        config.posture?.tolerance ?? defaults.postureTolerancePercent / 100,
    };
    this.planDescription = `${config.repetitions} acertos mínimos · manter por ${config.holdMs / 1000} s · ${config.timeLimitMs / 1000} s por alvo.`;
  }
  calibrate(frame: PoseFrame | null, now: number): PreparationProgress {
    const progress = this.input.calibrate(frame, now);
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
    this.input.reset();
  }
  start(stage: HTMLElement, panel: HTMLElement): void {
    const range = this.input.calibration;
    if (!range) throw new Error('Calibração necessária');
    this.session = new ShoulderSession(this.config, range, stage, panel);
    this.input.startMeasurement();
  }
  update(frame: PoseFrame | null, now: number) {
    const angles = this.input.read(frame);
    const completed = this.session?.update(angles, now) ?? false;
    return {
      tracking: angles !== null,
      completed,
      hits: this.session?.hits,
    };
  }
  render(now: number): void {
    this.session?.render(now);
  }
  result() {
    if (!this.session) throw new Error('Jogo não iniciado');
    const calibration = this.input.calibration;
    if (!calibration) throw new Error('Calibração necessária');
    return {
      ...this.session.result(),
      movement: this.input.movement,
      calibration: {
        leftRest: calibration.left.rest,
        leftMaximum: calibration.left.maximum,
        rightRest: calibration.right.rest,
        rightMaximum: calibration.right.maximum,
      },
    };
  }
  dispose(): void {
    this.session?.dispose();
    this.session = null;
  }
}

export const createShoulder: ActivityFactory<'shoulder'> = ({ config }) =>
  new ShoulderActivity(config);
