import { GAME_DEFINITIONS } from '@homephysio/contracts';
import type { LeanRange } from '../../exercise/trunkLean';
import {
  LeanCalibration,
  normalizeLean,
  trunkLean,
} from '../../exercise/trunkLean';
import type { GameResult } from '../../session/types';
import type { PoseFrame } from '../../tracking/types';
import type {
  ActivityFactory,
  GameActivity,
  PreparationProgress,
} from '../contracts';
import './style.css';
import { SurfGame } from './surfGame';
import type { SurfConfig } from './surfPlan';
import { SurfScene } from './surfScene';

export class SurfActivity implements GameActivity {
  readonly version = '1.0.0';
  readonly instructions: string;
  readonly planDescription: string;
  readonly posture;
  private config: SurfConfig;
  private calibrator = new LeanCalibration();
  private calibration: LeanRange | null = null;
  private game: SurfGame;
  private scene: SurfScene | null = null;
  private panel: HTMLElement | null = null;
  private position = 0;
  private tracking = false;
  constructor(config: SurfConfig) {
    this.config = config;
    const { posture, defaults } = GAME_DEFINITIONS.surfing;
    this.posture = {
      mode: posture,
      tolerance:
        config.posture?.tolerance ?? defaults.postureTolerancePercent / 100,
    };
    this.game = new SurfGame(config);
    this.instructions = `Fique de lado, com o lado ${config.side === 'left' ? 'esquerdo' : 'direito'} voltado para a câmera. Enquadre o ombro e o quadril desse lado. Mantenha o tronco ereto; depois incline-o para a frente dentro do seu alcance confortável. Mantenha a mesma orientação durante a partida.`;
    this.planDescription = `${config.repetitions} acertos mínimos · inclinação do tronco · manter por ${config.holdMs / 1000} s · ${config.timeLimitMs / 1000} s por alvo.`;
  }
  calibrate(frame: PoseFrame | null, now: number): PreparationProgress {
    const p = this.calibrator.update(
      frame ? trunkLean(frame, this.config.side) : null,
      now
    );
    if (p.result) this.calibration = p.result;
    return {
      title:
        p.stage === 'rest'
          ? 'Fique de lado e em repouso.'
          : 'Incline o tronco para a frente.',
      message: p.message,
      progress: p.progress,
      complete: !!p.result,
    };
  }
  resetCalibration(): void {
    this.calibrator = new LeanCalibration();
    this.calibration = null;
  }
  start(stage: HTMLElement, panel: HTMLElement): void {
    if (!this.calibration) throw new Error('Calibração necessária');
    this.scene = new SurfScene(stage);
    this.panel = panel;
    panel.innerHTML = `<h1>Encontre a onda.</h1><p>Incline o tronco para mover o surfista até a faixa dourada. Volte ao repouso para retornar à esquerda.</p><p data-surf="score"></p><label for="surf-position">Sua inclinação</label><progress id="surf-position" max="1" value="0"></progress><p data-surf="target"></p><p data-surf="time"></p><p data-surf="feedback" class="tracking" aria-live="polite">Prepare-se para a primeira onda.</p>`;
    this.refresh();
  }
  update(frame: PoseFrame | null, now: number) {
    const angle = frame ? trunkLean(frame, this.config.side) : null;
    this.tracking = angle !== null;
    if (angle !== null && this.calibration)
      this.position = normalizeLean(angle, this.calibration);
    const events = this.game.update(this.tracking ? this.position : null, now);
    if (this.panel) {
      const feedback = this.panel.querySelector<HTMLElement>(
        '[data-surf="feedback"]'
      )!;
      feedback.textContent = !this.tracking
        ? 'Rastreamento pausado. Enquadre o ombro e o quadril do lado indicado.'
        : events.some((e) => e.type === 'hit')
          ? 'Boa onda! Prepare a próxima.'
          : events.some((e) => e.type === 'miss')
            ? 'A onda passou. Tente a próxima.'
            : 'Mantenha o surfista na faixa dourada.';
      this.refresh();
    }
    return {
      tracking: this.tracking,
      completed: events.some((e) => e.type === 'completed'),
      hits: this.game.hits,
    };
  }
  private refresh(): void {
    if (!this.panel) return;
    this.panel.querySelector<HTMLElement>('[data-surf="score"]')!.textContent =
      `Meta mínima: ${this.config.repetitions} · ${this.game.hits} acertos · ${this.game.points} pontos`;
    this.panel.querySelector<HTMLProgressElement>('progress')!.value =
      this.position;
    this.panel.querySelector<HTMLElement>('[data-surf="target"]')!.textContent =
      `Alvo: ${Math.round(this.game.target * 100)}% do alcance calibrado`;
    this.panel.querySelector<HTMLElement>('[data-surf="time"]')!.textContent =
      `Tempo restante: ${(this.game.remainingMs / 1000).toFixed(1)} s`;
  }
  render(now: number): void {
    this.scene?.render(
      {
        position: this.position,
        target: this.game.target,
        tolerance: this.game.tolerance,
        tracking: this.tracking,
      },
      now
    );
  }
  result(): GameResult {
    if (!this.calibration) throw new Error('Calibração necessária');
    return {
      hits: this.game.hits,
      misses: this.game.completed - this.game.hits,
      points: this.game.points,
      plannedAttempts: this.config.repetitions,
      attempts: this.game.attempts,
      calibration: { ...this.calibration },
    };
  }
  dispose(): void {
    this.scene?.dispose();
    this.scene = null;
    this.panel?.replaceChildren();
    this.panel = null;
  }
}

export const createSurfing: ActivityFactory<'surfing'> = ({ config }) =>
  new SurfActivity(config);
