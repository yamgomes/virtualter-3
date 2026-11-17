import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameController } from '../src/gameController';
import { ResultOutbox } from '../src/session/resultOutbox';
import type { PoseSource } from '../src/tracking/types';
import type { PoseFrame } from '../src/tracking/types';
import type {
  SessionRepository,
  SessionPlan,
  SessionResult,
} from '../src/session/types';
import type { GameActivity } from '../src/games/contracts';
import { plan, result } from './fixtures';

class ElementStub {
  textContent = '';
  value = '';
  hidden = false;
  srcObject: unknown = null;
  videoWidth = 640;
  videoHeight = 480;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  disabled = false;
  files: { size: number; text(): Promise<string> }[] = [];
  handlers = new Map<string, (event: { preventDefault(): void }) => void>();
  classList = { toggle() {}, remove() {} };
  addEventListener(
    name: string,
    handler: (event: { preventDefault(): void }) => void
  ): void {
    this.handlers.set(name, handler);
  }
  click(name = 'click'): void {
    this.handlers.get(name)?.({ preventDefault() {} });
  }
  async play(): Promise<void> {}
  replaceChildren(): void {}
  append(): void {}
  setAttribute(): void {}
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup(withPosture = false) {
  let now = 0,
    rafId = 0,
    stopped = 0,
    initialized = 0,
    complete = false,
    rendered = 0,
    trackedUpdates = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const elements = new Map<string, ElementStub>();
  for (const match of readFileSync('index.html', 'utf8').matchAll(
    /\bid="([^"]+)"/g
  ))
    elements.set(match[1], new ElementStub());
  const events = new ElementStub();
  const documentStub = {
    hidden: false,
    getElementById: (id: string) => elements.get(id) ?? null,
    querySelector: () => elements.get('camera'),
    querySelectorAll: () => [],
    createElement: () => new ElementStub(),
    body: new ElementStub(),
    addEventListener: events.addEventListener.bind(events),
  };
  const track = {
    stop() {
      stopped++;
    },
    addEventListener() {},
  };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  const media = { getUserMedia: async () => stream };
  for (const [key, value] of Object.entries({
    document: documentStub,
    window: new ElementStub(),
    navigator: { mediaDevices: media },
    performance: { now: () => now },
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      callbacks.set(++rafId, cb);
      return rafId;
    },
    cancelAnimationFrame: (id: number) => callbacks.delete(id),
  }))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  let shoulderWidth = 0.32;
  const detector: PoseSource = {
    async initialize() {
      initialized++;
    },
    async detect() {
      if (!withPosture) return { timestamp: now, points: {}, aspectRatio: 1 };
      const point = (x: number, y: number) => ({ x, y, visibility: 1 });
      return { timestamp: now, aspectRatio: 1, points: {
        leftShoulder: point(0.5 - shoulderWidth / 2, 0.3),
        rightShoulder: point(0.5 + shoulderWidth / 2, 0.3),
        leftHip: point(0.4, 0.7), rightHip: point(0.6, 0.7),
      } } as PoseFrame;
    },
    dispose() {},
  };
  const saved: SessionResult[] = [];
  const repository: SessionRepository = {
    async getPlanByCode() {
      return structuredClone(plan);
    },
    async listResults() {
      return [];
    },
    async saveResult(r) {
      saved.push(r);
    },
  };
  const activity: GameActivity = {
    posture: withPosture ? { mode: 'front', tolerance: 0.2 } : undefined,
    version: '1.0.0',
    instructions: 'Preparação própria',
    planDescription: 'Plano próprio',
    calibrate() {
      return { title: 'Pronto', message: '', progress: 1, complete: true };
    },
    resetCalibration() {},
    start() {},
    update(frame) {
      if (frame) trackedUpdates++;
      return { tracking: !!frame, completed: complete };
    },
    render() {
      rendered++;
    },
    result() {
      return {
        hits: result.hits,
        misses: 0,
        points: 10,
        attempts: result.attempts,
        plannedAttempts: 2,
        calibration: result.calibration,
      };
    },
    dispose() {},
  };
  const controller = new GameController(
    detector,
    repository,
    () => activity,
    { setVisible() {}, update() {}, dispose() {} },
    new ResultOutbox({
      getItem() {
        return null;
      },
      setItem() {},
    })
  );
  const step = async (time: number) => {
    now = time;
    const batch = [...callbacks.values()];
    callbacks.clear();
    batch.forEach((cb) => cb(time));
    await wait();
  };
  const click = (id: string, event = 'click') => elements.get(id)!.click(event);
  const load = async () => {
    click('code-form', 'submit');
    await wait();
  };
  const start = async () => {
    await load();
    click('open-camera');
    await wait();
    await step(100);
  };
  return {
    controller,
    elements,
    media,
    stream,
    repository,
    step,
    click,
    load,
    start,
    events,
    documentStub,
    saved,
    getStopped: () => stopped,
    getInitialized: () => initialized,
    setComplete: () => {
      complete = true;
    },
    getRendered: () => rendered,
    getTrackedUpdates: () => trackedUpdates,
    setShoulderWidth: (width: number) => { shoulderWidth = width; },
  };
}

test('três segundos de postura correta iniciam a contagem sem clicar em retomar', async () => {
  const env = setup(true);
  await env.start();
  await env.step(200);
  env.setShoulderWidth(0.03);
  for (let time = 300; time <= 1500; time += 100) await env.step(time);
  assert.match(env.elements.get('status')!.textContent, /pausada/);
  assert.equal(env.elements.get('resume')!.hidden, true);
  const status = env.elements.get('status')!;
  const countdown = env.elements.get('resume-countdown-number')!;
  const updatesAtPause = env.getTrackedUpdates();
  env.setShoulderWidth(0.32);
  let time = 1500;
  while (!status.textContent.includes('Mantenha a posição') && time < 3000) {
    time += 100;
    await env.step(time);
  }
  assert.match(status.textContent, /3 segundos/);
  const startsCountdownAt = time + 3000;
  for (time += 100; time < startsCountdownAt; time += 100) await env.step(time);
  assert.equal(countdown.textContent, '');
  await env.step(startsCountdownAt);
  assert.equal(countdown.textContent, '3');
  for (time = startsCountdownAt + 100; time < startsCountdownAt + 3000; time += 100)
    await env.step(time);
  assert.equal(env.getTrackedUpdates(), updatesAtPause);
  await env.step(startsCountdownAt + 3000);
  await env.step(startsCountdownAt + 3100);
  assert.ok(env.getTrackedUpdates() > updatesAtPause);
  env.click('finish');
  await wait();
  assert.ok(env.saved[0].pausedMs > 0);
  env.controller.dispose();
});

test('câmera, preparação própria, pausa, tempo ativo e encerramento manual', async () => {
  const env = setup();
  await env.start();
  assert.equal(env.getInitialized(), 1);
  assert.equal(
    env.elements.get('preparation-instructions')!.textContent,
    'Preparação própria'
  );
  await env.step(200);
  await env.step(300);
  env.click('pause');
  await env.step(1000);
  const updatesAtPause = env.getTrackedUpdates();
  env.click('resume');
  const countdown = env.elements.get('resume-countdown-number')!;
  assert.equal(countdown.textContent, '3');
  for (let time = 1100; time <= 2000; time += 100) await env.step(time);
  assert.equal(countdown.textContent, '2');
  for (let time = 2100; time <= 3900; time += 100) await env.step(time);
  assert.equal(countdown.textContent, '1');
  assert.equal(env.getTrackedUpdates(), updatesAtPause);
  await env.step(4000);
  await env.step(4100);
  assert.ok(env.getTrackedUpdates() > updatesAtPause);
  env.click('finish');
  await wait();
  assert.equal(env.saved.length, 1);
  assert.equal(env.saved[0].endReason, 'stopped');
  assert.deepEqual(env.saved[0].plan, plan);
  assert.ok(env.saved[0].pausedMs > env.saved[0].activeMs);
  assert.ok(env.getRendered() > 0);
  assert.equal(env.elements.get('camera')!.srcObject, null);
  env.controller.dispose();
});

test('cancelar permissão pendente libera o stream quando ele chega', async () => {
  const env = setup();
  const camera = deferred<MediaStream>();
  env.media.getUserMedia = () => camera.promise;
  await env.load();
  env.click('open-camera');
  env.click('cancel');
  camera.resolve(env.stream);
  await wait();
  assert.equal(env.getStopped(), 1);
  assert.equal(env.getInitialized(), 0);
  assert.equal(env.elements.get('camera')!.srcObject, null);
  env.controller.dispose();
});

test('resposta atrasada de plano não substitui o plano mais recente', async () => {
  const env = setup();
  const first = deferred<SessionPlan | null>();
  let calls = 0;
  env.repository.getPlanByCode = () =>
    ++calls === 1
      ? first.promise
      : Promise.resolve({ ...plan, title: 'Mais recente' });
  env.click('code-form', 'submit');
  env.click('code-form', 'submit');
  await wait();
  first.resolve(plan);
  await wait();
  assert.equal(env.elements.get('plan-title')!.textContent, 'Mais recente');
  env.controller.dispose();
});

test('aba oculta pausa e não retoma automaticamente', async () => {
  const env = setup();
  await env.start();
  await env.step(200);
  env.documentStub.hidden = true;
  env.events.click('visibilitychange');
  await env.step(1000);
  env.documentStub.hidden = false;
  env.events.click('visibilitychange');
  assert.match(env.elements.get('status')!.textContent, /pausada/);
  env.click('finish');
  await wait();
  assert.ok(env.saved[0].pausedMs > 0);
  env.controller.dispose();
});

test('falha de gravação preserva resultado e reenvio usa o mesmo ID', async () => {
  const env = setup();
  let calls = 0;
  const ids: string[] = [];
  env.repository.saveResult = async (r) => {
    ids.push(r.id);
    if (++calls === 1) throw new Error('offline');
  };
  await env.start();
  env.click('finish');
  await wait();
  assert.match(env.elements.get('save-status')!.textContent, /pendente/);
  env.click('retry-save');
  await wait();
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  assert.match(env.elements.get('save-status')!.textContent, /salvos/);
  env.controller.dispose();
});


