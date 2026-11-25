import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultTherapy,
  GAME_DEFINITIONS,
  isGameId,
  intensityPreset,
  validTherapy,
} from '@homephysio/contracts';
import { therapyPlan } from '../src/session/therapyPlan';
import { isSessionPlan } from '../src/session/types';

test('os padrões e intensidades do catálogo podem ser salvos e lidos pelo jogador', () => {
  for (const gameId of Object.keys(GAME_DEFINITIONS).filter(isGameId)) {
    const defaults = defaultTherapy(gameId);
    assert.equal(validTherapy(defaults), true, gameId);
    assert.equal(
      isSessionPlan(therapyPlan('paciente-teste', 1, defaults)),
      true,
      gameId
    );
    for (const { value: intensity } of GAME_DEFINITIONS[gameId].fields.find(
      (field) => field.kind === 'select' && field.key === 'intensity'
    )?.options ?? []) {
      if (intensity === 'custom') continue;
      const therapy = { ...defaults, ...intensityPreset(intensity, gameId) };
      assert.equal(validTherapy(therapy), true, `${gameId}/${intensity}`);
      assert.equal(
        isSessionPlan(therapyPlan('paciente-teste', 1, therapy)),
        true
      );
    }
  }
});

test('a terapia de goleiro abre como uma partida por quantidade de chutes', () => {
  const therapy = {
    ...defaultTherapy('goalkeeper'),
    ...intensityPreset('moderate', 'goalkeeper'),
    gameId: 'goalkeeper' as const,
    title: 'Goleiro',
    repetitions: 9,
    targetSeconds: 2.2,
    tolerancePercent: 18,
  };
  assert.equal(validTherapy(therapy), true);
  assert.equal(validTherapy({ ...therapy, targets: '50/50' }), false);
  const plan = therapyPlan('paciente-teste', 3, therapy);
  assert.equal(isSessionPlan(plan), true);
  assert.equal(plan.gameId, 'goalkeeper');
  assert.equal(plan.version, 3);
  assert.deepEqual(plan.config, {
    repetitions: 9,
    timeLimitMs: 2200,
    tolerance: 0.18,
    pointsPerHit: 10,
    posture: { mode: 'front', tolerance: 0.2 },
  });
});
