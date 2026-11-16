import test from 'node:test';
import assert from 'node:assert/strict';
import { ShoulderGame } from '../src/games/shoulder/shoulderGame';
import { AutomaticCalibration } from '../src/exercise/automaticCalibration';
import { createCalibration, normalizeShoulder, shoulderAngle } from '../src/exercise/shoulderMotion';
import { PoseFilter } from '../src/tracking/poseFilter';
import type { PoseFrame } from '../src/tracking/types';

const frame: PoseFrame = { timestamp: 1000, aspectRatio: 1, points: {
  leftShoulder: { x: 0.5, y: 0.4, visibility: 1 }, leftElbow: { x: 0.7, y: 0.4, visibility: 1 }, leftHip: { x: 0.5, y: 0.6, visibility: 1 },
} };
test('ângulo projetado, ausência de pontos e calibração', () => {
  assert.ok(Math.abs(shoulderAngle(frame, 'left')! - 90) < 0.001);
  assert.equal(shoulderAngle(frame, 'right'), null); assert.equal(createCalibration(20, 25), null);
  const calibration = createCalibration(20, 100)!;
  assert.equal(normalizeShoulder(60, calibration), 0.5); assert.equal(normalizeShoulder(200, calibration), 1);
});
test('calibra ambos automaticamente e exige movimento em cada braço', () => {
  const calibration = new AutomaticCalibration(600);
  calibration.update({ left: 10, right: 15 }, 0); calibration.update({ left: 10, right: 15 }, 300);
  assert.equal(calibration.update({ left: 10, right: 15 }, 600).stage, 'maximum');
  assert.equal(calibration.update({ left: 50, right: 20 }, 900).progress, 0);
  calibration.update({ left: 50, right: 65 }, 1200); calibration.update({ left: 50, right: 65 }, 1500);
  const result = calibration.update({ left: 50, right: 65 }, 1800);
  assert.equal(result.stage, 'complete'); assert.deepEqual(result.result, { left: { rest: 10, maximum: 50 }, right: { rest: 15, maximum: 65 } });
});
test('perda de rastreamento e movimento interrompem a calibração estável', () => {
  const calibration = new AutomaticCalibration(600);
  calibration.update({ left: 10, right: 10 }, 0); calibration.update({ left: 10, right: 10 }, 300);
  calibration.update(null, 400); calibration.update({ left: 10, right: 10 }, 500);
  assert.equal(calibration.update({ left: 10, right: 10 }, 800).stage, 'rest');
  assert.equal(calibration.update({ left: 20, right: 10 }, 1100).progress, 0);
});
test('filtro reinicia quando um ponto perde confiança ou há interrupção longa', () => {
  const filter = new PoseFilter(); filter.filter(frame);
  const hidden = { ...frame, timestamp: 1030, points: { ...frame.points, leftElbow: { x: 0, y: 0, visibility: 0.1 } } };
  assert.equal(filter.filter(hidden).points.leftElbow, undefined);
  const moved = { ...frame, timestamp: 1060, points: { ...frame.points, leftElbow: { x: 0.2, y: 0.4, visibility: 1 } } };
  assert.equal(filter.filter(moved).points.leftElbow?.x, 0.2);
  assert.equal(filter.filter({ ...frame, timestamp: 3000 }).points.leftElbow?.x, 0.7);
});
test('reconhece a pose dos dois braços assim que ela é mantida, antes do prazo', () => {
  const game = new ShoulderGame({ targets: [{ left: 0.5, right: 0.8 }, { left: 0.8, right: 0.5 }], repetitions: 2, holdMs: 300, timeLimitMs: 1200 });
  game.update({ left: 0.5, right: 0.8 }, 0);
  assert.equal(game.update({ left: 0.5, right: 0.8 }, 300)[0].type, 'hit');
  assert.equal(game.hits, 1); assert.equal(game.completed, 1);
  assert.deepEqual(game.target, { left: 0.8, right: 0.5 });
  game.update({ left: 0.8, right: 0.8 }, 600);
  game.update({ left: 0.8, right: 0.8 }, 900);
  game.update({ left: 0.8, right: 0.8 }, 1200);
  assert.deepEqual(game.update({ left: 0.8, right: 0.8 }, 1500).map(e => e.type), ['miss', 'completed']);
  assert.equal(game.points, 10);
});
test('perda de rastreamento pausa o prazo e reinicia a permanência', () => {
  const game = new ShoulderGame({ targets: [{ left: 0.5, right: 0.5 }], repetitions: 1, holdMs: 400, timeLimitMs: 600 });
  const pose = { left: 0.5, right: 0.5 };
  game.update(pose, 0); game.update(pose, 300); game.update(null, 400);
  game.update(pose, 5000); assert.equal(game.remainingMs, 300);
  assert.deepEqual(game.update(pose, 5300).map(e => e.type), ['miss', 'completed']);
});
test('configuração inválida é rejeitada', () => {
  assert.throws(() => new ShoulderGame({ targets: [], repetitions: 1, holdMs: 1, timeLimitMs: 1000 }));
  assert.throws(() => new ShoulderGame({ targets: [{ left: 0.2, right: 1.1 }], repetitions: 1, holdMs: 1, timeLimitMs: 1000 }));
});
