import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeTraveller } from "../src/world.js";
import { makeWake } from "../src/water.js";
import { UPPER_ARM, FOREARM, HAND_SPACING } from "../src/rowing.js";

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

test("forearms stay outside the chest and head while rowing, starting and stopping", () => {
  const traveller = makeTraveller(new THREE.Scene());
  const chest = traveller.root.getObjectByName("Rowing chest");
  const point = new THREE.Vector3(),
    head = new THREE.Vector3();
  const craft = boat();
  for (let i = 0; i <= 2400; i++) {
    const time = i / 120;
    craft.vz =
      time < 5 ? -2.9 : time < 8 ? 0 : time < 13 ? -1.45 : time < 16 ? 0 : -2.9;
    traveller.update(time, craft);
    traveller.root.getObjectByName("Rowing head").getWorldPosition(head);
    for (const side of ["Left", "Right"]) {
      const arm = traveller.root.getObjectByName(`${side} forearm`);
      for (let sample = 0; sample <= 10; sample++) {
        point.set(0, sample / 10 - 0.5, 0).applyMatrix4(arm.matrixWorld);
        assert.ok(
          point.distanceTo(head) > 0.165,
          `${side} forearm intersects the head at frame ${i}`,
        );
        chest.worldToLocal(point);
        if (Math.abs(point.y) > 0.205) continue;
        const radius = THREE.MathUtils.lerp(
          0.17,
          0.125,
          (point.y + 0.205) / 0.41,
        );
        assert.ok(
          Math.hypot(point.x, point.z) > radius + 0.02,
          `${side} forearm crosses the chest at frame ${i}`,
        );
      }
    }
  }
});

test("elbows do not snap when starting, stopping or changing rowing speed", () => {
  const traveller = makeTraveller(new THREE.Scene());
  const craft = boat();
  const previous = new Map();
  const elbow = new THREE.Vector3();
  for (let i = 0; i <= 2400; i++) {
    const time = i / 120;
    craft.vz =
      time < 5 ? -2.9 : time < 8 ? 0 : time < 13 ? -1.45 : time < 16 ? 0 : -2.9;
    traveller.update(time, craft);
    for (const side of ["Left", "Right"]) {
      const upper = traveller.root.getObjectByName(`${side} upper arm`);
      elbow
        .set(0, upper.scale.y / 2, 0)
        .applyQuaternion(upper.quaternion)
        .add(upper.position);
      if (previous.has(side))
        assert.ok(
          elbow.distanceTo(previous.get(side)) < 0.025,
          `${side} elbow snapped at frame ${i}`,
        );
      previous.set(side, elbow.clone());
    }
  }
});

test("the paddle stays rigid throughout a rowing cycle", () => {
  const traveller = makeTraveller(new THREE.Scene());
  const shaft = traveller.root.getObjectByName("Paddle shaft");
  const lengths = [];
  for (let i = 0; i <= 360; i++) {
    traveller.update(i / 60, boat());
    lengths.push(shaft.scale.y);
  }
  const variation = Math.max(...lengths) - Math.min(...lengths);
  assert.ok(
    variation < 0.001,
    `Paddle changes length by ${variation.toFixed(3)} metres`,
  );
});

test("hands stay on the rigid paddle, arms keep their lengths and feet stay planted", () => {
  const traveller = makeTraveller(new THREE.Scene());
  const craft = boat();
  const get = (name) => traveller.root.getObjectByName(name);
  const footPositions = [
    get("Left planted foot").position.clone(),
    get("Right planted foot").position.clone(),
  ];
  const shaft = get("Paddle shaft");
  const top = new THREE.Vector3(),
    down = new THREE.Vector3(),
    lowerGrip = new THREE.Vector3();
  for (let i = 0; i <= 900; i++) {
    craft.vz = i < 300 ? -2.5 : i < 450 ? 0 : i < 800 ? -1.45 : 0;
    traveller.update(i / 60, craft);
    down.set(0, 1, 0).applyQuaternion(shaft.quaternion);
    top.copy(shaft.position).addScaledVector(down, -shaft.scale.y / 2);
    lowerGrip.copy(top).addScaledVector(down, HAND_SPACING);
    assert.ok(get("Left hand").position.distanceTo(top) < 1e-8);
    assert.ok(get("Right hand").position.distanceTo(lowerGrip) < 1e-8);
    const head = traveller.root.worldToLocal(
      get("Rowing head").getWorldPosition(new THREE.Vector3()),
    );
    assert.ok(
      get("Left hand").position.distanceTo(head) > 0.18,
      "The upper grip must stay beside the face",
    );
    for (const side of ["Left", "Right"]) {
      assert.ok(Math.abs(get(`${side} upper arm`).scale.y - UPPER_ARM) < 1e-8);
      assert.ok(
        Math.abs(get(`${side} forearm`).scale.y - FOREARM) < 1e-8,
        `${side} forearm stretched at frame ${i}`,
      );
    }
    assert.deepEqual(get("Left planted foot").position, footPositions[0]);
    assert.deepEqual(get("Right planted foot").position, footPositions[1]);
  }
});

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
