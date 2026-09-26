import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  begin,
  stepGame,
  ringBell,
  groupStats,
  serialize,
  restore,
  MISSIONS,
  REEFS,
  constrain,
  distance,
} from "../src/game.js";
const tick = (g, input, n = 60) => {
  for (let i = 0; i < n; i++) stepGame(g, 1 / 60, input);
};
test("movement, shore bounds and solid reefs prevent crossing", () => {
  const g = createGame();
  begin(g);
  tick(g, { x: 1, z: 0 }, 900);
  assert.ok(g.boat.x <= 9.15);
  for (const reef of REEFS) {
    const point = { x: reef.x, z: reef.z };
    constrain(point);
    assert.ok(distance(point, reef) >= reef.r + 0.399);
  }
  g.boat.x = -6;
  g.boat.z = 20;
  tick(g, { x: -1, z: 1 }, 900);
  assert.ok(g.boat.x >= -7.1 && g.boat.z <= 21.6);
});
test("bell has a radius, cooldown and pause does not advance game time", () => {
  const g = createGame();
  begin(g);
  assert.equal(ringBell(g), 0);
  g.boat.x = 3;
  g.boat.z = 12;
  assert.equal(ringBell(g), 0);
  tick(g, { x: 0, z: 0 }, 110);
  assert.equal(ringBell(g), 24);
  assert.equal(groupStats(g).following, 24);
  g.mode = "paused";
  const before = serialize(g);
  tick(g, { x: 1, z: 0 }, 200);
  assert.equal(serialize(g), before);
});
test("a straggler can be gathered again and restored save retains all fish", () => {
  const g = createGame();
  begin(g);
  g.boat.x = 3;
  g.boat.z = 12;
  ringBell(g);
  g.boat.x = -6;
  g.boat.z = -16;
  tick(g, { x: 0, z: 0 }, 170);
  assert.ok(groupStats(g).lost > 0);
  const f = g.fish.find((f) => f.state === "lost");
  g.boat.x = f.x;
  g.boat.z = f.z;
  const recovered = ringBell(g);
  assert.ok(recovered > 0);
  const loaded = restore(serialize(g));
  assert.equal(loaded.mode, "playing");
  assert.deepEqual(loaded.fish, g.fish);
  assert.equal(restore("{broken"), null);
  assert.equal(restore('{"version":9}'), null);
});
test("each pool needs 18 fish and a dwell; all three deliveries reach ending and reload", () => {
  const g = createGame();
  begin(g);
  for (let stage = 0; stage < 3; stage++) {
    const m = MISSIONS[stage];
    g.boat.x = m.school.x;
    g.boat.z = m.school.z;
    g.bell = 0;
    ringBell(g);
    // Fixture places the escort near the destination, then exercises arrival,
    // dwell, chapter transition, checkpoint persistence and final completion.
    g.boat.x = m.home.x;
    g.boat.z = m.home.z;
    g.boat.vx = g.boat.vz = 0;
    g.fish
      .filter((f) => f.group === stage)
      .forEach((f, i) => {
        f.x = m.home.x + (i % 4) * 0.08;
        f.z = m.home.z + (i % 5) * 0.08;
      });
    tick(g, { x: 0, z: 0 }, 100);
    assert.equal(g.results.length, stage);
    tick(g, { x: 0, z: 0 }, 400);
    assert.equal(g.results.length, stage + 1);
    assert.ok(restore(serialize(g)));
  }
  assert.equal(g.mode, "ending");
  assert.equal(
    g.results.reduce((s, r) => s + r.count, 0),
    72,
  );
  assert.equal(restore(serialize(g)).mode, "ending");
});
test("natural escort route can complete without moving fish by fixture", () => {
  const g = createGame();
  begin(g);
  function sail(x, z) {
    for (let i = 0; i < 4200; i++) {
      const dx = x - g.boat.x,
        dz = z - g.boat.z,
        d = Math.hypot(dx, dz);
      if (d < 0.22) return;
      stepGame(g, 1 / 60, { x: (dx / d) * 0.58, z: (dz / d) * 0.58 });
      if (g.bell <= 0) ringBell(g);
    }
    throw new Error(`Unreachable waypoint ${x},${z}`);
  }
  const routes = [
    [
      [3, 12],
      [3, 14],
      [-4.3, 14],
      [-4.3, 8],
      [-5.4, 4],
    ],
    [
      [7.2, -1],
      [7.2, 8],
      [7, 16],
    ],
    [
      [-5.7, 18],
      [-4.3, 16],
      [-4.3, 10],
      [-5.7, 8],
      [-5.7, -15],
      [-4.3, -15],
      [5, -15],
      [5, -12.5],
    ],
  ];
  for (let stage = 0; stage < 3; stage++) {
    for (const [x, z] of routes[stage]) sail(x, z);
    tick(g, { x: 0, z: 0 }, 650);
    assert.equal(
      g.results.length,
      stage + 1,
      `chapter ${stage + 1} is completable`,
    );
  }
  assert.equal(g.mode, "ending");
});

test("quay stairs stop the hull while allowing a route around the wet end", () => {
  const g = createGame();
  begin(g);
  g.boat.x = -4.7;
  g.boat.z = 13.6;
  tick(g, { x: -1, z: 0 }, 400);
  assert.ok(g.boat.x >= -5.151);
  tick(g, { x: 0, z: 1 }, 200);
  assert.ok(g.boat.z > 16.35);
  tick(g, { x: -1, z: 0 }, 100);
  assert.ok(g.boat.x < -5.55);
});
