import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionClock } from '../src/session/sessionClock';
import { PoseBuffer } from '../src/tracking/poseBuffer';
import { ResultOutbox, OUTBOX_KEY } from '../src/session/resultOutbox';
import { isSessionPlan, isSessionResult } from '../src/session/types';
import { plan, result } from './fixtures';

test('planos e resultados vindos de fora são validados', () => {
  assert.ok(isSessionPlan(plan));
  assert.ok(isSessionResult(result));
  assert.equal(isSessionPlan({ ...plan, gameId: 'unknown' }), false);
  assert.equal(
    isSessionPlan({
      ...plan,
      config: { ...plan.config, targets: [{ left: 5, right: 0 }] },
    }),
    false
  );
  assert.equal(isSessionResult({ ...result, endReason: 'completed' }), false);
  assert.equal(isSessionResult({ ...result, activeMs: 2000 }), false);
  assert.equal(isSessionResult({ ...result, hits: 2 }), false);
});
test('frames repetidos e antigos não são reutilizados como movimento válido', () => {
  const buffer = new PoseBuffer(),
    frame = { timestamp: 100, points: {}, aspectRatio: 1 };
  assert.equal(buffer.publish(frame, 100), true);
  assert.equal(buffer.publish(frame, 200), false);
  assert.equal(buffer.publish({ ...frame, timestamp: 99 }, 200), false);
  assert.equal(buffer.publish({ ...frame, timestamp: 300 }, 200), false);
  assert.equal(buffer.read(601), null);
  assert.equal(buffer.publish(null, 602), true);
  assert.equal(buffer.read(602), null);
});
test('relógio separa atividade de pausa e suspensão longa da aba', () => {
  const clock = new SessionClock(0);
  clock.tick(0, true);
  clock.tick(100, true);
  clock.tick(200, false);
  clock.tick(1200, false);
  clock.tick(1300, true);
  clock.tick(1400, true);
  clock.tick(5000, true);
  assert.deepEqual(clock.snapshot(), {
    durationMs: 5000,
    activeMs: 200,
    pausedMs: 4800,
  });
});
test('fila sobrevive a recarga, reenvia com o mesmo ID e isola jogadores', async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  const outbox = new ResultOutbox(storage);
  outbox.enqueue(result);
  const other = {
    ...result,
    id: 'other',
    patientId: 'other',
    plan: { ...result.plan, patientId: 'other' },
  };
  outbox.enqueue(other);
  const saved: string[] = [];
  const repository = {
    async getPlanByCode() {
      return null;
    },
    async listResults() {
      return [];
    },
    async saveResult(r: typeof result) {
      saved.push(r.id);
      if (saved.length === 1) throw new Error('offline');
    },
  };
  await assert.rejects(outbox.flush(repository, result.patientId));
  const reloaded = new ResultOutbox(storage);
  assert.equal(reloaded.count(result.patientId), 1);
  await Promise.all([
    reloaded.flush(repository, result.patientId),
    reloaded.flush(repository, result.patientId),
  ]);
  assert.deepEqual(saved, ['one', 'one']);
  assert.equal(reloaded.count('other'), 1);
  assert.equal(reloaded.count(result.patientId), 0);
});
test('falha do armazenamento mantém resultado na memória e corrupção não é sobrescrita', async () => {
  const outbox = new ResultOutbox({
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota');
    },
  });
  outbox.enqueue(result);
  assert.equal(outbox.durable, false);
  assert.equal(outbox.count(result.patientId), 1);
  let raw = '{';
  const corrupt = new ResultOutbox({
    getItem(k) {
      assert.equal(k, OUTBOX_KEY);
      return raw;
    },
    setItem(_k, value) {
      raw = value;
    },
  });
  corrupt.enqueue(result);
  assert.equal(raw, '{');
  assert.equal(corrupt.durable, false);
});
