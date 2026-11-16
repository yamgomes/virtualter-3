import { PoseFilter } from './tracking/poseFilter';
import { PoseBuffer } from './tracking/poseBuffer';
import type { PoseSource } from './tracking/types';
import { PoseOverlay } from './presentation/poseOverlay';
import type { ActivityFactory, GameActivity } from './games/contracts';
import { isSessionPlan } from './session/types';
import type {
  SessionPlan,
  SessionRepository,
  SessionResult,
} from './session/types';
import { ResultOutbox } from './session/resultOutbox';
import { SessionClock } from './session/sessionClock';
import { PostureMonitor } from './tracking/posture';

type Phase =
  | 'welcome'
  | 'loading'
  | 'plan'
  | 'opening'
  | 'camera'
  | 'calibrating'
  | 'playing'
  | 'paused'
  | 'summary';
type PosePreview = Pick<PoseOverlay, 'setVisible' | 'update' | 'dispose'>;

/** Hospeda qualquer atividade; não conhece articulações, regras ou cenas dos jogos. */
export class GameController {
  private video = document.querySelector<HTMLVideoElement>('#camera')!;
  private filter = new PoseFilter();
  private poses = new PoseBuffer();
  private overlay: PosePreview;
  private phase: Phase = 'welcome';
  private stream: MediaStream | null = null;
  private cameraGeneration = 0;
  private planGeneration = 0;
  private activity: GameActivity | null = null;
  private plan: SessionPlan | null = null;
  private clock: SessionClock | null = null;
  private sessionId = '';
  private tracking = false;
  private detector: PoseSource;
  private repository: SessionRepository;
  private createActivity: ActivityFactory;
  private outbox: ResultOutbox;
  private lastResult: SessionResult | null = null;
  private raf = 0;
  private disposed = false;
  private accessCheckAt = 0;
  private accessCheckPending = false;
  private animationTime = 0;
  private previousRender = 0;
  private audio: AudioContext | null = null;
  private lastHits = 0;
  private postureMonitor: PostureMonitor | null = null;
  private postureBlocked = false;
  private posturePause = false;
  private postureCorrectSince: number | null = null;
  private events = new AbortController();

  constructor(
    detector: PoseSource,
    repository: SessionRepository,
    createActivity: ActivityFactory,
    overlay?: PosePreview,
    outbox = new ResultOutbox()
  ) {
    this.overlay = overlay ?? new PoseOverlay(this.el('camera-preview'));
    this.detector = detector;
    this.repository = repository;
    this.createActivity = createActivity;
    this.outbox = outbox;
    this.bind();
    this.update();
    this.raf = requestAnimationFrame((now) => this.render(now));
  }
  private el<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element)
      throw new Error(`Elemento obrigatório não encontrado: #${id}`);
    return element as T;
  }
  private bind(): void {
    const options = { signal: this.events.signal };
    this.el<HTMLFormElement>('code-form').addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        void this.loadPlan();
      },
      options
    );
    this.el('change-code').addEventListener(
      'click',
      () => {
        this.planGeneration++;
        this.activity?.dispose();
        this.activity = null;
        this.plan = null;
        this.phase = 'welcome';
        this.message('');
        this.update();
      },
      options
    );
    this.el('open-camera').addEventListener(
      'click',
      () => {
        if (!this.plan) return;
        this.activity?.dispose();
        this.activity = this.createActivity(this.plan);
        this.postureMonitor = this.activity.posture
          ? new PostureMonitor(this.activity.posture)
          : null;
        this.postureBlocked = false;
        this.posturePause = false;
        this.postureCorrectSince = null;
        this.el('preparation-instructions').textContent =
          this.activity.instructions;
        this.el('calibration-instructions').textContent =
          this.activity.instructions;
        try {
          this.audio ??= new AudioContext();
          void this.audio.resume();
        } catch {
          /* Som é opcional. */
        }
        void this.openCamera(false);
      },
      options
    );
    this.el('cancel').addEventListener(
      'click',
      () => {
        const wasPlaying = !!this.clock;
        this.stopCamera();
        this.phase = wasPlaying ? 'paused' : 'plan';
        if (wasPlaying)
          this.message(
            'Reconexão cancelada. Você pode tentar novamente ou encerrar.'
          );
        this.update();
      },
      options
    );
    this.el('pause').addEventListener(
      'click',
      () => this.pause('Sessão pausada.'),
      options
    );
    this.el('resume').addEventListener(
      'click',
      () => {
        if (this.phase !== 'paused' || document.hidden || (this.postureBlocked && this.stream)) return;
        if (this.posturePause && this.stream && !this.poses.read(performance.now())) {
          this.postureBlocked = true;
          this.postureCorrectSince = null;
          this.message('Aguardando novamente a detecção da posição.');
          this.update();
          return;
        }
        if (!this.stream) {
          void this.openCamera(true);
          return;
        }
        this.posturePause = false;
        this.poses.reset();
        this.filter.reset();
        this.tracking = false;
        this.phase = 'playing';
        this.message('Aguardando um novo movimento…');
        this.update();
      },
      options
    );
    this.el('finish').addEventListener(
      'click',
      () => void this.finish('stopped'),
      options
    );
    this.el('restart').addEventListener(
      'click',
      () => {
        if (!this.plan) return;
        this.activity = this.createActivity(this.plan);
        this.phase = 'plan';
        this.message('');
        this.update();
        void this.refreshHistory();
      },
      options
    );
    this.el('retry-save').addEventListener(
      'click',
      () => void this.syncResults(),
      options
    );
    window.addEventListener('online', () => void this.syncResults(), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          if (this.phase === 'camera' && this.stream) this.beginCalibration();
          return;
        }
        if (this.phase === 'playing')
          this.pause(
            'Sessão pausada porque você saiu desta aba. Retome quando estiver pronto.'
          );
        else if (this.phase === 'calibrating') {
          this.activity?.resetCalibration();
          this.phase = 'camera';
          this.update();
        }
      },
      options
    );
    window.addEventListener(
      'pagehide',
      () => {
        if (this.phase === 'playing') this.pause('Sessão pausada.');
      },
      options
    );
    window.addEventListener('beforeunload', () => this.dispose(), options);
  }
  private async loadPlan(): Promise<void> {
    if (!['welcome', 'loading'].includes(this.phase)) return;
    const generation = ++this.planGeneration;
    this.phase = 'loading';
    this.message('Carregando atividade…');
    this.update();
    try {
      const plan = await this.repository.getPlanByCode(
        this.el<HTMLInputElement>('session-code').value
      );
      if (this.disposed || generation !== this.planGeneration) return;
      if (!isSessionPlan(plan))
        throw new Error(
          plan
            ? 'O plano recebido é inválido ou usa um jogo incompatível.'
            : 'Código inválido ou substituído. Solicite o código atual ao fisioterapeuta.'
        );
      this.plan = structuredClone(plan);
      this.accessCheckAt = 0;
      this.activity?.dispose();
      this.activity = this.createActivity(this.plan);
      this.el('plan-name').textContent = plan.displayName;
      this.el('plan-title').textContent = plan.title;
      this.el('plan-description').textContent = this.activity.planDescription;
      if (plan.metrics?.length) {
        const labels = { hits: 'acertos', misses: 'alvos não alcançados', points: 'pontuação', activeMs: 'tempo ativo', pausedMs: 'tempo em pausa' };
        this.el('plan-description').textContent += ` Métricas: ${plan.metrics.map(m => labels[m]).join(', ')}.`;
      }
      const posture = this.activity.posture;
      this.el('expected-posture').textContent = posture ? {
        front: 'De frente',
        'front-palms-up': 'De frente, palmas para cima',
        side: 'De lado',
      }[posture.mode] : 'Sem posição definida';
      this.el('preparation-instructions').textContent =
        this.activity.instructions;
      this.el('calibration-instructions').textContent =
        this.activity.instructions;
      this.lastResult = null;
      this.phase = 'plan';
      this.message('');
      this.update();
      await this.syncResults();
      await this.refreshHistory();
    } catch (error) {
      if (this.disposed || generation !== this.planGeneration) return;
      this.phase = 'welcome';
      this.message(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar a atividade.'
      );
      this.update();
    }
  }
  private async refreshHistory(): Promise<void> {
    const plan = this.plan,
      generation = this.planGeneration;
    if (!plan) return;
    const list = this.el('history-list');
    list.replaceChildren();
    try {
      const results = await this.repository.listResults(plan.patientId);
      if (this.disposed || generation !== this.planGeneration) return;
      if (!results.length) {
        list.textContent = 'Nenhuma sessão salva neste navegador.';
        return;
      }
      for (const result of results.slice(0, 5)) {
        const row = document.createElement('li'),
          title = document.createElement('strong'),
          detail = document.createElement('span');
        title.textContent = result.plan.title;
        detail.textContent = `${new Date(result.completedAt).toLocaleString('pt-BR')} · ${result.hits}/${result.plannedAttempts} acertos · ${result.endReason === 'completed' ? 'concluída' : 'interrompida'}`;
        row.append(title, detail);
        list.append(row);
      }
    } catch {
      if (generation === this.planGeneration)
        list.textContent =
          'Histórico indisponível. Você ainda pode iniciar a atividade.';
    }
  }
  private async openCamera(resume: boolean): Promise<void> {
    if (!this.plan || !this.activity || this.phase === 'opening') return;
    const generation = ++this.cameraGeneration;
    this.phase = 'opening';
    this.message('Preparando câmera e detector…');
    this.update();
    let acquired: MediaStream | null = null;
    try {
      if (this.repository.validateAccess && !(await this.repository.validateAccess(this.plan)))
        throw Error('Código substituído ou terapia atualizada. Digite novamente o código fornecido pelo fisioterapeuta.');
      if (generation !== this.cameraGeneration || this.disposed) return;
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Abra o aplicativo em localhost ou HTTPS para usar a câmera.'
        );
      acquired = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      if (generation !== this.cameraGeneration || this.disposed) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = acquired;
      this.video.srcObject = acquired;
      await this.video.play();
      if (generation !== this.cameraGeneration || this.disposed) return;
      await this.detector.initialize();
      if (generation !== this.cameraGeneration || this.disposed) return;
      this.el('camera-preview').style.aspectRatio =
        `${this.video.videoWidth || 4} / ${this.video.videoHeight || 3}`;
      for (const track of acquired.getVideoTracks())
        track.addEventListener(
          'ended',
          () => {
            if (generation !== this.cameraGeneration) return;
            if (this.clock)
              this.pause('A câmera foi desconectada. Reconecte para retomar.');
            this.stopCamera();
            this.phase = this.clock ? 'paused' : 'plan';
            this.update();
            this.message(
              'A câmera foi desconectada. Tente conectá-la novamente.'
            );
          },
          { signal: this.events.signal }
        );
      this.phase = resume ? 'paused' : 'camera';
      this.message(
        resume
          ? 'Câmera reconectada. Confira sua posição e retome.'
          : 'Câmera pronta. Confira seu enquadramento.'
      );
      this.update();
      if (!resume && !document.hidden) this.beginCalibration();
      void this.detect(generation);
    } catch (error) {
      acquired?.getTracks().forEach((t) => t.stop());
      if (generation !== this.cameraGeneration || this.disposed) return;
      this.stopCamera();
      this.phase = resume ? 'paused' : 'plan';
      this.update();
      this.message(
        `Não foi possível iniciar a câmera. ${error instanceof Error ? error.message : 'Tente novamente.'}`
      );
    }
  }
  private beginCalibration(): void {
    if (
      !this.activity ||
      !this.stream ||
      !['camera', 'calibrating'].includes(this.phase)
    )
      return;
    this.activity.resetCalibration();
    this.filter.reset();
    this.poses.reset();
    this.phase = 'calibrating';
    this.el('calibration-progress').setAttribute('value', '0');
    this.message('');
    this.update();
    this.showCalibration(this.activity.calibrate(null, performance.now()));
  }
  private showCalibration(
    progress: ReturnType<GameActivity['calibrate']>
  ): void {
    this.el('calibration-title').textContent = progress.title;
    this.el('tracking').textContent = progress.message;
    this.el<HTMLProgressElement>('calibration-progress').value =
      progress.progress;
  }
  private async detect(generation: number): Promise<void> {
    while (
      !this.disposed &&
      this.stream &&
      generation === this.cameraGeneration
    ) {
      try {
        if (
          !document.hidden &&
          (['camera', 'calibrating', 'playing'].includes(this.phase) ||
            (this.phase === 'paused' && !!this.postureMonitor))
        ) {
          const raw = await this.detector.detect();
          if (generation !== this.cameraGeneration || this.disposed) return;
          const now = performance.now();
          if (this.poses.publish(raw, now)) {
            const frame = raw ? this.filter.filter(raw) : null;
            let invalidCalibrationPosture = false;
            if (
              this.postureMonitor &&
              ['calibrating', 'playing', 'paused'].includes(this.phase)
            ) {
              const posture = this.postureMonitor.update(
                frame,
                frame?.timestamp ?? now
              );
              const warning = this.el('posture-status');
              warning.textContent =
                posture.state === 'valid' ? '' : posture.message;
              warning.dataset.state = posture.state;
              if (this.phase === 'playing' && posture.state === 'invalid') {
                this.pause('Sessão pausada para ajustar sua posição.');
                this.posturePause = true;
                this.postureBlocked = true;
                this.postureCorrectSince = null;
                warning.textContent = posture.message;
                warning.dataset.state = posture.state;
                this.update();
              } else if (this.phase === 'paused' && (this.posturePause || posture.state === 'invalid')) {
                this.posturePause = true;
                if (posture.state === 'valid' || posture.bodyAligned) {
                  this.postureCorrectSince ??= now;
                  if (now - this.postureCorrectSince >= 500) {
                    this.postureBlocked = false;
                    this.message('Posição ajustada. Você pode retomar a sessão.');
                    warning.textContent = posture.bodyAligned ? posture.message : '';
                    this.update();
                  }
                } else {
                  this.postureCorrectSince = null;
                  this.postureBlocked = true;
                  this.update();
                }
              } else if (this.phase === 'calibrating' && posture.state === 'invalid') {
                this.activity!.resetCalibration();
                this.el<HTMLProgressElement>('calibration-progress').value = 0;
                invalidCalibrationPosture = true;
              }
            }
            if (this.phase === 'calibrating' && !invalidCalibrationPosture) {
              const progress = this.activity!.calibrate(
                frame,
                frame?.timestamp ?? now
              );
              this.showCalibration(progress);
              if (progress.complete) this.startGame();
            } else if (this.phase === 'playing') {
              const status = this.activity!.update(
                frame,
                frame?.timestamp ?? now
              );
              const hits = this.activity!.result().hits;
              if (hits > this.lastHits) this.playPointSound();
              this.lastHits = hits;
              if (status.tracking && !this.tracking) this.message('');
              this.tracking = status.tracking;
              this.clock?.tick(now, this.tracking);
              if (status.completed) void this.finish('completed');
            }
            if (['camera', 'calibrating'].includes(this.phase))
              this.overlay.update(frame);
          }
        }
      } catch (error) {
        console.error('Erro na detecção:', error);
        if (this.clock)
          this.pause(
            'Falha na detecção. Reconecte a câmera para tentar novamente.'
          );
        this.stopCamera();
        this.phase = this.clock ? 'paused' : 'plan';
        this.update();
        this.message('Falha na detecção. Tente preparar a câmera novamente.');
        return;
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
    }
  }
  private startGame(): void {
    if (!this.plan || !this.activity) return;
    try {
      this.activity.start(this.el('camera-preview'), this.el('game-ui'));
      this.sessionId = crypto.randomUUID();
      this.lastHits = 0;
      this.clock = new SessionClock(performance.now());
      this.tracking = false;
      this.animationTime = 0;
      this.phase = 'playing';
      this.overlay.setVisible(false);
      this.message('');
      this.update();
    } catch (error) {
      console.error(error);
      this.activity.dispose();
      this.activity = this.createActivity(this.plan);
      this.phase = 'camera';
      this.message(
        'Não foi possível iniciar o jogo. Tente calibrar novamente.'
      );
      this.update();
    }
  }
  private render(now: number): void {
    if (this.disposed) return;
    if (this.repository.validateAccess && this.plan && ['playing', 'calibrating'].includes(this.phase) && !this.accessCheckPending && now - this.accessCheckAt >= 30000) {
      this.accessCheckAt = now;
      this.accessCheckPending = true;
      const plan = this.plan, generation = this.cameraGeneration;
      void this.repository.validateAccess(plan).then(valid => {
        if (!valid) throw Error('Código substituído ou terapia atualizada. Solicite o código atual ao profissional.');
      }).catch(() => {
        if (this.disposed || this.plan !== plan || generation !== this.cameraGeneration) return;
        this.pause('Não foi possível confirmar o acesso. Confira a conexão ou solicite o código atual.');
        this.stopCamera();
        this.phase = this.clock ? 'paused' : 'plan';
        this.message('Acesso interrompido: confira sua conexão ou digite o código atual fornecido pelo profissional.');
        this.update();
      }).finally(() => { this.accessCheckPending = false; });
    }
    if (this.phase === 'paused' && this.posturePause && !this.poses.read(now)) {
      this.postureCorrectSince = null;
      if (!this.postureBlocked) {
        this.postureBlocked = true;
        this.message('Aguardando novamente a detecção da posição.');
        this.update();
      }
    }
    if (this.phase === 'playing' && this.tracking && !this.poses.read(now)) {
      this.tracking = false;
      this.activity?.update(null, now);
      if (this.postureMonitor) {
        const posture = this.postureMonitor.update(null, now);
        this.el('posture-status').textContent = posture.message;
        this.el('posture-status').dataset.state = posture.state;
      }
    }
    this.clock?.tick(now, this.phase === 'playing' && this.tracking);
    if (['playing', 'paused'].includes(this.phase)) {
      if (this.phase === 'playing')
        this.animationTime += Math.min(
          100,
          Math.max(0, now - this.previousRender)
        );
      try {
        this.activity?.render(this.animationTime);
      } catch (error) {
        console.error(error);
        void this.finish('error');
      }
    }
    this.previousRender = now;
    this.raf = requestAnimationFrame((t) => this.render(t));
  }
  private pause(message: string): void {
    if (this.phase !== 'playing') return;
    const now = performance.now();
    this.clock?.tick(now, false);
    this.activity?.update(null, now);
    this.tracking = false;
    this.postureMonitor?.reset();
    this.phase = 'paused';
    this.message(message);
    this.update();
  }
  private async finish(endReason: SessionResult['endReason']): Promise<void> {
    if (
      !this.plan ||
      !this.activity ||
      !this.clock ||
      !['playing', 'paused'].includes(this.phase)
    )
      return;
    this.clock.tick(
      performance.now(),
      this.phase === 'playing' && this.tracking
    );
    const result: SessionResult = {
      ...this.activity.result(),
      ...this.clock.snapshot(),
      schemaVersion: 2,
      id: this.sessionId,
      patientId: this.plan.patientId,
      plan: structuredClone(this.plan),
      gameVersion: this.activity.version,
      completedAt: new Date().toISOString(),
      endReason,
    };
    this.lastResult = result;
    this.outbox.enqueue(result);
    this.el('summary-title').textContent =
      endReason === 'completed'
        ? 'Você concluiu sua sessão.'
        : endReason === 'error'
          ? 'A sessão encontrou um erro.'
          : 'Sessão encerrada por você.';
    const summaries = {
      hits: `${result.hits} acertos (meta mínima: ${result.plannedAttempts})`,
      misses: `${result.misses} alvos não alcançados`,
      points: `${result.points} pontos`,
      activeMs: `Tempo ativo: ${Math.round(result.activeMs / 1000)} s`,
      pausedMs: `Pausas: ${Math.round(result.pausedMs / 1000)} s`,
    };
    this.el('summary-text').textContent = (result.plan.metrics ?? ['hits', 'misses', 'points', 'activeMs', 'pausedMs'] as const)
      .map(metric => summaries[metric]).join(' · ');
    this.phase = 'summary';
    this.clock = null;
    this.stopCamera();
    this.activity.dispose();
    this.activity = null;
    this.overlay.setVisible(true);
    this.update();
    await this.syncResults();
  }
  private async syncResults(): Promise<void> {
    const plan = this.plan;
    if (!plan || this.disposed) return;
    const generation = this.planGeneration;
    this.el('save-status').textContent = 'Salvando resultados…';
    try {
      await this.outbox.flush(this.repository, plan.patientId);
    } catch {
      /* A fila conserva os resultados para nova tentativa. */
    }
    if (this.disposed || generation !== this.planGeneration) return;
    const pending = this.outbox.count(plan.patientId);
    const status = pending
      ? `${pending} resultado(s) pendente(s). ${this.outbox.durable ? 'Guardado(s) neste dispositivo para reenvio.' : 'Mantido(s) apenas nesta aba; tente salvar antes de fechá-la.'}`
      : 'Resultados salvos neste dispositivo.';
    this.el('save-status').textContent = status;
    this.el('pending-status').textContent = pending ? status : '';
    this.el('retry-save').hidden = pending === 0;
    if (this.lastResult && this.phase === 'summary') this.message('');
  }
  private stopCamera(): void {
    this.cameraGeneration++;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.tracking = false;
    this.poses.reset();
    this.filter.reset();
    this.postureMonitor?.reset();
    this.el('posture-status').textContent = '';
    this.overlay.update(null);
  }
  private message(text: string): void {
    this.el('status').textContent = text;
  }
  private playPointSound(): void {
    try {
      if (!this.audio || this.audio.state !== 'running') return;
      const oscillator = this.audio.createOscillator(),
        gain = this.audio.createGain();
      const start = this.audio.currentTime;
      oscillator.frequency.setValueAtTime(660, start);
      oscillator.frequency.exponentialRampToValueAtTime(880, start + 0.09);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain);
      gain.connect(this.audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      /* O jogo continua caso o navegador bloqueie o áudio. */
    }
  }
  private update(): void {
    document.body.classList.toggle(
      'camera-active',
      ['opening', 'camera', 'calibrating', 'playing', 'paused'].includes(
        this.phase
      )
    );
    document
      .querySelectorAll<HTMLElement>('[data-phase]')
      .forEach(
        (el) => (el.hidden = !el.dataset.phase!.split(' ').includes(this.phase))
      );
    this.el('resume').textContent = this.stream
      ? 'Retomar sessão'
      : 'Reconectar câmera';
    this.el<HTMLButtonElement>('resume').disabled = this.postureBlocked && !!this.stream;
    this.el<HTMLButtonElement>('access-plan').disabled =
      this.phase === 'loading';
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.planGeneration++;
    this.events.abort();
    cancelAnimationFrame(this.raf);
    this.stopCamera();
    this.activity?.dispose();
    this.activity = null;
    this.detector.dispose();
    if (this.audio) void this.audio.close();
    this.overlay.dispose();
  }
}

