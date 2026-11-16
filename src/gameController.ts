import { PoseFilter } from './tracking/poseFilter';
import type { PoseSource } from './tracking/types';
import { normalizeShoulder, shoulderAngle } from './exercise/shoulderMotion';
import { AutomaticCalibration } from './exercise/automaticCalibration';
import type { BilateralCalibration, ShoulderValues } from './exercise/automaticCalibration';
import { ShoulderGame } from './exercise/shoulderGame';
import { PoseOverlay } from './presentation/poseOverlay';
import type { SessionPlan, SessionRepository } from './session/types';

type Phase = 'welcome' | 'plan' | 'camera' | 'rest' | 'maximum' | 'playing' | 'summary';

/** Coordena o fluxo do jogador. Regras de movimento e do jogo vivem em exercise/. */
export class GameController {
  private video = document.querySelector<HTMLVideoElement>('#camera')!;
  private filter = new PoseFilter();
  private overlay = new PoseOverlay(document.querySelector<HTMLElement>('.video-wrap')!);
  private phase: Phase = 'welcome';
  private stream: MediaStream | null = null;
  private trackingGeneration = 0;
  private angles: ShoulderValues | null = null;
  private calibration: BilateralCalibration | null = null;
  private calibrator = new AutomaticCalibration();
  private game: ShoulderGame | null = null;
  private startTime = 0;
  private busy = false;
  private finishing = false;
  private plan: SessionPlan | null = null;
  private detector: PoseSource;
  private repository: SessionRepository;

  constructor(detector: PoseSource, repository: SessionRepository) {
    this.detector = detector;
    this.repository = repository;
    this.bind();
  }
  private el<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
  private bind(): void {
    this.el<HTMLFormElement>('code-form').addEventListener('submit', event => { event.preventDefault(); void this.loadPlan(); });
    this.el('change-code').addEventListener('click', () => { this.phase = 'welcome'; this.message(''); this.update(); });
    this.el('open-camera').addEventListener('click', () => void this.openCamera());
    this.el('calibrate').addEventListener('click', () => {
      if (!this.plan) return;
      this.calibrator = new AutomaticCalibration(); this.filter.reset(); this.angles = null; this.phase = 'rest'; this.message(''); this.update();
    });
    this.el('cancel').addEventListener('click', () => { this.stopCamera(); this.phase = 'plan'; this.message(''); this.update(); });
    this.el('finish').addEventListener('click', () => void this.finish());
    this.el('restart').addEventListener('click', () => { this.phase = 'plan'; this.message(''); this.update(); void this.refreshHistory(); });
    this.el('retry-rest').addEventListener('click', () => { this.angles = null; this.calibrator = new AutomaticCalibration(); this.filter.reset(); this.phase = 'rest'; this.update(); });
    window.addEventListener('beforeunload', () => { this.stopCamera(); this.detector.dispose(); this.overlay.dispose(); });
  }
  private async loadPlan(): Promise<void> {
    try {
      const plan = await this.repository.getPlanByCode(this.el<HTMLInputElement>('session-code').value);
      if (!plan) { this.message('Código não encontrado na demonstração. Confira e tente novamente.'); return; }
      this.plan = plan;
      this.el('plan-name').textContent = plan.displayName;
      this.el('plan-title').textContent = plan.title;
      this.el('plan-side').textContent = 'Ambos';
      this.el('plan-repetitions').textContent = String(plan.repetitions);
      this.el('plan-targets').textContent = plan.targets.map(target => Math.round(target.left * 100) + '% / ' + Math.round(target.right * 100) + '%').join(' · ');
      this.el('plan-hold').textContent = (plan.holdMs / 1000).toLocaleString('pt-BR') + ' s';
      this.el('plan-beat').textContent = (plan.beatMs / 1000).toLocaleString('pt-BR') + ' s';
      this.message(''); this.phase = 'plan'; this.update(); await this.refreshHistory();
    } catch { this.message('Não foi possível carregar a sessão simulada. Tente novamente.'); }
  }
  private async refreshHistory(): Promise<void> {
    const list = this.el('history-list'); list.replaceChildren();
    if (!this.plan) return;
    const results = await this.repository.listResults(this.plan.patientId);
    if (!results.length) { list.textContent = 'Nenhuma sessão salva neste navegador.'; return; }
    for (const result of results.slice(0, 5)) {
      const row = document.createElement('li'); const title = document.createElement('strong'); title.textContent = result.planTitle;
      const detail = document.createElement('span'); const date = new Date(result.completedAt);
      detail.textContent = (Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-BR')) + ' · ' + result.completedTargets + '/' + result.plannedTargets + ' alvos';
      row.append(title, detail); list.append(row);
    }
  }
  private async openCamera(): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.message('Preparando câmera e detector de movimentos…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Câmera indisponível. Abra o aplicativo em localhost ou HTTPS.');
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.video.srcObject = this.stream; await this.video.play(); await this.detector.initialize();
      this.el('camera-preview').style.aspectRatio = `${this.video.videoWidth} / ${this.video.videoHeight}`;
      this.phase = 'camera'; this.message('Câmera pronta. Confira seu enquadramento.'); this.update(); void this.detect(++this.trackingGeneration);
    } catch (error) {
      this.stopCamera(); this.message(`Não foi possível iniciar. ${error instanceof Error ? error.message : 'Verifique a câmera e tente novamente.'}`);
    } finally { this.busy = false; }
  }
  private async detect(generation: number): Promise<void> {
    while (this.stream && generation === this.trackingGeneration) {
      try {
        const raw = await this.detector.detect();
        if (generation !== this.trackingGeneration) return;
        const frame = raw ? this.filter.filter(raw) : null;
        const now = frame?.timestamp ?? performance.now();
        const left = frame ? shoulderAngle(frame, 'left') : null;
        const right = frame ? shoulderAngle(frame, 'right') : null;
        this.angles = left !== null && right !== null ? { left, right } : null;
        if (this.phase === 'rest' || this.phase === 'maximum') this.updateCalibration(now);
        else if (this.phase === 'playing') {
          if (this.angles) this.play(now);
          else { this.game?.update(null, now); this.el('game-feedback').textContent = 'Rastreamento pausado. Enquadre os dois ombros, cotovelos e quadris.'; }
        }
        const game = this.phase === 'playing' && this.game && this.calibration && this.angles
          ? { calibration: this.calibration, targets: this.game.target, remaining: this.game.remainingMs / this.game.config.beatMs } : null;
        this.overlay.update(this.stream ? frame : null, game);
      } catch (error) {
        console.error('Erro na detecção:', error); this.angles = null; this.calibrator.update(null, performance.now()); this.game?.update(null, performance.now()); this.overlay.update(null);
        this.message('Falha na detecção. Encerre e tente novamente.');
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
  }
  private updateCalibration(now: number): void {
    const progress = this.calibrator.update(this.angles, now);
    if (progress.stage === 'rest' || progress.stage === 'maximum') {
      if (this.phase !== progress.stage) { this.phase = progress.stage; this.update(); }
      this.el('tracking').textContent = progress.message;
      this.el<HTMLProgressElement>('calibration-progress').value = progress.progress;
      return;
    }
    if (!progress.result || !this.plan) return;
    try { this.game = new ShoulderGame(this.plan); }
    catch { this.message('A configuração da atividade é inválida. Escolha outra sessão.'); return; }
    this.calibration = progress.result; this.startTime = performance.now();
    this.phase = 'playing'; this.message(''); this.update();
  }
  private play(now: number): void {
    if (!this.angles || !this.calibration || !this.game || this.finishing) return;
    const values = { left: normalizeShoulder(this.angles.left, this.calibration.left), right: normalizeShoulder(this.angles.right, this.calibration.right) };
    this.el<HTMLProgressElement>('progress-left').value = values.left;
    this.el<HTMLProgressElement>('progress-right').value = values.right;
    this.el('level-left').textContent = Math.round(values.left * 100) + '%';
    this.el('level-right').textContent = Math.round(values.right * 100) + '%';
    const events = this.game.update(values, now);
    this.el('score').textContent = String(this.game.hits);
    this.el('beat-count').textContent = String(Math.min(this.game.completed + 1, this.game.config.repetitions));
    this.el('points').textContent = String(this.game.points);
    this.el('target-left').textContent = Math.round(this.game.target.left * 100) + '%';
    this.el('target-right').textContent = Math.round(this.game.target.right * 100) + '%';
    this.el('marker-left').style.left = (this.game.target.left * 100) + '%';
    this.el('marker-right').style.left = (this.game.target.right * 100) + '%';
    this.el<HTMLProgressElement>('beat-progress').value = this.game.remainingMs / this.game.config.beatMs;
    this.el('beat-time').textContent = (this.game.remainingMs / 1000).toFixed(1).replace('.', ',') + ' s';
    if (events.some(event => event.type === 'completed')) { void this.finish(); return; }
    if (events.some(event => event.type === 'hit')) this.el('game-feedback').textContent = 'Boa! Prepare a próxima posição.';
    else if (events.some(event => event.type === 'miss')) this.el('game-feedback').textContent = 'Siga para a próxima posição.';
  }
  private async finish(): Promise<void> {
    if (!this.plan || !this.game || this.phase !== 'playing' || this.finishing) return;
    this.finishing = true;
    const seconds = Math.round((performance.now() - this.startTime) / 1000);
    const plan = this.plan, score = this.game.hits, points = this.game.points;
    this.el('summary-text').textContent = `${score} de ${plan.repetitions} alvos alcançados em ${Math.floor(seconds / 60)} min ${seconds % 60} s. Você fez ${points} pontos.`;
    this.el('save-status').textContent = 'Salvando resultado local…';
    this.phase = 'summary'; this.stopCamera(); this.update();
    try {
      await this.repository.saveResult({ id: crypto.randomUUID(), patientId: plan.patientId, planId: plan.id, planTitle: plan.title, completedAt: new Date().toISOString(), durationSeconds: seconds, completedTargets: score, plannedTargets: plan.repetitions });
      this.el('save-status').textContent = 'Resultado salvo apenas neste navegador.';
    } catch { this.el('save-status').textContent = 'Não foi possível salvar o resultado neste navegador.'; }
    this.finishing = false;
  }
  private stopCamera(): void {
    this.trackingGeneration++; this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null; this.video.srcObject = null; this.angles = null; this.filter.reset(); this.overlay.update(null);
  }
  private message(text: string): void { this.el('status').textContent = text; }
  private update(): void {
    document.body.classList.toggle('camera-active', ['camera', 'rest', 'maximum', 'playing'].includes(this.phase));
    document.body.classList.toggle('game-active', this.phase === 'playing');
    document.querySelectorAll<HTMLElement>('[data-phase]').forEach(el => el.hidden = !el.dataset.phase!.split(' ').includes(this.phase));
    this.el('score').textContent = String(this.game?.hits ?? 0);
    this.el('beat-count').textContent = String(Math.min((this.game?.completed ?? 0) + 1, this.plan?.repetitions ?? 1));
    this.el('planned-score').textContent = String(this.plan?.repetitions ?? 0);
    this.el('points').textContent = String(this.game?.points ?? 0);
    this.el('target-left').textContent = Math.round((this.game?.target.left ?? 0) * 100) + '%';
    this.el('target-right').textContent = Math.round((this.game?.target.right ?? 0) * 100) + '%';
    this.el('tracking').textContent = 'Aguardando movimento…';
  }
}
