import type {
  ActivityFactory,
  GameActivity,
  PreparationProgress,
} from '../contracts';
import { ShoulderInput } from '../../exercise/shoulderInput';
import { normalizeShoulder } from '../../exercise/shoulderMotion';
import type { PoseFrame } from '../../tracking/types';
import type { GameResult } from '../../session/types';
import type { ShoulderElevationConfig } from './shoulderPlans';

type Stage = 'raise' | 'hold' | 'lower' | 'rest' | 'done';

/** Exercício bilateral simples: eleva, mantém, retorna e descansa entre séries. */
export class ShoulderElevationActivity implements GameActivity {
  readonly version = '1.0.0';
  readonly instructions =
    'Fique de frente para a câmera. Enquadre os dois ombros, cotovelos e quadris. Eleve os dois braços ao mesmo tempo até a altura confortável e depois retorne à posição de repouso.';
  readonly planDescription: string;
  readonly posture = { mode: 'front' as const, tolerance: 0.2 };
  private readonly input = new ShoulderInput();
  private readonly config: ShoulderElevationConfig;
  private stage: Stage = 'raise';
  private panel?: HTMLElement;
  private reps = 0;
  private set = 1;
  private holdStarted: number | null = null;
  private restStarted = 0;
  private lostAt: number | null = null;
  private feedback = 'Eleve os dois braços até a altura confortável.';
  private attempts: GameResult['attempts'] = [];
  private currentNow = 0;
  private armed = false;

  constructor(config: ShoulderElevationConfig) {
    this.config = config;
    this.planDescription = `${config.sets} séries de ${config.repetitions} repetições · manter no alto por ${config.holdMs / 1000} s · descanso de ${config.restMs / 1000} s.`;
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

  start(_stage: HTMLElement, panel: HTMLElement): void {
    if (!this.input.calibration) throw new Error('Calibração necessária');
    this.panel = panel;
    panel.classList.add('shoulder-elevation-ui');
    panel.innerHTML = `<h1>Elevação de ombros</h1>
      <p data-field="feedback" aria-live="polite"></p>
      <div class="stats"><div><small>SÉRIE</small><strong data-field="set"></strong></div><div><small>REPETIÇÕES</small><strong data-field="reps"></strong></div></div>
      <div class="progress-label"><span data-field="phase"></span><strong data-field="timer"></strong></div>
      <progress data-field="progress" max="1" value="0" aria-label="Progresso do movimento"></progress>`;
    this.refresh(0);
    this.input.startMeasurement();
  }

  update(frame: PoseFrame | null, now: number) {
    this.currentNow = now;
    const angles = this.input.read(frame);
    if (!frame) {
      if (this.lostAt === null) this.lostAt = now;
      this.holdStarted = null;
      if (this.stage === 'hold') this.stage = 'raise';
      return { tracking: false, completed: this.stage === 'done' };
    }
    if (this.lostAt !== null) {
      if (this.stage === 'rest') this.restStarted += now - this.lostAt;
      this.lostAt = null;
    }
    if (!angles) return { tracking: false, completed: false };
    const range = this.input.calibration!;
    const elevated =
      normalizeShoulder(angles.left, range.left) >= 0.8 &&
      normalizeShoulder(angles.right, range.right) >= 0.8;
    const lowered =
      normalizeShoulder(angles.left, range.left) <= 0.55 &&
      normalizeShoulder(angles.right, range.right) <= 0.55;

    if (this.stage === 'rest') {
      if (now - this.restStarted >= this.config.restMs) {
        this.set++;
        this.reps = 0;
        this.stage = 'raise';
        this.feedback = 'Descanso concluído. Comece a próxima série.';
      }
    } else if (this.stage === 'raise' && elevated && this.armed) {
      this.stage = this.config.holdMs > 0 ? 'hold' : 'lower';
      this.holdStarted = now;
      this.feedback =
        this.stage === 'hold'
          ? 'Mantenha os braços elevados.'
          : 'Retorne devagar à posição de repouso.';
    } else if (this.stage === 'hold') {
      if (!elevated) {
        this.stage = 'raise';
        this.holdStarted = null;
        this.feedback = 'Mantenha os dois braços elevados pelo tempo indicado.';
      } else if (
        this.holdStarted !== null &&
        now - this.holdStarted >= this.config.holdMs
      ) {
        this.stage = 'lower';
        this.feedback = 'Boa! Retorne os braços à posição de repouso.';
      }
    } else if (this.stage === 'lower' && lowered) {
      this.attempts.push({
        index: this.attempts.length + 1,
        outcome: 'hit',
        activeMs: this.config.holdMs,
      });
      this.reps++;
      this.holdStarted = null;
      this.armed = false;
      if (this.reps >= this.config.repetitions) {
        if (this.set >= this.config.sets) {
          this.stage = 'done';
          this.feedback = 'Atividade concluída. Muito bem!';
        } else if (this.config.restMs > 0) {
          this.stage = 'rest';
          this.restStarted = now;
          this.feedback = 'Série concluída. Descanse.';
        } else {
          this.set++;
          this.reps = 0;
          this.stage = 'raise';
          this.feedback = 'Comece a próxima série.';
        }
      } else {
        this.stage = 'raise';
        this.feedback = 'Boa repetição! Eleve os dois braços novamente.';
      }
    }
    if (this.stage === 'raise' && lowered) this.armed = true;
    this.refresh(now);
    return {
      tracking: true,
      completed: this.stage === 'done',
      hits: this.attempts.length,
    };
  }

  render(_now: number): void {
    if (this.panel) this.refresh(this.currentNow);
  }

  result(): GameResult {
    const hits = this.attempts.length;
    const calibration = this.input.calibration!;
    return {
      hits,
      misses: 0,
      points: hits * (this.config.pointsPerHit ?? 10),
      plannedAttempts: this.config.repetitions * this.config.sets,
      attempts: this.attempts,
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
    this.panel?.replaceChildren();
    this.panel?.classList.remove('shoulder-elevation-ui');
    this.panel = undefined;
  }

  private refresh(now: number): void {
    if (!this.panel) return;
    this.panel.querySelector('[data-field="feedback"]')!.textContent =
      this.feedback;
    this.panel.querySelector('[data-field="set"]')!.textContent =
      `${Math.min(this.set, this.config.sets)} / ${this.config.sets}`;
    this.panel.querySelector('[data-field="reps"]')!.textContent =
      `${this.reps} / ${this.config.repetitions}`;
    const phase = this.panel.querySelector('[data-field="phase"]')!;
    const timer = this.panel.querySelector('[data-field="timer"]')!;
    const progress = this.panel.querySelector<HTMLProgressElement>(
      '[data-field="progress"]'
    )!;
    if (this.stage === 'rest') {
      const elapsed = Math.max(0, now - this.restStarted);
      phase.textContent = 'Descanso';
      timer.textContent = `${Math.max(0, (this.config.restMs - elapsed) / 1000).toFixed(1)} s`;
      progress.value = Math.min(1, elapsed / Math.max(1, this.config.restMs));
    } else if (this.stage === 'hold') {
      const elapsed = Math.max(0, now - (this.holdStarted ?? now));
      phase.textContent = 'Mantenha no alto';
      timer.textContent = `${Math.max(0, (this.config.holdMs - elapsed) / 1000).toFixed(1)} s`;
      progress.value = Math.min(1, elapsed / Math.max(1, this.config.holdMs));
    } else {
      phase.textContent =
        this.stage === 'done'
          ? 'Concluído'
          : this.stage === 'lower'
            ? 'Retorne os braços'
            : 'Eleve os braços';
      timer.textContent = this.stage === 'done' ? '✓' : '';
      progress.value = this.stage === 'done' ? 1 : 0;
    }
  }
}

export const createShoulderElevation: ActivityFactory<'shoulderElevation'> = ({
  config,
}) => new ShoulderElevationActivity(config);
