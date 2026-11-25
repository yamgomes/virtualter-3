import test from 'node:test';
import assert from 'node:assert/strict';
import { MockSessionRepository } from '../src/session/mockSessionRepository';
const repo = new MockSessionRepository();

test('planos distintos, surfe de cada lado e cópias independentes', async () => {
  const left = await repo.getPlanByCode(' qwer '),
    right = await repo.getPlanByCode('ASDF');
  assert.ok(left?.gameId === 'shoulder' && right?.gameId === 'shoulder');
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
  left.config.timeLimitMs = 1000;
  assert.equal((await repo.getPlanByCode('QWER'))?.config.timeLimitMs, 6000);
});
