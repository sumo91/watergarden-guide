import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeTraveller } from "../src/world.js";
import { makeWake } from "../src/water.js";

const boat = () => ({ x: 0, z: 0, angle: 0, vx: 0, vz: -2.5 });
const poses = (root) => {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const result = new Map();
  root.traverse((object) => {
    if (object.isMesh)
      result.set(
        object.uuid,
        inverse.clone().multiply(object.matrixWorld).elements,
      );
  });
  return result;
};

test("rowing moves the character and paddle relative to the hull", () => {
  const traveller = makeTraveller(new THREE.Scene());
  const craft = boat();
  for (let i = 0; i <= 60; i++) traveller.update(i / 60, craft);
  const before = poses(traveller.root);
  for (let i = 61; i <= 86; i++) traveller.update(i / 60, craft);
  const after = poses(traveller.root);
  const moved = [...before].filter(([id, matrix]) =>
    matrix.some((value, i) => Math.abs(value - after.get(id)[i]) > 0.025),
  ).length;
  assert.ok(
    moved >= 6,
    `Only ${moved} parts moved: arms, torso and paddle must row together`,
  );
});

test("a stopped boat leaves a wake that dissipates instead of disappearing", () => {
  const wake = makeWake(new THREE.Scene());
  const craft = boat();
  for (let i = 0; i <= 120; i++) {
    craft.z = -i / 24;
    wake.update(i / 60, craft);
  }
  craft.vz = 0;
  wake.update(2 + 1 / 60, craft);
  assert.equal(
    wake.group.visible,
    true,
    "Existing foam must outlive the moving boat",
  );
  for (let i = 122; i <= 600; i++) wake.update(i / 60, craft);
  assert.equal(wake.group.visible, false, "Foam must eventually fade away");
});

test("turning preserves the previous wake in world space", () => {
  const scene = new THREE.Scene();
  const wake = makeWake(scene);
  const craft = boat();
  for (let i = 0; i <= 120; i++) {
    craft.z = -i / 24;
    wake.update(i / 60, craft);
  }
  const ribbon = wake.group.getObjectByName("Recorded water trail");
  const point = () => {
    scene.updateMatrixWorld(true);
    const positions = ribbon.geometry.attributes.position;
    return new THREE.Vector3()
      .fromBufferAttribute(positions, 0)
      .add(new THREE.Vector3().fromBufferAttribute(positions, 1))
      .multiplyScalar(0.5)
      .applyMatrix4(ribbon.matrixWorld);
  };
  const before = point();
  craft.angle = Math.PI / 2;
  craft.x -= 0.04;
  craft.vx = -2.5;
  craft.vz = 0;
  wake.update(2 + 1 / 60, craft);
  assert.ok(
    point().distanceTo(before) < 0.01,
    "Old foam moved with the turning boat",
  );
  assert.ok(ribbon.geometry.drawRange.count > 12);
});

test("the paddle enters and exits water, rests when stopped and freezes on pause", () => {
  const traveller = makeTraveller(new THREE.Scene());
  const craft = boat();
  const wake = makeWake(new THREE.Scene());
  let wet = 0,
    lifted = 0;
  for (let i = 0; i <= 240; i++) {
    craft.z = -i / 24;
    traveller.update(i / 60, craft);
    wake.update(i / 60, craft, traveller.motion);
    wet = Math.max(wet, traveller.motion.wet);
    if (traveller.motion.wet === 0)
      lifted = Math.max(lifted, traveller.motion.paddle.y);
  }
  assert.ok(wet > 0.9);
  assert.ok(lifted > 0.3, "Recovery stroke must clear the surface");
  const paused = poses(traveller.root);
  const water = wake.group
    .getObjectByName("Recorded water trail")
    .geometry.attributes.position.array.slice();
  for (let i = 0; i < 60; i++) {
    traveller.update(4, craft);
    wake.update(4, craft, traveller.motion);
  }
  assert.deepEqual(poses(traveller.root), paused);
  assert.deepEqual(
    wake.group.getObjectByName("Recorded water trail").geometry.attributes
      .position.array,
    water,
  );
  craft.vz = 0;
  for (let i = 241; i <= 480; i++) traveller.update(i / 60, craft);
  assert.equal(traveller.motion.wet, 0, "Idle rowing must ease to rest");
  craft.vz = -2.5;
  for (let i = 481; i <= 660; i++) traveller.update(i / 60, craft, false);
  assert.equal(
    traveller.motion.wet,
    0,
    "Returning to the title must not row on the spot",
  );
});
