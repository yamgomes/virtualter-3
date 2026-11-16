import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LeanCalibration,
  normalizeLean,
  trunkLean,
} from '../src/exercise/trunkLean';
import { SurfGame } from '../src/games/surfing/surfGame';
import type { PoseFrame } from '../src/tracking/types';

function frame(degrees: number, aspectRatio = 1): PoseFrame {
  const angle = (degrees * Math.PI) / 180;
  return {
    timestamp: 0,
    aspectRatio,
    points: {
      leftHip: { x: 0.5, y: 0.7, visibility: 1 },
      leftShoulder: {
        x: 0.5 + (Math.sin(angle) * 0.3) / aspectRatio,
        y: 0.7 - Math.cos(angle) * 0.3,
        visibility: 1,
      },
    },
  };
}
test('surfe mede apenas o lado escolhido e corrige a proporção da imagem', () => {
  for (const aspect of [0.6, 1, 1.8])
    assert.ok(Math.abs(trunkLean(frame(30, aspect), 'left')! - 30) < 1e-8);
  assert.equal(trunkLean(frame(30), 'right'), null);
  const hidden = frame(30);
  hidden.points.leftHip!.visibility = 0.1;
  assert.equal(trunkLean(hidden, 'left'), null);
});
test('calibração aceita inclinação para ambos os sentidos e ignora o lado oculto', () => {
  for (const direction of [-1, 1]) {
    const calibration = new LeanCalibration();
    for (let t = 0; t <= 1800; t += 300) calibration.update(0, t);
    for (let t = 2100; t < 3900; t += 300)
      calibration.update(30 * direction, t);
    const range = calibration.update(30 * direction, 3900).result!;
    assert.deepEqual(range, { rest: 0, maximum: 30 * direction });
    assert.equal(normalizeLean(15 * direction, range), 0.5);
    assert.equal(normalizeLean(-15 * direction, range), 0);
  }
});
test('perda de pontos e alcance insuficiente impedem concluir calibração', () => {
  const calibration = new LeanCalibration();
  calibration.update(0, 0);
  calibration.update(0, 300);
  calibration.update(null, 500);
  assert.equal(calibration.update(0, 600).progress, 0);
  for (let t = 900; t <= 2400; t += 300) calibration.update(0, t);
  assert.equal(calibration.update(5, 2700).progress, 0);
  assert.equal(calibration.update(5, 3000).result, null);
});
test('surfe pontua por inclinação; repetir amostra ou perder rastreamento não pontua', () => {
  const game = new SurfGame({
    side: 'left',
    targets: [0.5],
    repetitions: 2,
    holdMs: 300,
    timeLimitMs: 600,
    tolerance: 0.1,
  });
  game.update(0.5, 0);
  game.update(0.5, 0);
  assert.equal(game.hits, 0);
  assert.equal(game.update(0.5, 300)[0].type, 'hit');
  game.update(null, 400);
  game.update(0.5, 5000);
  assert.equal(game.hits, 1);
  assert.deepEqual(
    game.update(0.5, 5300).map((e) => e.type),
    ['hit', 'completed']
  );
  assert.equal(game.attempts.length, 2);
});

test('meta mínima não encerra o tempo; acertos extras pontuam e exigem novo movimento', () => {
  const game = new SurfGame({
    side: 'left',
    targets: [0.5],
    repetitions: 1,
    holdMs: 100,
    timeLimitMs: 900,
    sessionDurationMs: 1000,
    tolerance: 0.1,
    pointsPerHit: 15,
  });
  game.update(0.5, 0);
  assert.deepEqual(
    game.update(0.5, 100).map((e) => e.type),
    ['hit']
  );
  game.update(0.5, 200);
  game.update(0.5, 300);
  assert.equal(game.hits, 1);
  game.update(0, 400);
  game.update(0.5, 500);
  assert.deepEqual(
    game.update(0.5, 600).map((e) => e.type),
    ['hit']
  );
  assert.equal(game.points, 30);
  game.update(null, 700);
  game.update(0, 2000);
  assert.equal(game.remainingMs, 400);
  assert.deepEqual(
    game.update(0, 2400).map((e) => e.type),
    ['completed']
  );
  assert.equal(game.hits, 2);
});
