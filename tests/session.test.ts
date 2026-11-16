import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MockSessionRepository,
  RESULTS_KEY,
} from '../src/session/mockSessionRepository';
import { result } from './fixtures';
const data = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  },
});
const repo = new MockSessionRepository();

test('planos distintos, surfe de cada lado e cópias independentes', async () => {
  const left = await repo.getPlanByCode(' qwer '),
    right = await repo.getPlanByCode('ASDF');
  assert.equal(left?.config.timeLimitMs, 6000);
  assert.equal(right?.config.timeLimitMs, 5000);
  assert.equal(left?.config.targets, undefined);
  assert.equal(right?.config.targets, undefined);
  assert.equal((await repo.getPlanByCode('zxcv'))?.config.repetitions, 8);
  assert.equal((await repo.getPlanByCode('SURF'))?.gameId, 'surfing');
  const wave = await repo.getPlanByCode('ONDA');
  assert.ok(wave?.gameId === 'surfing');
  assert.equal(wave.config.side, 'right');
  for (const code of ['QWE1', 'QWE', '__proto__', 'inexistente'])
    assert.equal(await repo.getPlanByCode(code), null);
  assert.ok(left?.gameId === 'shoulder');
  left.config.timeLimitMs = 1000;
  assert.equal((await repo.getPlanByCode('QWER'))?.config.timeLimitMs, 6000);
});

test('resultados isolados por jogador, ordenados e idempotentes', async () => {
  data.clear();
  await repo.saveResult(result);
  await repo.saveResult({
    ...result,
    id: '2',
    patientId: 'outro',
    plan: { ...result.plan, patientId: 'outro' },
    completedAt: '2026-03-01T00:00:00.000Z',
  });
  await repo.saveResult({
    ...result,
    id: '3',
    completedAt: '2026-02-01T00:00:00.000Z',
  });
  await repo.saveResult(result);
  assert.deepEqual(
    (await repo.listResults('jogador-demo')).map((item) => item.id),
    ['3', 'one']
  );
  assert.equal((await repo.listResults('outro')).length, 1);
});

test('histórico corrompido é preservado e gravação inválida é rejeitada', async () => {
  data.clear();
  data.set(RESULTS_KEY, '{');
  await assert.rejects(repo.listResults('jogador-demo'));
  await assert.rejects(repo.saveResult(result));
  assert.equal(data.get(RESULTS_KEY), '{');
  data.clear();
  await assert.rejects(repo.saveResult({ ...result, hits: -1 }));
});
