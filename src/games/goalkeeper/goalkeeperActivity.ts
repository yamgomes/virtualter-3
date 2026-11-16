import './style.css';
import { ShoulderInput } from '../../exercise/shoulderInput';
import type { ShoulderAngles } from '../../exercise/automaticCalibration';
import type { GoalkeeperConfig, GameResult } from '../../session/types';
import type { PoseFrame } from '../../tracking/types';
import type { GameActivity, PreparationProgress } from '../contracts';
import { GoalkeeperGame } from './goalkeeperGame';
import { GoalkeeperScene } from './goalkeeperScene';

export class GoalkeeperActivity implements GameActivity {
  readonly version = '1.0.0';
  readonly posture;
  readonly instructions = 'Fique de frente para a câmera, com ombros, cotovelos e quadris visíveis. Comece com os braços em repouso. Depois levante cada braço até sua altura máxima confortável.';
  readonly planDescription: string;
  private readonly config: GoalkeeperConfig;
  private readonly input = new ShoulderInput();
  private game: GoalkeeperGame | null = null;
  private scene: GoalkeeperScene | null = null;
  private panel: HTMLElement | null = null;
  private angles: ShoulderAngles = { left: 0, right: 0 };
  private feedback = 'Prepare-se para o primeiro chute.';

  constructor(config: GoalkeeperConfig) {
    this.config = config;
    this.posture = { mode: 'front' as const, tolerance: config.posture?.tolerance ?? 0.2 };
    this.planDescription = `${config.repetitions} chutes · mova as luvas para defender as bolas.`;
  }

  calibrate(frame: PoseFrame | null, now: number): PreparationProgress {
    const progress = this.input.calibrate(frame, now);
    return {
      title: progress.stage === 'rest' ? 'Comece em repouso.' : 'Encontre seu alcance.',
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
    this.game = new GoalkeeperGame(this.config, range);
    this.angles = { left: range.left.rest, right: range.right.rest };
    this.scene = new GoalkeeperScene(stage);
    this.panel = panel;
    panel.innerHTML = `<p class="eyebrow">GOLEIRO</p><h1>Defenda o gol.</h1>
      <p>Mova o braço do lado da bola e leve a luva até o círculo amarelo antes que ela chegue.</p>
      <p class="goalkeeper-score" data-goalkeeper="score"></p>
      <progress data-goalkeeper="flight" max="1" value="0" aria-label="Trajeto da bola"></progress>
      <p class="tracking" data-goalkeeper="feedback" aria-live="polite"></p>
      <details class="goalkeeper-credits"><summary>Créditos dos modelos</summary>
        <p><a href="https://sketchfab.com/3d-models/female-football-player-76ad082886ae4a5fbf18d20e1af05f9f">Jogadora</a> — julietacanillas<br>
        <a href="https://sketchfab.com/3d-models/football-gates-4a6f088ff877432d8017497958b59a32">Gol</a> — Zint4r1<br>
        <a href="https://sketchfab.com/3d-models/low-poly-footballsoccer-ball-08dc7132f9f742eda7f1f9d36c52219c">Bola</a> — alex.yefremov<br>
        <a href="https://sketchfab.com/3d-models/low-poly-gloved-hand-1f5b60b45c4a43a0984042e23ced7fc6">Luva</a> — CitrusH</p>
        <p><a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Modelos redimensionados e luva espelhada na cena.</p>
      </details>`;
    this.refresh();
  }

  update(frame: PoseFrame | null, now: number) {
    const angles = this.input.read(frame);
    if (angles) this.angles = angles;
    const outcome = this.game?.update(angles, now);
    if (outcome) this.feedback = outcome === 'hit' ? 'Defesa!' : 'Gol! Prepare-se para o próximo chute.';
    this.refresh(angles !== null);
    return { tracking: angles !== null, completed: this.game?.completed ?? false };
  }

  private refresh(tracking = true): void {
    if (!this.panel || !this.game) return;
    const { hits, attempts, shot, progress } = this.game;
    this.panel.querySelector('[data-goalkeeper="score"]')!.textContent =
      `${hits} defesas · ${attempts.length} de ${this.config.repetitions} chutes`;
    this.panel.querySelector<HTMLProgressElement>('[data-goalkeeper="flight"]')!.value = progress;
    const feedback = this.panel.querySelector('[data-goalkeeper="feedback"]')!;
    const message = !tracking
      ? 'Rastreamento pausado. Enquadre os dois braços.'
      : shot ? `Chute à ${shot.side === 'left' ? 'esquerda' : 'direita'}!` : this.feedback;
    if (feedback.textContent !== message) feedback.textContent = message;
  }

  render(now: number): void {
    if (this.game) this.scene?.render(this.angles, this.game.shot, this.game.progress, now);
  }

  result(): GameResult {
    const range = this.input.calibration;
    if (!range || !this.game) throw new Error('Jogo não iniciado');
    const { hits, attempts } = this.game;
    return {
      hits,
      misses: attempts.length - hits,
      points: hits * (this.config.pointsPerHit ?? 10),
      plannedAttempts: this.config.repetitions,
      attempts: [...attempts],
      calibration: {
        leftRest: range.left.rest,
        leftMaximum: range.left.maximum,
        rightRest: range.right.rest,
        rightMaximum: range.right.maximum,
      },
    };
  }

  dispose(): void {
    this.scene?.dispose();
    this.scene = null;
    this.game = null;
    this.panel?.replaceChildren();
    this.panel = null;
  }
}
