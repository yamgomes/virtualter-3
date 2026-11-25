import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultTherapy } from '@homephysio/contracts';
import {
  KneeCalibration,
  measureLegMovement,
  observeLegPose,
} from '../src/games/lowerBody/legTracking';
import { LowerBodyGame } from '../src/games/lowerBody/lowerBodyGame';
import { therapyPlan } from '../src/session/therapyPlan';
import { isSessionPlan, isSessionResult } from '../src/session/types';
import type { PoseFrame } from '../src/tracking/types';

const rest = { leftRest: 0.8, rightRest: 0.75, torsoLean: 0 };
const levels = (left = 0, right = 0, balance = 1) => ({
  knees: { left, right },
  balance,
});
const config = {
  repetitions: 2,
  timeLimitMs: 1000,
  tolerance: 0.12,
  sessionDurationMs: 2000,
};

test('calibra cada joelho após repouso, guardando picos diferentes', () => {
  const calibration = new KneeCalibration();
  for (let now = 0; now <= 1000; now += 250) calibration.update(rest, now);
  assert.equal(calibration.stage, 'left');
  calibration.update({ ...rest, rightRest: 0.25 }, 1100);
  assert.equal(calibration.lifted, false);
  calibration.update({ ...rest, leftRest: 0.32 }, 1250);
  calibration.update({ ...rest, leftRest: 0.5 }, 1400);
  calibration.update(rest, 1600);
  calibration.update(rest, 1800);
  assert.equal(calibration.stage, 'right');
  assert.equal(Boolean(calibration.result), false);
  calibration.update({ ...rest, rightRest: 0.15 }, 2100);
  calibration.update(rest, 2300);
  assert.equal(calibration.update(rest, 2500), 1);
  assert.ok(calibration.result);
  assert.ok(Math.abs(calibration.result.leftMaximum - 0.6) < 0.001);
  assert.ok(Math.abs(calibration.result.rightMaximum - 0.8) < 0.001);
  const measured = measureLegMovement(
    { ...rest, leftRest: 0.56, rightRest: 0.45, torsoLean: 0.225 },
    calibration.result
  );
  assert.ok(Math.abs(measured.knees.left - 0.5) < 0.001);
  assert.ok(Math.abs(measured.knees.right - 0.5) < 0.001);
  assert.equal(measured.balance, 0.5);
});

test('mede com o quadro dos ombros aos joelhos, mesmo sem os tornozelos', () => {
  const point = (x: number, y: number) => ({ x, y, visibility: 1 });
  const frame: PoseFrame = {
    timestamp: 0,
    aspectRatio: 1.33,
    points: {
      leftShoulder: point(0.6, 0.15),
      rightShoulder: point(0.4, 0.15),
      leftHip: point(0.6, 0.4),
      rightHip: point(0.4, 0.4),
      leftKnee: point(0.6, 0.97),
      rightKnee: point(0.4, 0.97),
    },
  };
  assert.ok(observeLegPose(frame).sample);
  frame.points.rightKnee!.y = 1.01;
  assert.deepEqual(observeLegPose(frame), { sample: null, issue: 'rightKnee' });
  frame.points.leftKnee!.visibility = 0.3;
  assert.deepEqual(observeLegPose(frame), { sample: null, issue: 'knees' });
});

test('conta uma vez por elevação e preserva o tempo durante a pausa', () => {
  const game = new LowerBodyGame('kneeRaise', config);
  game.update(levels(), 0);
  game.update(levels(0.9), 250);
  game.update(levels(0.9), 500);
  game.update(null, 600);
  game.update(levels(0.95), 3000);
  assert.equal(game.hits, 1);
  assert.equal(game.remainingMs, 1500);
  game.update(levels(), 3250);
  game.update(levels(0, 0.8, 0.7), 3500);
  assert.equal(game.hits, 2);
  assert.equal(game.completed, false);
  for (let now = 3750; now <= 4500; now += 250) game.update(levels(), now);
  assert.equal(game.completed, true);
  assert.deepEqual(game.metrics.kneeHeight, { left: 95, right: 80 });
  assert.equal(game.metrics.balance, 96);
});

test('a embaixadinha exige a subida do joelho indicado durante a janela da bola', () => {
  const game = new LowerBodyGame('kneeJuggle', config);
  game.update(levels(), 0);
  game.update(levels(0.8), 300);
  game.update(levels(0.8), 600);
  game.update(levels(0.8, 0.8), 800);
  assert.equal(game.ball?.bounced, null);
  game.update(levels(), 1000);
  assert.equal(game.attempts[0]?.outcome, 'miss');
  assert.equal(game.ball?.side, 'right');
  game.update(levels(), 1400);
  game.update(levels(0, 0.9), 1800);
  assert.equal(game.ball?.bounced, 0);
  game.update(levels(), 2250);
  assert.equal(game.attempts[1]?.outcome, 'hit');
  assert.equal(game.completed, true);
});

test('a caminhada usa passos alternados, sem tentativas ou pontuação', () => {
  const game = new LowerBodyGame('walking', config);
  game.update(levels(), 0);
  game.update(levels(0.3), 250);
  game.update(levels(), 500);
  game.update(levels(0.3), 750);
  game.update(levels(0, 0.3), 1000);
  assert.equal(game.steps, 2);
  assert.equal(game.plannedAttempts, 0);
  assert.equal(game.hits, 0);
  assert.deepEqual(game.attempts, []);
});

test('os novos jogos aceitam resultados e métricas na fila local', () => {
  for (const gameId of ['kneeRaise', 'kneeJuggle', 'walking'] as const) {
    const plan = therapyPlan('paciente', 1, defaultTherapy(gameId));
    assert.ok(isSessionPlan(plan));
    const result = {
      schemaVersion: 2,
      id: 'sessao',
      patientId: 'paciente',
      plan,
      gameVersion: '1.0.0',
      completedAt: new Date().toISOString(),
      durationMs: 1000,
      activeMs: 1000,
      pausedMs: 0,
      endReason: 'stopped',
      hits: 0,
      misses: 0,
      points: 0,
      attempts: [],
      plannedAttempts: gameId === 'walking' ? 0 : plan.config.repetitions,
      calibration: { ...rest, leftMaximum: 0.5, rightMaximum: 0.6 },
      movement: {
        lowerBody: { kneeHeight: { left: 30, right: 25 }, balance: 95 },
      },
    };
    assert.equal(isSessionResult(result), true);
    assert.equal(isSessionResult({ ...result, movement: undefined }), false);
  }
});
