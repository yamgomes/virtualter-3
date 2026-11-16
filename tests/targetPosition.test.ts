import test from 'node:test';
import assert from 'node:assert/strict';
import { targetPosition } from '../src/presentation/targetPosition';
import type { PoseFrame } from '../src/tracking/types';

const frame: PoseFrame = { timestamp: 1, aspectRatio: 1, points: {
  leftShoulder: { x: 0.6, y: 0.3, visibility: 1 },
  rightShoulder: { x: 0.4, y: 0.3, visibility: 1 },
  leftHip: { x: 0.6, y: 0.6, visibility: 1 },
  rightHip: { x: 0.4, y: 0.6, visibility: 1 },
  leftElbow: { x: 0.6, y: 0.5, visibility: 1 },
  rightElbow: { x: 0.4, y: 0.5, visibility: 1 },
} };
const calibration = { left: { rest: 0, maximum: 90 }, right: { rest: 0, maximum: 90 } };

test('os alvos espelhados usam a calibração individual e abrem para fora do tronco', () => {
  const targets = { left: 1, right: 1 };
  const left = targetPosition(frame, calibration, targets, 'left')!;
  const right = targetPosition(frame, calibration, targets, 'right')!;
  assert.ok(Math.abs(left.x - -0.3) < 1e-8); assert.ok(Math.abs(right.x - 0.3) < 1e-8);
  assert.ok(Math.abs(left.y - 0.2) < 1e-8); assert.ok(Math.abs(right.y - 0.2) < 1e-8);
  const rest = targetPosition(frame, calibration, { left: 0, right: 0 }, 'left')!;
  assert.ok(Math.abs(rest.x - -0.1) < 1e-8); assert.ok(Math.abs(rest.y) < 1e-8);
});
test('oculta os alvos quando faltam pontos necessários', () => {
  assert.equal(targetPosition({ ...frame, points: {} }, calibration, { left: 1, right: 1 }, 'left'), null);
});
