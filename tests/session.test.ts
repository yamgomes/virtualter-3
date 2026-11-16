import test from 'node:test';
import assert from 'node:assert/strict';
import { MockSessionRepository } from '../src/session/mockSessionRepository';
import type { SessionResult } from '../src/session/types';

const data = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
}});
const repo = new MockSessionRepository();
const result: SessionResult = { id: '1', patientId: 'jogador-demo', planId: 'p1', planTitle: 'Braço', completedAt: '2026-01-01T00:00:00.000Z', durationSeconds: 30, completedTargets: 2, plannedTargets: 6 };

test('códigos simulados carregam planos distintos e rejeitam entradas inválidas', async () => {
  const left = await repo.getPlanByCode(' qwer ');
  const right = await repo.getPlanByCode('ASDF');
  assert.equal(left?.beatMs, 6000); assert.equal(right?.beatMs, 5000);
  assert.notDeepEqual(left?.targets, right?.targets);
  assert.equal((await repo.getPlanByCode('zxcv'))?.repetitions, 8);
  assert.equal(await repo.getPlanByCode('QWE1'), null);
  assert.equal(await repo.getPlanByCode('QWE'), null);
  assert.equal(await repo.getPlanByCode('__proto__'), null);
  assert.equal(await repo.getPlanByCode('inexistente'), null);
  left!.targets[0].left = 0;
  assert.equal((await repo.getPlanByCode('QWER'))?.targets[0].left, 0.5);
});

test('resultados são isolados por jogador, ordenados e gravação repetida não duplica', async () => {
  data.clear();
  await repo.saveResult(result);
  await repo.saveResult({ ...result, id: '2', patientId: 'outro', completedAt: '2026-03-01T00:00:00.000Z' });
  await repo.saveResult({ ...result, id: '3', completedAt: '2026-02-01T00:00:00.000Z' });
  await repo.saveResult(result);
  assert.deepEqual((await repo.listResults('jogador-demo')).map(item => item.id), ['3', '1']);
  assert.equal((await repo.listResults('outro')).length, 1);
});

test('histórico corrompido é tratado como vazio', async () => {
  data.clear(); data.set('virtualter.mock.session-results.v1', '{');
  assert.deepEqual(await repo.listResults('jogador-demo'), []);
});
