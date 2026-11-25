import test from 'node:test';
import assert from 'node:assert/strict';
import { ShoulderSession } from '../src/games/shoulder/shoulderSession';
import type { ShoulderSceneState } from '../src/games/shoulder/shoulderScene';
import type { ShoulderConfig } from '../src/games/shoulder/shoulderPlans';

class FakeElement {
  innerHTML = '';
  textContent: string | null = '';
  value = 0;
  style: Record<string, string> = {};
  classes = new Set<string>();
  fields = new Map<string, FakeElement>();
  removed = false;
  clicked?: () => void;
  classList = {
    add: (value: string) => this.classes.add(value),
    remove: (value: string) => this.classes.delete(value),
  };
  querySelector(selector: string): FakeElement {
    let result = this.fields.get(selector);
    if (!result) {
      result = new FakeElement();
      this.fields.set(selector, result);
    }
    return result;
  }
  addEventListener(_type: string, callback: () => void): void {
    this.clicked = callback;
  }
  append(_item: FakeElement): void {}
  remove(): void {
    this.removed = true;
  }
  replaceChildren(): void {
    this.innerHTML = '';
    this.fields.clear();
  }
}
const created: FakeElement[] = [];
Object.defineProperty(globalThis, 'document', {
  value: {
    createElement: () => {
      const el = new FakeElement();
      created.push(el);
      return el;
    },
  },
});
const plan: ShoulderConfig = {
  targets: [{ left: 0.5, right: 0.5 }],
  repetitions: 1,
  holdMs: 100,
  timeLimitMs: 1000,
  tolerance: 0.12,
};
test('jogo monta e remove seus próprios recursos sem tocar na prévia', () => {
  const stage = new FakeElement(),
    panel = new FakeElement();
  let disposed = false;
  const rendered: ShoulderSceneState[] = [];
  const scene = {
    update: (state: ShoulderSceneState) => {
      rendered.push(state);
    },
    dispose: () => {
      disposed = true;
    },
  };
  const session = new ShoulderSession(
    plan,
    { left: { rest: 0, maximum: 80 }, right: { rest: 10, maximum: 90 } },
    stage as unknown as HTMLElement,
    panel as unknown as HTMLElement,
    () => scene
  );
  assert.ok(stage.classes.has('shoulder-game-stage'));
  assert.ok(panel.classes.has('shoulder-game-ui'));
  const angles = { left: 42, right: 48 };
  assert.equal(session.update(angles, 0), false);
  assert.equal(session.update(angles, 100), true);
  assert.equal(session.hits, 1);
  assert.equal(rendered.length, 0);
  const goalAngles = { left: 40, right: 50 };
  session.render(100);
  session.render(116);
  assert.equal(rendered.length, 2);
  assert.deepEqual(rendered[0], { angles, goalAngles, now: 100 });
  assert.equal(session.result().attempts.length, 1);
  const legend = created.at(-1)!;
  session.dispose();
  assert.ok(disposed);
  assert.ok(legend.removed);
  assert.equal(stage.classes.has('shoulder-game-stage'), false);
  assert.equal(panel.classes.has('shoulder-game-ui'), false);
  assert.equal(panel.innerHTML, '');
});
