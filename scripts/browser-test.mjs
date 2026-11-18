import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
// Use uma instalação de Playwright disponível no ambiente, sem dependência de produção.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const errors = [];
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5180';
await mkdir('output/qa', { recursive: true });
try {
  for (const [code, mode, max, viewport] of [
    ['QWER', 'shoulder', 90, { width: 1366, height: 900 }],
    ['SURF', 'surfing', 30, { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext('2d');
      context.fillStyle = '#19334c';
      context.fillRect(0, 0, 640, 480);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async () => {
          const stream = canvas.captureStream(0),
            track = stream.getVideoTracks()[0];
          const timer = setInterval(() => {
            context.fillRect(0, 0, 640, 480);
            track.requestFrame();
          }, 50);
          track.addEventListener('ended', () => clearInterval(timer));
          return stream;
        },
      });
      window.__movement = { angle: 0, valid: true, mode: 'shoulder' };
      window.__sounds = 0;
      const startTone = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) {
        window.__sounds++;
        return startTone.apply(this, args);
      };
    });
    // Somente o ponto de composição é substituído. Controlador, filtros, sensores,
    // calibração, jogos, cenas, HTML e persistência são os módulos reais.
    await page.route('**/src/main.ts', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `
      import { GameController } from '/src/gameController.ts';
      import { MockSessionRepository } from '/src/session/mockSessionRepository.ts';
      import { createActivity } from '/src/games/registry.ts';
      const source = {
        async initialize() {}, dispose() {},
        async detect() {
          const m = window.__movement;
          if (!m.valid) return null;
          const angle = m.angle * Math.PI / 180, points = {};
          for (const side of ['left', 'right']) {
            const x = side === 'left' ? 0.65 : 0.35, sign = side === 'left' ? 1 : -1;
            points[side + 'Hip'] = { x, y: 0.7, visibility: 1 };
            points[side + 'Shoulder'] = { x: x + (m.mode === 'surfing' ? Math.sin(angle) * 0.3 : 0), y: m.mode === 'surfing' ? 0.7 - Math.cos(angle) * 0.3 : 0.4, visibility: 1 };
            points[side + 'Elbow'] = { x: x + sign * Math.sin(angle) * 0.2, y: 0.4 + Math.cos(angle) * 0.2, visibility: 1 };
          }
          return { timestamp: performance.now(), aspectRatio: 1, points };
        }
      };
      const repo = new MockSessionRepository(), load = repo.getPlanByCode.bind(repo);
      repo.getPlanByCode = async code => {
        const plan = await load(code); if (!plan) return null;
        plan.config.sessionDurationMs = 4000; plan.config.pointsPerHit = 15; plan.config.repetitions = 1; plan.config.holdMs = 200;
        plan.config.targets = plan.gameId === 'shoulder' ? [{left:0.5,right:0.5},{left:0.8,right:0.8}] : [0.5,0.8];
        return plan;
      };
      window.__controller = new GameController(source, repo, createActivity);
    `,
      })
    );
    await page.goto(origin);
    await page.evaluate((mode) => {
      window.__movement.mode = mode;
    }, mode);
    await page.locator('#session-code').fill(code);
    await page.locator('#code-form').dispatchEvent('submit');
    await page.locator('#open-camera').click();
    await page.waitForFunction(() =>
      /Encontre seu alcance|Incline o tronco/.test(
        document.querySelector('#calibration-title').textContent
      )
    );
    await page.evaluate((angle) => {
      window.__movement.angle = angle;
    }, max);
    await page.locator('#pause').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#camera-preview canvas').count(), 2);
    await page.locator('#pause').click();
    await page.locator('#resume').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      window.__movement.angle *= 0.5;
    });
    await page.screenshot({
      path: `output/qa/${mode}-paused.png`,
      fullPage: true,
    });
    await page.locator('#resume').click();
    await page.waitForFunction(
      (mode) =>
        mode === 'shoulder'
          ? document.querySelector('[data-field="score"]').textContent === '1'
          : document
              .querySelector('[data-surf="score"]')
              .textContent.includes('1 acertos'),
      mode
    );
    await page.screenshot({
      path: `output/qa/${mode}-playing.png`,
      fullPage: true,
    });
    await page.evaluate((angle) => {
      window.__movement.angle = angle;
    }, max * 0.8);
    await page.locator('#summary-title').waitFor({ state: 'visible' });
    await page.waitForFunction(() =>
      document.querySelector('#save-status').textContent.includes('salvos')
    );
    const results = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('virtualter.mock.session-results.v2'))
    );
    assert.equal(results.length, 1);
    assert.ok(results[0].hits >= 2);
    assert.ok(results[0].hits > results[0].plannedAttempts);
    assert.equal(results[0].points, results[0].hits * 15);
    assert.ok((await page.evaluate(() => window.__sounds)) >= 2);
    assert.equal(results[0].endReason, 'completed');
    assert.equal(results[0].plan.gameId, mode);
    await page.locator('#restart').click();
    assert.equal(await page.locator('#camera-preview canvas').count(), 1);
    await page.evaluate(() => window.__controller.dispose());
    await page.close();
    console.log(
      'PASS browser:',
      code,
      viewport.width,
      'px, calibração → pausa → conclusão → histórico'
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
