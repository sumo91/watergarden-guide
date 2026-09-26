import * as THREE from "three";

export const PADDLE_LENGTH = 1.16;
export const UPPER_ARM = 0.27;
export const FOREARM = 0.25;
export const HAND_SPACING = 0.38;

// Ready, catch, power, exit, feathered recovery, then ready again.
// Positions describe the blade centre in boat space; the shaft never stretches.
const strokes = [
  [0, 0.76, 0.12, -0.25, 1],
  [0.1, 0.55, -0.075, -0.25, 0],
  [0.57, 0.55, -0.075, 0.58, 0],
  [0.7, 0.96, 0.18, 0.66, 1],
  [0.86, 1.1, 0.29, 0.08, 1],
  [1, 0.76, 0.12, -0.25, 1],
];

export function paddlePose(cycle, effort, tip, grip) {
  const index = strokes.findIndex((key) => key[0] > cycle);
  const a = strokes[Math.max(0, index - 1)],
    b = strokes[index < 0 ? 5 : index];
  const f = THREE.MathUtils.clamp((cycle - a[0]) / (b[0] - a[0]), 0, 1);
  const ease = f * f * (3 - 2 * f);
  tip.set(
    THREE.MathUtils.lerp(a[1], b[1], ease),
    THREE.MathUtils.lerp(a[2], b[2], ease),
    THREE.MathUtils.lerp(a[3], b[3], ease),
  );
  const feather = THREE.MathUtils.lerp(a[4], b[4], ease);
  const reach = THREE.MathUtils.clamp((tip.z + 0.25) / 0.91, 0, 1);
  grip.set(0.22, 0, THREE.MathUtils.lerp(0.14, 0.06 + reach * 0.16, effort));
  tip.set(
    THREE.MathUtils.lerp(0.55, tip.x, effort),
    THREE.MathUtils.lerp(0.3, tip.y, effort),
    THREE.MathUtils.lerp(1.02, tip.z, effort),
  );
  const dx = tip.x - grip.x,
    dz = tip.z - grip.z;
  grip.y = tip.y + Math.sqrt(PADDLE_LENGTH ** 2 - dx * dx - dz * dz);
  return {
    feather: THREE.MathUtils.lerp(
      Math.PI * 0.45,
      feather * Math.PI * 0.5,
      effort,
    ),
    lean: THREE.MathUtils.lerp(-0.11, 0.035, reach) * effort,
    wet:
      cycle >= 0.1 && cycle <= 0.57
        ? Math.sin(((cycle - 0.1) / 0.47) * Math.PI) * effort
        : 0,
  };
}

const axis = new THREE.Vector3(),
  bend = new THREE.Vector3();
export function solveElbow(shoulder, hand, side, result) {
  axis.subVectors(hand, shoulder);
  const distance = Math.max(axis.length(), 0.0001);
  axis.divideScalar(distance);
  // Keep the elbow outside and below the shoulder, without flipping at the catch.
  bend.set(side * 0.85, -0.55, 0.35);
  bend.addScaledVector(axis, -bend.dot(axis)).normalize();
  const along = THREE.MathUtils.clamp(
    (UPPER_ARM ** 2 + distance ** 2 - FOREARM ** 2) / (2 * distance),
    -UPPER_ARM,
    UPPER_ARM,
  );
  const height = Math.sqrt(Math.max(0, UPPER_ARM ** 2 - along ** 2));
  return result
    .copy(shoulder)
    .addScaledVector(axis, along)
    .addScaledVector(bend, height);
}
