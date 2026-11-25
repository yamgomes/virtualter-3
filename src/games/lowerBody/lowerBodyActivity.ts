import { GAME_DEFINITIONS } from '@homephysio/contracts';
import type { LowerBodyGameId } from '@homephysio/contracts';
import type { GameResult } from '../../session/types';
import type { LowerBodyConfig } from './lowerBodyPlans';
import type { PoseFrame } from '../../tracking/types';
import type {
  ActivityFactory,
  GameActivity,
  PreparationProgress,
} from '../contracts';
import {
  KneeCalibration,
  measureLegMovement,
  observeLegPose,
} from './legTracking';
import type { LegMovement, LegPoseIssue } from './legTracking';
import { LIFT_HEIGHT, LowerBodyGame } from './lowerBodyGame';
import { LowerBodyScene } from './lowerBodyScene';
import './style.css';

const INSTRUCTIONS: Record<LowerBodyGameId, string> = {
  kneeRaise:
    'Eleve um joelho de cada vez até atingir 75% da altura calibrada. Abaixe-o antes de levantar de novo.',
  kneeJuggle:
    'Eleve o joelho indicado até 75% da altura calibrada quando a marca ficar dourada.',
  walking:
    'Dê passos no lugar, alternando os pés, para avançar pela faixa central.',
};

const framingHelp: Record<LegPoseIssue, string> = {
  frame: 'Fique de frente e enquadre dos ombros até logo abaixo dos joelhos.',
  torso: 'Ajuste a câmera para mostrar os dois ombros e os quadris.',
  leftKnee:
    'O joelho esquerdo não foi detectado. Ajuste a câmera para enquadrar os dois joelhos.',
  rightKnee:
    'O joelho direito não foi detectado. Ajuste a câmera para enquadrar os dois joelhos.',
  knees:
    'Os joelhos não foram detectados. Incline a câmera um pouco para baixo ou afaste-se até que apareçam na prévia.',
  distance:
    'Aproxime-se um pouco, mantendo os ombros e os dois joelhos no quadro.',
};

export class LowerBodyActivity implements GameActivity {
  readonly usesCameraPreview: boolean;
  readonly version = '1.0.0';
  readonly posture;
  readonly instructions =
    'Fique de frente e enquadre dos ombros até logo abaixo dos joelhos. Os pés podem ficar fora da imagem. Comece em repouso, com os dois pés no chão. Depois eleve cada joelho, um de cada vez, até a maior altura confortável e abaixe-o.';
  readonly planDescription: string;
  private calibration = new KneeCalibration();
  private movement: LegMovement = { knees: { left: 0, right: 0 }, balance: 1 };
  private readonly game: LowerBodyGame;
  private panel: HTMLElement | null = null;
  private scene: LowerBodyScene | null = null;

  constructor(mode: LowerBodyGameId, config: LowerBodyConfig) {
    this.usesCameraPreview = mode === 'kneeRaise';
    const { posture, defaults } = GAME_DEFINITIONS[mode];
    this.posture = {
      mode: posture,
      tolerance:
        config.posture?.tolerance ?? defaults.postureTolerancePercent / 100,
    };
    this.game = new LowerBodyGame(mode, config);
    const seconds = config.sessionDurationMs / 1000;
    this.planDescription =
      mode === 'kneeRaise'
        ? `Meta de ${config.repetitions} levantamentos em ${seconds} s de atividade.`
        : mode === 'kneeJuggle'
          ? `${config.repetitions} bolas, com ${config.timeLimitMs / 1000} s de queda por bola.`
          : `${seconds} s de caminhada pela faixa central.`;
  }

  resetCalibration(): void {
    this.calibration = new KneeCalibration();
  }

  calibrate(frame: PoseFrame | null, now: number): PreparationProgress {
    const { sample, issue } = observeLegPose(frame);
    const progress = this.calibration.update(sample, now);
    const { stage, lifted, result } = this.calibration;
    const side = stage === 'left' ? 'esquerdo' : 'direito';
    return {
      title:
        stage === 'rest'
          ? 'Fique em pé, de frente.'
          : `Calibre o joelho ${side}.`,
      message: issue
        ? framingHelp[issue]
        : stage === 'rest'
          ? 'Mantenha os dois pés no chão e aguarde.'
          : lifted
            ? 'Ao chegar à maior altura confortável, abaixe o joelho para confirmar.'
            : `Eleve o joelho ${side} até a maior altura confortável e mantenha o outro pé no chão.`,
      progress,
      complete: result !== null,
    };
  }

  start(stage: HTMLElement, panel: HTMLElement): void {
    if (!this.calibration.result) throw new Error('Calibração necessária');
    const { mode } = this.game;
    if (mode !== 'kneeRaise') this.scene = new LowerBodyScene(stage, mode);
    this.panel = panel;
    panel.innerHTML = `<h1>${GAME_DEFINITIONS[mode].label}</h1>
      <p>${INSTRUCTIONS[mode]}</p>
      <p data-leg="score"></p>
      <label class="progress-label" for="knee-left">Joelho esquerdo <output data-leg="left-value"></output></label>
      <progress id="knee-left" max="1" value="0"></progress>
      <label class="progress-label" for="knee-right">Joelho direito <output data-leg="right-value"></output></label>
      <progress id="knee-right" max="1" value="0"></progress>
      <label class="progress-label" for="leg-balance">Equilíbrio estimado <output data-leg="balance-value"></output></label>
      <progress id="leg-balance" max="1" value="0"></progress>
      <p class="tracking" data-leg="feedback" aria-live="polite"></p>
      ${
        mode === 'kneeJuggle'
          ? `<details class="lower-body-credits"><summary>Créditos do modelo</summary>
      <p><a href="https://sketchfab.com/3d-models/low-poly-footballsoccer-ball-08dc7132f9f742eda7f1f9d36c52219c">Bola</a> de alex.yefremov · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Modelo redimensionado.</p></details>`
          : ''
      }`;
    this.refresh(null);
  }

  update(frame: PoseFrame | null, now: number) {
    const { sample, issue } = observeLegPose(frame);
    const rest = this.calibration.result;
    const movement = sample && rest ? measureLegMovement(sample, rest) : null;
    if (movement) this.movement = movement;
    this.game.update(movement, now);
    this.refresh(movement, issue);
    return {
      tracking: movement !== null,
      completed: this.game.completed,
      hits: this.game.hits,
    };
  }

  private refresh(movement: LegMovement | null, issue?: LegPoseIssue): void {
    if (!this.panel) return;
    const { mode, hits, remainingMs, ball, plannedAttempts } = this.game;
    const time = `${Math.ceil(remainingMs / 1000)} s restantes`;
    const score =
      mode === 'kneeRaise'
        ? `${hits} levantamentos · meta ${plannedAttempts} · ${time}`
        : mode === 'kneeJuggle'
          ? `${hits} toques · ${this.game.attempts.length} de ${plannedAttempts} bolas`
          : time;
    this.panel.querySelector('[data-leg="score"]')!.textContent = score;
    const values = {
      left: movement?.knees.left,
      right: movement?.knees.right,
      balance: movement?.balance,
    };
    for (const key of ['left', 'right', 'balance'] as const) {
      const value = values[key];
      const progress = this.panel.querySelector<HTMLProgressElement>(
        key === 'balance' ? '#leg-balance' : `#knee-${key}`
      )!;
      progress.value = value ?? 0;
      this.panel.querySelector(`[data-leg="${key}-value"]`)!.textContent =
        value === undefined ? '—' : `${Math.round(value * 100)}%`;
    }
    let message = '';
    if (issue) {
      message = `Rastreamento pausado. ${framingHelp[issue]}`;
    } else if (ball) {
      const side = ball.side === 'left' ? 'esquerdo' : 'direito';
      message =
        ball.bounced !== null
          ? 'Toque certo!'
          : ball.ready
            ? `Agora! Joelho ${side}.`
            : `Prepare o joelho ${side}.`;
    } else if (movement && mode === 'kneeRaise') {
      message =
        Math.max(movement.knees.left, movement.knees.right) >= LIFT_HEIGHT
          ? 'Abaixe o joelho para repetir.'
          : hits >= plannedAttempts
            ? 'Meta de levantamentos atingida.'
            : '';
    }
    const feedback = this.panel.querySelector('[data-leg="feedback"]')!;
    if (feedback.textContent !== message) feedback.textContent = message;
  }

  render(now: number): void {
    this.scene?.render(this.movement.knees, this.game, now);
  }

  result(): GameResult {
    const calibration = this.calibration.result;
    if (!calibration) throw new Error('Calibração necessária');
    const { hits, attempts, plannedAttempts, config } = this.game;
    return {
      hits,
      misses: attempts.length - hits,
      points: hits * (config.pointsPerHit ?? 10),
      plannedAttempts,
      attempts,
      calibration: { ...calibration },
      movement: { lowerBody: this.game.metrics },
    };
  }

  dispose(): void {
    this.scene?.dispose();
    this.scene = null;
    this.panel?.replaceChildren();
    this.panel = null;
  }
}

const createLowerBody: ActivityFactory<LowerBodyGameId> = ({
  gameId,
  config,
}) => new LowerBodyActivity(gameId, config);

export const lowerBodyFactories = {
  kneeRaise: createLowerBody,
  kneeJuggle: createLowerBody,
  walking: createLowerBody,
};
