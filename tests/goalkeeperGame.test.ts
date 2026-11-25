import assert from 'node:assert/strict';
import test from 'node:test';
import { GoalkeeperGame } from '../src/games/goalkeeper/goalkeeperGame';

const range = {
  left: { rest: 10, maximum: 70 },
  right: { rest: 10, maximum: 70 },
};

test('goleiro alterna após dois chutes e separa elevações no mesmo lado', (t) => {
  const randomValues = [0.1, 0.65, 0.1, 0.5, 0.5, 0.9, 0.75, 0.4];
  t.mock.method(Math, 'random', () => {
    const value = randomValues.shift();
    assert.ok(value !== undefined);
    return value;
  });
  const asymmetricRange = { ...range, right: { rest: 25, maximum: 125 } };
  const game = new GoalkeeperGame(
    { repetitions: 5, timeLimitMs: 1000, tolerance: 0.1 },
    asymmetricRange,
    'high'
  );
  const launches = [];
  for (let now = 0; now <= 4000 && !game.completed; now += 50) {
    game.update({ left: 0, right: 0 }, now);
    for (const shot of game.shots) {
      if (shot.progress !== 0) continue;
      const { rest, maximum } = asymmetricRange[shot.side];
      const percent = (100 * (shot.degrees - rest)) / (maximum - rest);
      launches.push([shot.side, Number(percent.toFixed(3))]);
    }
  }
  assert.deepEqual(launches, [
    ['left', 65],
    ['left', 12.5],
    ['right', 50],
    ['right', 95],
    ['left', 40],
  ]);
  assert.equal(game.completed, true);
});

for (const [intensity, flightMs, launchOffsets, maxInFlight] of [
  ['low', 1000, [0, 2000, 4000], 1],
  ['moderate', 1000, [0, 1000, 2000], 1],
  ['high', 1000, [0, 500, 1000], 2],
  ['low', 1500, [0, 2500, 5000], 1],
  ['moderate', 1500, [0, 1500, 3000], 1],
  ['high', 1500, [0, 500, 1500], 2],
] as const) {
  test(`goleiro ${intensity} respeita o voo configurado de ${flightMs} ms`, () => {
    const game = new GoalkeeperGame(
      { repetitions: 3, timeLimitMs: flightMs, tolerance: 0.1 },
      range,
      intensity
    );
    const launches: number[] = [];
    const arrivals: number[] = [];
    let mostInFlight = 0;
    for (let now = 0; now <= 8000 && !game.completed; now += 50) {
      if (game.update({ left: 0, right: 0 }, now)) arrivals.push(now);
      const shots = game.shots;
      if (shots.some((shot) => shot.progress === 0)) launches.push(now);
      mostInFlight = Math.max(mostInFlight, shots.length);
    }
    assert.equal(game.completed, true);
    assert.equal(game.shots.length, 0);
    assert.equal(mostInFlight, maxInFlight);
    assert.equal(launches.length, 3);
    assert.deepEqual(
      launches.map((at) => at - launches[0]),
      launchOffsets
    );
    assert.deepEqual(
      arrivals,
      launches.map((at) => at + flightMs)
    );
  });
}
