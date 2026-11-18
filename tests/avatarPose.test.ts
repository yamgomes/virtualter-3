import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarArm } from '../src/games/shoulder/avatarPose';

test('os braços do personagem seguem o ângulo em graus', () => {
  const down = avatarArm('left', 0);
  assert.equal(down.hand[0], down.shoulder[0]);
  assert.ok(down.hand[1] < down.shoulder[1]);
  const left = avatarArm('left', 90),
    right = avatarArm('right', 90);
  assert.ok(left.hand[0] < left.shoulder[0]);
  assert.ok(right.hand[0] > right.shoulder[0]);
  assert.ok(Math.abs(left.hand[1] - left.shoulder[1]) < 1e-10);
  assert.ok(Math.abs(right.hand[1] - right.shoulder[1]) < 1e-10);
  assert.ok(avatarArm('left', 180).hand[1] > down.shoulder[1]);
});
