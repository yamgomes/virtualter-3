import './style.css';
import { normalizeShoulder } from '../../exercise/shoulderMotion';
import type {
  BilateralCalibration,
  ShoulderValues,
} from '../../exercise/automaticCalibration';
import type { GameResult, ShoulderConfig } from '../../session/types';
import { ShoulderGame } from './shoulderGame';
import { ShoulderScene } from './shoulderScene';
import type { ShoulderSceneState } from './shoulderScene';

type GameScene = { update(state: ShoulderSceneState): void; dispose(): void };
type SceneFactory = (stage: HTMLElement) => GameScene;

/** Instância autocontida: controla regras, HUD e cena do jogo dos ombros. */
export class ShoulderSession {
  private game: ShoulderGame;
  private scene: GameScene;
  private calibration: BilateralCalibration;
  private stage: HTMLElement;
  private panel: HTMLElement;
  private legend: HTMLElement;
  private lastAngles: ShoulderValues | null = null;
  private trackingLost = false;
  constructor(
    plan: ShoulderConfig,
    calibration: BilateralCalibration,
    stage: HTMLElement,
    panel: HTMLElement,
    createScene: SceneFactory = (element) => new ShoulderScene(element)
  ) {
    this.game = new ShoulderGame(plan);
    this.calibration = calibration;
    this.stage = stage;
    this.panel = panel;
    this.scene = createScene(stage);
    panel.classList.add('shoulder-game-ui');
    panel.innerHTML = `<p class="eyebrow">SEMÁFORO</p><h1>Encontre a pose.</h1>
      <p>Mova os dois braços para levar as mãos do personagem aos círculos antes que o tempo acabe.</p>
      <div class="stats"><div><small>META MÍNIMA</small><strong data-field="total"></strong></div><div><small>ACERTOS</small><strong data-field="score">0</strong></div><div><small>PONTOS</small><strong data-field="points">0</strong></div></div>
      <div class="progress-label"><span>Tempo restante</span><strong data-field="time"></strong></div><progress data-field="time-progress" max="1" value="1" aria-label="Tempo restante"></progress>
      <div class="arm-target"><div class="progress-label"><span>🔵 Esquerdo · alvo <strong data-field="target-left"></strong></span><strong data-field="level-left">0%</strong></div><div class="target-track"><progress data-field="progress-left" max="1" value="0" aria-label="Posição do braço esquerdo"></progress><span data-field="marker-left" class="target-marker" aria-hidden="true"></span></div></div>
      <div class="arm-target"><div class="progress-label"><span>🔴 Direito · alvo <strong data-field="target-right"></strong></span><strong data-field="level-right">0%</strong></div><div class="target-track"><progress data-field="progress-right" max="1" value="0" aria-label="Posição do braço direito"></progress><span data-field="marker-right" class="target-marker" aria-hidden="true"></span></div></div>
      <p class="tracking" data-field="feedback" aria-live="polite">Ajuste os dois braços até os alvos.</p>`;
    this.legend = document.createElement('div');
    this.legend.className = 'stage-legend shoulder-game-legend';
    this.legend.innerHTML =
      '<span><i class="legend-blue"></i> ESQUERDO</span><span><i class="legend-pink"></i> DIREITO</span><small>Leve as mãos do personagem até os círculos</small>';
    stage.after(this.legend);
    stage.classList.add('shoulder-game-stage');
    this.refresh();
  }
  private field<T extends HTMLElement>(name: string): T {
    return this.panel.querySelector<T>(`[data-field="${name}"]`)!;
  }
  get hits(): number {
    return this.game.hits;
  }
  get points(): number {
    return this.game.points;
  }
  update(angles: ShoulderValues | null, now: number): boolean {
    if (angles) {
      this.lastAngles = angles;
      const values = {
        left: normalizeShoulder(angles.left, this.calibration.left),
        right: normalizeShoulder(angles.right, this.calibration.right),
      };
      for (const side of ['left', 'right'] as const) {
        this.field<HTMLProgressElement>(`progress-${side}`).value =
          values[side];
        this.field(`level-${side}`).textContent =
          Math.round(values[side] * 100) + '%';
      }
      if (this.trackingLost) {
        this.field('feedback').textContent =
          'Rastreamento retomado. Complete a pose.';
        this.trackingLost = false;
      }
      const events = this.game.update(values, now);
      this.refresh();
      if (events.some((event) => event.type === 'hit'))
        this.field('feedback').textContent = 'Boa pose! Prepare a próxima.';
      else if (events.some((event) => event.type === 'miss'))
        this.field('feedback').textContent =
          'Tempo esgotado. Tente a próxima pose.';
      if (events.some((event) => event.type === 'completed')) return true;
    } else {
      this.game.update(null, now);
      this.trackingLost = true;
      this.field('feedback').textContent =
        'Rastreamento pausado. Enquadre os dois ombros, cotovelos e quadris.';
    }
    return false;
  }
  render(now: number): void {
    if (!this.lastAngles) return;
    const goalAngles = {
      left:
        this.calibration.left.rest +
        (this.calibration.left.maximum - this.calibration.left.rest) *
          this.game.target.left,
      right:
        this.calibration.right.rest +
        (this.calibration.right.maximum - this.calibration.right.rest) *
          this.game.target.right,
    };
    this.scene.update({ angles: this.lastAngles, goalAngles, now });
  }
  result(): GameResult {
    return {
      hits: this.hits,
      misses: this.game.completed - this.hits,
      points: this.points,
      plannedAttempts: this.game.config.repetitions,
      attempts: this.game.attempts,
      calibration: {
        leftRest: this.calibration.left.rest,
        leftMaximum: this.calibration.left.maximum,
        rightRest: this.calibration.right.rest,
        rightMaximum: this.calibration.right.maximum,
      },
    };
  }
  private refresh(): void {
    this.field('score').textContent = String(this.game.hits);
    this.field('points').textContent = String(this.game.points);
    this.field('total').textContent = String(this.game.config.repetitions);
    for (const side of ['left', 'right'] as const) {
      this.field(`target-${side}`).textContent =
        Math.round(this.game.target[side] * 100) + '%';
      this.field(`marker-${side}`).style.left =
        this.game.target[side] * 100 + '%';
    }
    this.field<HTMLProgressElement>('time-progress').value =
      this.game.remainingMs /
      (this.game.config.sessionDurationMs ?? this.game.config.timeLimitMs);
    this.field('time').textContent =
      (this.game.remainingMs / 1000).toFixed(1).replace('.', ',') + ' s';
  }
  dispose(): void {
    this.scene.dispose();
    this.stage.classList.remove('shoulder-game-stage');
    this.legend.remove();
    this.panel.replaceChildren();
    this.panel.classList.remove('shoulder-game-ui');
  }
}
