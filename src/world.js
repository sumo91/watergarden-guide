import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  makePainterMaterial,
  surfaceKind,
  softenRockNormals,
} from "./materials.js";

let seed = 1834;
export const random = (a = 0, b = 1) => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return a + (seed / 4294967296) * (b - a);
};
const palette = {
  stone: "#bdb79a",
  pale: "#d1c7a4",
  rock: "#657b69",
  moss: "#637836",
  dark: "#283d39",
  wood: "#715039",
};
const solid = makePainterMaterial();
const color = new THREE.Color();

function painted(geometry, hex, variation = 0.07) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const array = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < array.length; i += 9) {
    color
      .set(hex)
      .multiplyScalar(random(1 - variation * 0.3, 1 + variation * 0.3));
    for (let j = 0; j < 9; j += 3) {
      array[i + j] = color.r;
      array[i + j + 1] = color.g;
      array[i + j + 2] = color.b;
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(array, 3));
  const count = geo.attributes.position.count;
  geo.setAttribute(
    "artKind",
    new THREE.BufferAttribute(
      new Float32Array(count).fill(surfaceKind(hex)),
      1,
    ),
  );
  geo.setAttribute(
    "artUv",
    geo.attributes.uv
      ? geo.attributes.uv.clone()
      : new THREE.BufferAttribute(new Float32Array(count * 2).fill(0.5), 2),
  );
  return geo;
}
function mesh(geo, col, parent, x = 0, y = 0, z = 0, variance = 0.035) {
  const m = new THREE.Mesh(painted(geo, col, variance), solid);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(
  parent,
  x,
  y,
  z,
  w,
  h,
  d,
  col = palette.stone,
  rotation = 0,
  bevel = 0.11,
) {
  const m = mesh(
    new RoundedBoxGeometry(
      w,
      h,
      d,
      h > 0.35 ? 2 : 1,
      Math.min(bevel, h * 0.22),
    ),
    col,
    parent,
    x,
    y,
    z,
  );
  m.rotation.y = rotation;
  return m;
}
function rock(parent, x, y, z, sx, sy, sz, col = palette.rock) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const distortion = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].join(",");
    if (!distortion.has(key)) distortion.set(key, random(0.92, 1.08));
    const f = distortion.get(key);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  softenRockNormals(g);
  const m = mesh(g, col, parent, x, y, z, 0.015);
  m.geometry.attributes.artKind.array.fill(0);
  m.scale.set(sx, sy, sz);
  m.rotation.y = random(0, 6.28);
  return m;
}
function slab(parent, x, y, z, w, d, col) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 7; i++) {
    let a = (i / 7) * 6.283,
      r = random(0.8, 1.12),
      px = Math.cos(a) * w * 0.5 * r,
      pz = Math.sin(a) * d * 0.5 * r;
    if (i === 0) shape.moveTo(px, pz);
    else shape.lineTo(px, pz);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: random(0.2, 0.45),
    bevelEnabled: false,
  });
  g.rotateX(-Math.PI / 2);
  return mesh(g, col, parent, x, y, z, 0.055);
}
function stem(parent, from, to, r, col) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to),
    delta = b.clone().sub(a);
  const m = mesh(
    new THREE.CylinderGeometry(r * 0.8, r, delta.length(), 6),
    col,
    parent,
  );
  m.position.copy(a.add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
  return m;
}
function leaf(parent, x, y, z, size, col, rotation = 0) {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0,
        0,
        -size,
        0.43 * size,
        0.03 * size,
        -0.4 * size,
        0.37 * size,
        0.06 * size,
        0.45 * size,
        0,
        0.1 * size,
        size,
        -0.4 * size,
        0.025 * size,
        0.5 * size,
        -0.45 * size,
        0,
        -0.35 * size,
        0,
        0.17 * size,
        0,
      ],
      3,
    ),
  );
  g.setIndex([0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
  g.computeVertexNormals();
  const m = mesh(g, col, parent, x, y, z);
  m.rotation.y = rotation;
  m.castShadow = size > 0.55;
  return m;
}
function barrel(parent, x, y, z, size = 1, lying = false) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.scale.setScalar(size);
  parent.add(root);
  if (lying) {
    root.rotation.z = Math.PI / 2;
    root.rotation.y = 0.28;
  }
  const profile = [
    new THREE.Vector2(0.38, 0),
    new THREE.Vector2(0.45, 0.12),
    new THREE.Vector2(0.5, 0.48),
    new THREE.Vector2(0.46, 0.87),
    new THREE.Vector2(0.38, 1),
  ];
  mesh(new THREE.LatheGeometry(profile, 12), palette.wood, root, 0, 0, 0, 0.2);
  for (let k = 0; k < 12; k++) {
    let a = (k / 12) * Math.PI * 2;
    stem(
      root,
      [Math.sin(a) * 0.452, 0.1, Math.cos(a) * 0.452],
      [Math.sin(a) * 0.5, 0.5, Math.cos(a) * 0.5],
      0.009,
      "#352f25",
    );
    stem(
      root,
      [Math.sin(a) * 0.5, 0.5, Math.cos(a) * 0.5],
      [Math.sin(a) * 0.46, 0.89, Math.cos(a) * 0.46],
      0.009,
      "#352f25",
    );
  }
  for (const h of [0.16, 0.83]) {
    const m = mesh(
      new THREE.TorusGeometry(0.462, 0.035, 4, 12),
      "#b9b39e",
      root,
      0,
      h,
      0,
    );
    m.rotation.x = Math.PI / 2;
  }
  const cap = mesh(
    new THREE.CylinderGeometry(0.374, 0.374, 0.045, 12),
    "#936e4b",
    root,
    0,
    1,
    0,
  );
  for (const x1 of [-0.18, 0, 0.18])
    box(
      root,
      x1,
      1.028,
      0,
      0.011,
      0.008,
      Math.sqrt(0.36 * 0.36 - x1 * x1) * 2,
      "#514332",
    );
  mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.025, 6),
    "#4d3b29",
    root,
    0.1,
    1.037,
    0.08,
  );
  return root;
}
function pot(parent, x, y, z, s = 1, col = "#aa673d") {
  const profile = [
    [0.23, 0],
    [0.33, 0.08],
    [0.35, 0.46],
    [0.2, 0.6],
    [0.2, 0.74],
    [0.25, 0.76],
    [0.25, 0.81],
    [0.17, 0.81],
    [0.16, 0.71],
    [0.17, 0.62],
    [0.28, 0.44],
    [0.25, 0.15],
  ].map((a) => new THREE.Vector2(a[0] * s, a[1] * s));
  return mesh(new THREE.LatheGeometry(profile, 10), col, parent, x, y, z, 0.04);
}
function lily(parent, x, z, r, flower = false) {
  const root = new THREE.Group();
  root.position.set(x, 0.065 + random(0, 0.025), z);
  root.rotation.y = random(0, 6.28);
  parent.add(root);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (let i = 0; i <= 18; i++) {
    const a = 0.14 + (i / 18) * (Math.PI * 2 - 0.28);
    shape.lineTo(
      Math.cos(a) * r * (1 + 0.045 * Math.sin(i * 3)),
      Math.sin(a) * r,
    );
  }
  shape.lineTo(0, 0);
  const pad = mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }),
    random() > 0.5 ? "#536b2c" : "#68833a",
    root,
  );
  pad.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28 + 0.5;
    stem(
      root,
      [0, 0.045, 0],
      [Math.cos(a) * r * 0.86, 0.045, Math.sin(a) * r * 0.86],
      0.006,
      "#75883e",
    );
  }
  if (flower) {
    for (let layer = 0; layer < 3; layer++)
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + layer * 0.39;
        const petal = new THREE.SphereGeometry(1, 4, 3);
        const m = mesh(
          petal,
          ["#c16443", "#df8057", "#e99663"][layer],
          root,
          Math.cos(a) * 0.15,
          0.11 + layer * 0.08,
          Math.sin(a) * 0.15,
          0.08,
        );
        m.scale.set(0.105, 0.08 + layer * 0.04, 0.34 - layer * 0.05);
        m.rotation.set(-0.3 - layer * 0.27, -a + Math.PI / 2, 0);
      }
    mesh(new THREE.IcosahedronGeometry(0.1, 0), "#e7ba60", root, 0, 0.27, 0);
  }
}
function greenery(parent, x, y, z, r, count = 30) {
  for (let i = 0; i < count; i++) {
    let a = random(0, 6.28),
      d = random(0, r);
    leaf(
      parent,
      x + Math.cos(a) * d,
      y + random(-0.04, 0.1),
      z + Math.sin(a) * d,
      random(0.15, 0.48),
      random() > 0.4 ? "#667d3b" : "#465f30",
      random(0, 6.28),
    );
  }
}
function fern(parent, x, y, z, s = 1) {
  for (let j = 0; j < 7; j++) {
    let a = (j / 7) * 6.28;
    let end = [
      x + Math.sin(a) * s * 0.9,
      y + 0.5 * s,
      z + Math.cos(a) * s * 0.9,
    ];
    stem(parent, [x, y, z], end, 0.014 * s, "#637d37");
    for (let k = 1; k < 7; k++) {
      let t = k / 7;
      for (let side of [-1, 1]) {
        let l = leaf(
          parent,
          x + Math.sin(a) * s * 0.9 * t + Math.cos(a) * 0.12 * s * side,
          y + 0.5 * s * Math.sin(t * 1.5),
          z + Math.cos(a) * s * 0.9 * t - Math.sin(a) * 0.12 * s * side,
          (1 - t) * s * 0.35,
          "#829a47",
          -a + side * 0.8,
        );
        l.rotation.z = side * 0.22;
      }
    }
  }
}
function batchStatic(root) {
  root.updateMatrixWorld(true);
  const geometries = [];
  const shadowGroups = [[], []];
  root.traverse((o) => {
    if (o.isMesh) {
      let g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      g.deleteAttribute("uv");
      if (g.index) g = g.toNonIndexed();
      geometries.push(g);
      shadowGroups[o.castShadow ? 1 : 0].push(g);
    }
  });
  const meshes = shadowGroups.flatMap((parts, i) => {
    if (!parts.length) return [];
    const m = new THREE.Mesh(mergeGeometries(parts, false), solid);
    m.castShadow = i === 1;
    m.receiveShadow = true;
    return [m];
  });
  const oldGeometries = new Set();
  root.traverse((o) => {
    if (o.isMesh) oldGeometries.add(o.geometry);
  });
  root.clear();
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  oldGeometries.forEach((g) => g.dispose());
  geometries.forEach((g) => g.dispose());
  root.add(...meshes);
  return meshes[0];
}

export function makeWorld(scene) {
  const root = new THREE.Group();
  scene.add(root);
  // A triangulated, uneven bed makes the depth readable through the water.
  const bed = new THREE.PlaneGeometry(90, 90, 45, 45);
  bed.rotateX(-Math.PI / 2);
  const p = bed.attributes.position;
  for (let i = 0; i < p.count; i++)
    p.setY(i, -4.2 + Math.sin(p.getX(i) * 0.37) * 0.35 + random(-0.2, 0.2));
  bed.computeVertexNormals();
  const floor = mesh(bed, "#3e685d", root, 0, 0, 0, 0.09);
  floor.castShadow = false;
  // Broken flagstones, dark crevices, and fallen masonry below the surface.
  for (let i = 0; i < 32; i++) {
    const x = random(-11, 12),
      z = random(-19, 22);
    slab(
      root,
      x,
      -3.68 + random(-0.25, 0.3),
      z,
      random(2.7, 5.4),
      random(2.6, 5.4),
      random() > 0.5 ? "#607f71" : "#4a7063",
    );
  }
  for (let i = 0; i < 28; i++)
    rock(
      root,
      random(-9, 12),
      random(-3.6, -2.8),
      random(-21, 22),
      random(0.5, 1.7),
      random(0.2, 0.6),
      random(0.5, 1.6),
      "#44665e",
    );
  // Left bank: hand-cut sandstone quay and its retaining wall.
  box(root, -21.5, -1.15, 3, 26, 4.5, 64, "#746f5d", 0, 0.03);
  // Shallow warm mortar keeps joints from turning into black grid lines.
  box(root, -21.5, 1.175, 3, 26, 0.3, 64, "#b5ae94", 0, 0.015);
  for (let row = 0; row < 34; row++)
    for (let col = 0; col < 12; col++) {
      const x = -33.92 + col * 2.14 + (row % 2) * 0.14,
        z = -28.5 + row * 1.81;
      box(
        root,
        x,
        1.22 + random(-0.018, 0.018),
        z,
        2.13,
        0.28,
        1.8,
        random() > 0.6 ? "#c7bea0" : "#b8b196",
        random(-0.006, 0.006),
        0.035,
      );
      if (random() > 0.64)
        box(
          root,
          x + random(-0.6, 0.6),
          1.368,
          z + random(-0.5, 0.5),
          random(0.3, 0.8),
          0.005,
          0.014,
          "#8c8b73",
          random(-1.5, 1.5),
          0,
        );
    }
  for (let row = 0; row < 25; row++) {
    const z = -19.5 + row * 1.8;
    for (let j = 0; j < 3; j++)
      box(
        root,
        -8.74,
        -2.6 + j * 1.1,
        z + (j % 2) * 0.45,
        0.5,
        1.06,
        1.77,
        j === 2 ? "#9c9c81" : "#788975",
        0,
        0.04,
      );
    box(root, -8.53, 1.31, z, 0.62, 0.34, 1.76, "#c9c1a1", 0, 0.045);
  }
  // Foreground parapet: broken ends expose the individual blocks.
  for (let i = 0; i < 6; i++) {
    const z = 6 + i * 1.55;
    box(root, -10, 2.2, z, 1.12, 1.85, 1.52, "#b8b298", 0, 0.055);
    box(root, -10, 3.18, z, 1.24, 0.23, 1.54, "#d4ccae");
  }
  box(root, -10, 1.9, 4.8, 1.12, 1.3, 1.25, "#b8b298");
  box(root, -10, 2.59, 4.8, 1.24, 0.2, 1.29, "#d4ccae");
  // Broad stairs run from the landing down into the water.
  for (let i = 0; i < 12; i++)
    box(
      root,
      -7.6 + i * 0.45,
      1.08 - i * 0.28,
      13.6,
      0.49,
      0.48,
      4.6,
      i < 5 ? "#c2ba9d" : "#759980",
      0,
      0.028,
    );
  for (let i = 0; i < 12; i++)
    box(
      root,
      -12.8,
      -0.2 + i * 0.12,
      -14.6 - i * 0.49,
      4.7,
      0.27,
      0.52,
      "#a5ac90",
    );
  barrel(root, -10.4, 1.4, -1.7, 1.25);
  barrel(root, -11.2, 1.4, 8.2, 1.45, true);
  barrel(root, -11.6, 1.4, 9.5, 1, true);
  barrel(root, -14, 1.4, -11, 1.1);
  pot(root, -9.6, 1.4, 7.2, 1.1);
  pot(root, -10.25, 1.4, 7.1, 0.8, "#805535");
  const stool = new THREE.Group();
  root.add(stool);
  mesh(
    new THREE.CylinderGeometry(0.33, 0.35, 0.1, 10),
    "#786148",
    stool,
    -11.7,
    1.98,
    -1.5,
  );
  for (const a of [0, 2.1, 4.2])
    stem(
      stool,
      [-11.7 + Math.cos(a) * 0.21, 1.4, -1.5 + Math.sin(a) * 0.21],
      [-11.7 + Math.cos(a) * 0.17, 1.96, -1.5 + Math.sin(a) * 0.17],
      0.055,
      "#544634",
    );
  // Far retaining wall closes the composition without a visible horizon.
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 9; col++)
      box(
        root,
        -14 + col * 2.5,
        1.1 + row * 1.5,
        -21,
        2.47,
        1.47,
        1.3,
        row === 2 ? "#858771" : "#707967",
        0,
        0.07,
      );
  for (let i = 0; i < 15; i++) {
    const x = random(-16, 6);
    rock(
      root,
      x,
      -0.15,
      -18.5,
      random(0.7, 1.7),
      random(0.4, 1),
      random(0.6, 1.2),
      "#4c6154",
    );
    greenery(root, x, 0.55, -18.5, 1.2, 12);
  }
  // The right shore is composed of faceted, moss-covered stone shelves.
  for (let i = 0; i < 23; i++) {
    const z = -23 + i * 2.25,
      x = 12.8 + Math.sin(i * 0.7) * 1.3;
    rock(root, x + 2, -1.3, z, 3.3, 3.4, 2.5, "#647d62");
    rock(
      root,
      x,
      0.1,
      z,
      1.7,
      1.75,
      1.7,
      random() > 0.5 ? "#849a70" : "#6c8867",
    );
    rock(root, x + 2, 1.8, z, 2.7, 0.85, 2.4, "#657b43");
    greenery(root, x + 1.9, 2.35, z, 2.2, 26);
    rock(root, x + 6, 1.2, z, 5, 2.5, 3, "#526c44");
    greenery(root, x + 5, 3, z, 3, 15);
    if (i % 3 === 0) fern(root, x + 0.3, 1.85, z, 1.1);
    for (let j = 0; j < 3; j++)
      rock(
        root,
        x - 1 + random(-0.8, 0.5),
        -2,
        z + random(-1, 1),
        random(0.7, 1.7),
        random(0.5, 1.2),
        random(0.6, 1.5),
        "#678a77",
      );
  }
  // A submerged broken arch, with individual voussoirs and fractured pillars.
  const arch = new THREE.Group();
  arch.position.set(5.3, -3.4, -7.8);
  arch.rotation.y = 0.16;
  root.add(arch);
  for (const side of [-1, 1]) {
    box(arch, side * 2.9, 0.27, 0, 1.8, 0.55, 2.1, "#799886", 0, 0.08);
    for (let k = 0; k < 3; k++)
      box(
        arch,
        side * 2.9,
        0.85 + k * 0.75,
        0,
        1.2,
        0.72,
        1.35,
        "#7d9883",
        random(-0.04, 0.04),
        0.045,
      );
  }
  for (let i = 0; i < 10; i++) {
    if (i === 6 || i === 7) continue;
    const a = (i / 9) * Math.PI;
    const m = box(
      arch,
      Math.cos(a) * 2.87,
      2.45 + Math.sin(a) * 2.87,
      0,
      0.95,
      1.15,
      1.35,
      "#7c9680",
      0,
      0.06,
    );
    m.rotation.z = a - Math.PI / 2;
  }
  rock(root, 5.7, -2.8, -6.3, 1.6, 0.7, 1.1, "#8ca58b");
  box(root, 6.4, -2.4, -5, 1.3, 0.8, 1.8, "#789484", 0.4, 0.06);
  // Back stairs and a toppled column under clear water.
  for (let i = 0; i < 11; i++)
    box(
      root,
      1.5,
      -3.8 + i * 0.32,
      -13.3 - i * 0.5,
      3,
      0.36,
      0.55,
      "#719785",
      0,
      0.025,
    );
  for (let c = 0; c < 3; c++) {
    const x = 3.4 + c * 1.25,
      z = -2.8 + c * 0.3;
    const profile = [
      [0.56, 0],
      [0.55, 1.55 + c * 0.2],
      [0.63, 1.68 + c * 0.2],
      [0.62, 1.83 + c * 0.2],
      [0.45, 1.82 + c * 0.2],
      [0.43, 1.5 + c * 0.2],
    ].map((v) => new THREE.Vector2(...v));
    mesh(
      new THREE.LatheGeometry(profile, 8),
      "#557f72",
      root,
      x,
      -3.7,
      z,
      0.09,
    );
    mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.04, 8),
      "#253f3c",
      root,
      x,
      -2.24 + c * 0.2,
      z,
    );
  }
  for (let i = 0; i < 18; i++)
    box(
      root,
      random(1.7, 5.2),
      -3.35,
      random(-1.9, 2.1),
      0.16,
      random(0.3, 1.2),
      0.16,
      "#35685a",
      random(-0.08, 0.08),
      0,
    );
  for (let i = 0; i < 22; i++) {
    let z = random(-20, 18),
      x = random() > 0.4 ? random(9.6, 12) : random(-8.2, -7);
    lily(root, x, z, random(0.3, 0.68), i % 5 === 0);
    if (i % 2 === 0) greenery(root, x, 0.045, z, 1.2, 8);
  }
  lily(root, 10.1, -12.1, 1, true);
  lily(root, 9.4, -11.3, 0.78);
  lily(root, -7.4, -8.8, 0.75, true);
  lily(root, -7.6, -15, 0.63, true);
  for (let i = 0; i < 30; i++)
    leaf(
      root,
      random(-8, 11),
      0.04,
      random(-20, 22),
      random(0.05, 0.15),
      "#8b9c45",
      random(0, 6),
    );
  for (let i = 0; i < 9; i++)
    fern(root, random(7.5, 10.5), -3.4, random(-12, 11), random(0.4, 0.9));
  const staticMesh = batchStatic(root);
  return { root, staticMesh };
}

export function makeFish(scene) {
  // A thin, faceted body and a distinct forked tail keep the fish legible from above.
  const vertices = [
    0, 0, -0.4, -0.1, 0.018, -0.08, 0, 0.055, 0.16, 0.1, 0.018, -0.08, 0,
    -0.035, 0.07, -0.105, 0, 0.31, 0, 0, 0.25, 0.105, 0, 0.31,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex([
    0, 1, 2, 0, 2, 3, 0, 4, 1, 0, 3, 4, 1, 4, 2, 3, 2, 4, 2, 5, 6, 2, 6, 7,
  ]);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    color: "#dba958",
    side: THREE.DoubleSide,
  });
  const count = 240,
    fish = new THREE.InstancedMesh(geo, mat, count);
  fish.frustumCulled = false;
  scene.add(fish);
  const dummy = new THREE.Object3D();
  const data = Array.from({ length: count }, (_, i) => ({
    a: random(-0.9, 2.3),
    radius: random(1.6, 4.4),
    size: random(0.52, 1.18),
    phase: random(0, 6.28),
    lane: random(-0.5, 0.5),
    band: i % 4,
  }));
  for (let i = 0; i < count; i++)
    fish.setColorAt(
      i,
      new THREE.Color().setHSL(
        random(0.087, 0.12),
        random(0.43, 0.65),
        random(0.45, 0.62),
      ),
    );
  return {
    fish,
    update(t) {
      data.forEach((d, i) => {
        const a = d.a + Math.sin(t * 0.12) * 0.22,
          x = -3.4 + Math.cos(a) * d.radius,
          z = -5.1 + Math.sin(a) * d.radius * 1.18;
        dummy.position.set(x, -0.5 - Math.sin(d.phase + t * 0.3) * 0.09, z);
        dummy.rotation.set(
          0,
          -a + Math.PI + Math.sin(t * 3 + d.phase) * 0.08,
          0,
        );
        dummy.scale.set(
          d.size,
          d.size,
          d.size * (1 + Math.sin(t * 5 + d.phase) * 0.08),
        );
        dummy.updateMatrix();
        fish.setMatrixAt(i, dummy.matrix);
      });
      fish.instanceMatrix.needsUpdate = true;
    },
  };
}

export function makeTraveller(scene) {
  const root = new THREE.Group();
  scene.add(root);
  root.position.set(-0.5, 0, 1);
  root.rotation.order = "YXZ";
  root.rotation.y = -0.17;
  // A small ochre skiff, ivory deck, and wind-filled terracotta sail.
  const hull = mesh(
    new THREE.SphereGeometry(1, 9, 5),
    "#aa5834",
    root,
    0,
    0.065,
    0,
  );
  hull.scale.set(0.36, 0.16, 1.05);
  const deck = mesh(
    new THREE.SphereGeometry(1, 9, 4),
    "#cfb67c",
    root,
    0,
    0.14,
    0.03,
  );
  deck.scale.set(0.29, 0.04, 0.91);
  stem(root, [-0.15, 0.17, -0.5], [-0.15, 1.95, -0.5], 0.022, "#725438");
  const sg = new THREE.BufferGeometry();
  sg.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.15, 0.48, -0.53, -0.87, 0.64, -0.49, -0.94, 1.2, -0.43, -0.68, 1.7,
        -0.48, -0.15, 1.97, -0.5, -0.46, 1.22, -0.17,
      ],
      3,
    ),
  );
  sg.setIndex([0, 1, 5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 0, 5]);
  sg.computeVertexNormals();
  const sail = mesh(sg, "#bf6039", root);
  sail.material = solid.clone();
  sail.material.side = THREE.DoubleSide;
  stem(root, [-0.15, 0.45, -0.5], [-0.9, 0.65, -0.49], 0.018, "#8c673e");
  const skin = "#d8b287",
    shirt = "#d7dfc8",
    pants = "#425a62";
  stem(root, [-0.1, 0.24, 0.23], [-0.17, 0.58, 0.3], 0.073, pants);
  stem(root, [0.17, 0.21, 0.04], [0.16, 0.6, 0.22], 0.074, pants);
  // The hips stay planted while the upper body reaches into each paddle stroke.
  const torso = new THREE.Group();
  torso.name = "Rowing torso";
  torso.position.set(0, 0.6, 0.24);
  root.add(torso);
  const body = mesh(
    new THREE.CylinderGeometry(0.125, 0.17, 0.41, 6),
    shirt,
    torso,
    0,
    0.15,
    0,
  );
  body.rotation.x = -0.22;
  const head = new THREE.Group();
  head.position.set(0, 0.455, -0.08);
  torso.add(head);
  mesh(new THREE.IcosahedronGeometry(0.133, 1), skin, head);
  const hair = mesh(
    new THREE.SphereGeometry(0.139, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.67),
    "#443c2e",
    head,
    0,
    0.032,
    0.01,
  );
  hair.rotation.x = 0.15;
  const shaft = stem(root, [0, 0, 0], [0, 1, 0], 0.021, "#ad9260");
  shaft.name = "Paddle shaft";
  const paddle = mesh(new THREE.SphereGeometry(1, 6, 3), "#d1b477", root);
  paddle.name = "Paddle blade";
  paddle.scale.set(0.13, 0.3, 0.035);
  const scarf = leaf(torso, 0.08, 0.28, 0.41, 0.43, "#729b8d", 0.2);
  scarf.rotation.z = -0.25;
  const arms = [-1, 1].map((side) => ({
    side,
    upper: stem(root, [0, 0, 0], [0, 1, 0], 0.045, shirt),
    lower: stem(root, [0, 0, 0], [0, 1, 0], 0.033, skin),
    hand: mesh(new THREE.IcosahedronGeometry(0.044, 1), skin, root),
  }));
  const up = new THREE.Vector3(0, 1, 0),
    direction = new THREE.Vector3(),
    grip = new THREE.Vector3(),
    tip = new THREE.Vector3(),
    shoulder = new THREE.Vector3(),
    elbow = new THREE.Vector3(),
    hand = new THREE.Vector3();
  function segment(object, a, b) {
    direction.subVectors(b, a);
    object.position.copy(a).add(b).multiplyScalar(0.5);
    object.scale.y = direction.length();
    object.quaternion.setFromUnitVectors(up, direction.normalize());
  }
  const cloth = sail.geometry.attributes.position,
    clothRest = cloth.array.slice();
  const motion = { paddle: new THREE.Vector3(), wet: 0, speed: 0 };
  let previousTime,
    previousAngle,
    speed = 0,
    turn = 0,
    phase = 0;
  return {
    root,
    motion,
    update(t, boat, rowing = true) {
      const dt =
        previousTime === undefined
          ? 0
          : Math.max(0, Math.min(0.05, t - previousTime));
      previousTime = t;
      const velocity = boat && rowing ? Math.hypot(boat.vx, boat.vz) : 0;
      speed += (velocity - speed) * (1 - Math.exp(-dt * 5));
      const effort = THREE.MathUtils.smoothstep(speed, 0.08, 1.4);
      phase += dt * (2.7 + Math.min(speed, 3) * 0.65);
      const cycle = (phase / (Math.PI * 2)) % 1;
      // A longer submerged pull followed by a quicker lifted recovery.
      const pulling = cycle < 0.61;
      const travel = pulling ? cycle / 0.61 : (cycle - 0.61) / 0.39;
      const eased = travel * travel * (3 - 2 * travel);
      const reach = pulling
        ? THREE.MathUtils.lerp(-0.85, 0.95, eased)
        : THREE.MathUtils.lerp(0.95, -0.85, eased);
      const lift = pulling
        ? -0.095
        : -0.095 + Math.sin(travel * Math.PI) * 0.62;
      root.position.x = boat ? boat.x : -0.5 + Math.sin(t * 0.25) * 0.16;
      if (boat) {
        root.position.z = boat.z;
        root.rotation.y = boat.angle;
        if (previousAngle !== undefined && dt > 0) {
          const delta = Math.atan2(
            Math.sin(boat.angle - previousAngle),
            Math.cos(boat.angle - previousAngle),
          );
          turn +=
            (THREE.MathUtils.clamp(delta / dt, -2, 2) - turn) *
            (1 - Math.exp(-dt * 4));
        }
        previousAngle = boat.angle;
      }
      root.position.y =
        Math.sin(t * 1.7) * 0.026 + Math.sin(phase * 2 - 0.5) * 0.014 * effort;
      root.rotation.x =
        Math.sin(t * 1.2) * 0.016 -
        speed * 0.012 +
        Math.cos(phase) * 0.024 * effort;
      root.rotation.z =
        Math.sin(t * 1.4) * 0.026 +
        Math.sin(phase - 0.4) * 0.045 * effort -
        turn * speed * 0.018;
      torso.rotation.set(
        -reach * 0.22 * effort + Math.sin(t * 1.5) * 0.025,
        -0.12 * effort + reach * 0.12 * effort,
        -0.035 * effort,
      );
      head.rotation.set(
        -torso.rotation.x * 0.35,
        -turn * 0.13,
        -torso.rotation.z * 0.6,
      );
      scarf.rotation.y = 0.2 + Math.sin(t * 3.2 - 0.6) * (0.17 + effort * 0.14);
      scarf.rotation.x = Math.sin(t * 2.6) * 0.13 + effort * 0.18;
      tip.set(
        0.67 + (pulling ? 0 : Math.sin(travel * Math.PI) * 0.18) * effort,
        THREE.MathUtils.lerp(0.24, lift, effort),
        THREE.MathUtils.lerp(0.72, reach, effort),
      );
      grip.set(
        0.08 + effort * 0.1,
        1.04 + Math.sin(phase) * 0.06 * effort,
        0.19 + reach * 0.19 * effort,
      );
      segment(shaft, grip, tip);
      paddle.position.copy(tip);
      paddle.quaternion.copy(shaft.quaternion);
      for (const arm of arms) {
        shoulder
          .set(arm.side * 0.13, 0.29, 0)
          .applyEuler(torso.rotation)
          .add(torso.position);
        hand.copy(grip).lerp(tip, arm.side < 0 ? 0 : 0.34);
        elbow.copy(shoulder).add(hand).multiplyScalar(0.5);
        elbow.x += arm.side * 0.13;
        elbow.y -= 0.12;
        elbow.z += 0.07;
        segment(arm.upper, shoulder, elbow);
        segment(arm.lower, elbow, hand);
        arm.hand.position.copy(hand);
      }
      // Cloth bends away from its fixed mast instead of rotating as a rigid plate.
      for (let i = 0; i < cloth.count; i++) {
        const x = clothRest[i * 3],
          y = clothRest[i * 3 + 1],
          z = clothRest[i * 3 + 2];
        const free =
          Math.min(1, Math.abs(x + 0.15) / 0.65) *
          THREE.MathUtils.smoothstep(y, 0.45, 1.1);
        cloth.setZ(
          i,
          z +
            free *
              (Math.sin(t * 2.4 + y * 3) * 0.055 +
                Math.sin(t * 4.3 - y * 4) * 0.025 +
                effort * 0.055),
        );
      }
      cloth.needsUpdate = true;
      sail.geometry.computeVertexNormals();
      root.updateMatrixWorld(true);
      motion.paddle.copy(tip).applyMatrix4(root.matrixWorld);
      motion.wet = pulling ? effort * Math.sin(travel * Math.PI) : 0;
      motion.speed = speed;
    },
  };
}

export function makeFloatingWood(scene) {
  const root = new THREE.Group();
  root.position.set(-5.2, 0.06, -7.4);
  scene.add(root);
  box(root, 0, 0.015, 0, 1.75, 0.09, 0.26, "#bcb494", 0.65);
  box(root, -0.1, 0, -0.25, 1.6, 0.1, 0.27, "#87996c", -0.28);
  box(root, 0.3, 0.025, 0.22, 1.45, 0.08, 0.31, "#d0c3a1", -0.14);
  return {
    update(t) {
      root.position.y = 0.065 + Math.sin(t * 0.8) * 0.025;
      root.rotation.y = Math.sin(t * 0.12) * 0.025;
      root.rotation.x = Math.sin(t * 0.7) * 0.01;
    },
  };
}

export { mesh, box, stem, leaf, barrel, pot, batchStatic };
