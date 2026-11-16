import test from 'node:test';
import assert from 'node:assert/strict';
import { observePosture, PostureMonitor } from '../src/tracking/posture';
import type { PoseFrame } from '../src/tracking/types';

const point = (x: number, y: number, visibility = 1) => ({ x, y, visibility });
const frame = (width: number, aspectRatio = 1): PoseFrame => ({
  timestamp: 0,
  aspectRatio,
  points: {
    leftShoulder: point(0.5 - width / (2 * aspectRatio), 0.3),
    rightShoulder: point(0.5 + width / (2 * aspectRatio), 0.3),
    leftHip: point(0.5 - width / (2 * aspectRatio), 0.7),
    rightHip: point(0.5 + width / (2 * aspectRatio), 0.7),
  },
});
test('estima frente e lado em projeção e considera proporção da imagem', () => {
  for (const aspect of [0.6, 1, 1.8]) {
    assert.equal(
      observePosture(frame(0.32, aspect), { mode: 'front', tolerance: 0.2 })
        .state,
      'valid'
    );
    assert.equal(
      observePosture(frame(0.32, aspect), { mode: 'side', tolerance: 0.2 })
        .state,
      'invalid'
    );
    assert.equal(
      observePosture(frame(0.08, aspect), { mode: 'side', tolerance: 0.2 })
        .state,
      'valid'
    );
    assert.equal(
      observePosture(frame(0.08, aspect), { mode: 'front', tolerance: 0.2 })
        .state,
      'invalid'
    );
  }
});
test('tolerância ajusta o limite sem tratar pontos ausentes como violação', () => {
  const partial = frame(0.22);
  delete partial.points.rightShoulder;
  assert.equal(
    observePosture(partial, { mode: 'side', tolerance: 0 }).state,
    'unknown'
  );
  assert.equal(
    observePosture(frame(0.22), { mode: 'side', tolerance: 0 }).state,
    'invalid'
  );
  assert.equal(
    observePosture(frame(0.22), { mode: 'side', tolerance: 0.4 }).state,
    'valid'
  );
  const hidden = frame(0.3);
  hidden.points.leftHip!.visibility = 0.2;
  assert.equal(
    observePosture(hidden, { mode: 'front', tolerance: 0 }).state,
    'unknown'
  );
});
test('palmas não são classificadas com dados insuficientes', () => {
  assert.equal(
    observePosture(frame(0.32), { mode: 'front-palms-up', tolerance: 0.2 })
      .state,
    'unknown'
  );
  assert.equal(
    observePosture(frame(0.08), { mode: 'front-palms-up', tolerance: 0.2 })
      .state,
    'invalid'
  );
});
test('alerta de violação exige permanência e reinicia após perda de rastreamento', () => {
  const monitor = new PostureMonitor({ mode: 'front', tolerance: 0.2 }, 500);
  assert.equal(monitor.update(frame(0.08), 0).state, 'unknown');
  assert.equal(monitor.update(frame(0.08), 499).state, 'unknown');
  assert.equal(monitor.update(frame(0.08), 500).state, 'invalid');
  assert.equal(monitor.update(null, 600).state, 'unknown');
  assert.equal(monitor.update(frame(0.08), 700).state, 'unknown');
  assert.equal(monitor.update(frame(0.32), 800).state, 'valid');
});
