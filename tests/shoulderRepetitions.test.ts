import assert from 'node:assert/strict';
import test from 'node:test';
import { ShoulderRepetitionCounter } from '../src/exercise/shoulderRepetitions';
import type { PoseFrame } from '../src/tracking/types';

function pose(timestamp: number, left: number, right: number): PoseFrame {
  const point = (x: number, y: number) => ({ x, y, visibility: 1 });
  const l = left * Math.PI / 180;
  const r = right * Math.PI / 180;
  return { timestamp, aspectRatio: 1, points: {
    leftShoulder: point(0.35, 0.35), rightShoulder: point(0.65, 0.35),
    leftHip: point(0.35, 0.65), rightHip: point(0.65, 0.65),
    leftElbow: point(0.35 - 0.2 * Math.sin(l), 0.35 + 0.2 * Math.cos(l)),
    rightElbow: point(0.65 + 0.2 * Math.sin(r), 0.35 + 0.2 * Math.cos(r)),
  } };
}

test('conta cada elevação em relação ao máximo daquele ombro sem duplicar na pausa', () => {
  const counter = new ShoulderRepetitionCounter({
    left: { rest: 10, maximum: 60 }, right: { rest: 10, maximum: 110 },
  });
  counter.update(pose(0, 60, 110)); // Posição alta ao sair da calibração.
  counter.update(pose(100, 20, 20));
  counter.update(pose(200, 57, 57));
  counter.update(pose(300, 56, 105));
  assert.deepEqual(counter.result(), { left: 1, right: 1 });

  counter.update(pose(400, 46, 105));
  counter.update(pose(500, 58, 105));
  counter.update(pose(600, 42, 20));
  counter.update(null);
  counter.update(pose(1000, 58, 105));
  assert.deepEqual(counter.result(), { left: 1, right: 1 });

  counter.update(pose(1100, 42, 20));
  counter.update(pose(1800, 58, 105)); // Pausa de rastreamento entre leituras.
  assert.deepEqual(counter.result(), { left: 1, right: 1 });
  counter.update(pose(1900, 42, 20));
  counter.update(pose(2000, 58, 105));
  assert.deepEqual(counter.result(), { left: 2, right: 2 });
});
