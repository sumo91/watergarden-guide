import * as THREE from "three";
import { random, mesh, box, stem, barrel, pot, batchStatic } from "./world.js";

function roofLeaf(root, side, u, v) {
  const ridgeY = 7.7,
    eaveY = 4.25,
    halfX = 3.3,
    halfZ = 3.3;
  const p = [],
    idx = [];
  const rows = 8,
    columns = 4;
  for (let j = 0; j <= rows; j++)
    for (let k = 0; k <= columns; k++) {
      const leafT = j / rows,
        leafS = (k / columns) * 2 - 1,
        t = v + leafT * 0.32,
        taper = Math.sqrt(Math.max(0.002, 1 - Math.pow(leafT, 4))),
        s = u + leafS * 0.205 * taper;
      let x, z;
      if (side < 2) {
        x = (side === 0 ? 1 : -1) * (t * halfX);
        z = s * halfZ * t * 1.04;
      } else {
        z = (side === 2 ? 1 : -1) * t * halfZ;
        x = s * halfX * t * 1.04;
      }
      // Keep every shingle above the structural roof. A convex sweep and a
      // rounded leaf tip make the eaves overlap instead of exposing flat facets.
      const y =
        ridgeY +
        0.1 -
        (ridgeY - eaveY) * t +
        Math.sin(Math.min(t, 1) * Math.PI) * 0.25 +
        Math.sin(leafT * Math.PI) * 0.075 +
        (1 - leafS * leafS) * 0.065;
      p.push(x, y, z);
      if (j < rows && k < columns) {
        let a = j * (columns + 1) + k,
          b = a + columns + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  mesh(
    g,
    ["#718145", "#7e8c4e", "#879353", "#6c7b42"][Math.floor(random(0, 4))],
    root,
    0,
    0,
    0,
    0.025,
  );
}
function lantern(root, x, y, z) {
  box(root, x, y, z, 0.22, 0.4, 0.2, "#ffc86b", 0, 0.025);
  mesh(new THREE.ConeGeometry(0.2, 0.18, 4), "#5a3924", root, x, y + 0.27, z);
  mesh(new THREE.ConeGeometry(0.17, 0.1, 4), "#62452b", root, x, y - 0.23, z);
  for (const dx of [-0.12, 0.12])
    stem(
      root,
      [x + dx, y - 0.22, z + 0.1],
      [x + dx, y + 0.21, z + 0.1],
      0.019,
      "#5b4227",
    );
  stem(root, [x, y + 0.35, z], [x, y + 0.62, z], 0.016, "#70532c");
}
function crate(root, x, y, z, s = 0.65) {
  box(root, x, y + s / 2, z, s, s, s, "#97714d", 0, 0.025);
  for (const a of [-0.4, -0.2, 0, 0.2, 0.4])
    box(
      root,
      x + a * s,
      y + s / 2,
      z + s * 0.505,
      0.017,
      s * 0.9,
      0.012,
      "#503f2b",
      0,
      0,
    );
  for (const a of [-0.37, 0.37])
    box(
      root,
      x,
      y + s / 2 + a * s,
      z + s * 0.52,
      s * 0.97,
      0.07,
      0.045,
      "#b0875e",
    );
  const brace = box(
    root,
    x,
    y + s / 2,
    z + s * 0.53,
    s * 1.15,
    0.06,
    0.04,
    "#b0875e",
  );
  brace.rotation.z = 0.73;
}

export function makeHut(scene) {
  const root = new THREE.Group();
  root.position.set(-13.15, 0, -9);
  scene.add(root);
  // Planked porch with an uneven outer edge and visible supporting piles.
  for (let i = 0; i < 16; i++)
    box(
      root,
      -3.65 + i * 0.48,
      1.52,
      0.75,
      0.46,
      0.22,
      8.5 + random(-0.16, 0.16),
      random() > 0.5 ? "#967450" : "#876447",
      0,
      0.024,
    );
  for (let i = 0; i < 6; i++)
    for (const z of [-3, 4.8])
      stem(
        root,
        [-3.4 + i * 1.35, -2.7, z],
        [-3.4 + i * 1.35, 1.55, z],
        0.15,
        "#604c35",
      );
  box(root, 0, 1.22, 4.7, 7.6, 0.38, 0.26, "#695139");
  // Warm timber walls, vertical framing, and a deep-set red entrance.
  for (let k = 0; k < 10; k++) {
    const y = 1.73 + k * 0.255;
    box(root, 0, y, -2.45, 5.2, 0.245, 0.13, "#705039");
    for (const x of [-2.6, 2.6])
      box(root, x, y, 0, 0.13, 0.245, 4.85, k % 2 ? "#76563b" : "#7e5b40");
    box(root, -1.82, y, 2.45, 1.55, 0.245, 0.14, "#8d5d3e");
    box(root, 1.82, y, 2.45, 1.55, 0.245, 0.14, "#8d5d3e");
  }
  for (const x of [-2.62, 2.62])
    for (const z of [-2.45, 2.45])
      box(root, x, 2.95, z, 0.19, 2.8, 0.21, "#493a2b");
  box(root, 0, 2.6, 2.31, 1.78, 2.13, 0.17, "#453428");
  for (let i = 0; i < 7; i++)
    box(
      root,
      -0.71 + i * 0.235,
      2.62,
      2.43,
      0.22,
      2.05,
      0.055,
      i % 2 ? "#963f30" : "#8d392d",
    );
  box(root, 0, 3.63, 2.52, 2.15, 0.17, 0.23, "#b38655");
  box(root, 0, 1.59, 2.65, 2.25, 0.18, 0.48, "#b99a6b");
  for (const x of [-1.02, 1.02])
    box(root, x, 2.6, 2.53, 0.14, 2.07, 0.19, "#ad7c4e");
  box(root, 0, 2.45, 2.52, 1.56, 0.07, 0.05, "#c29561");
  mesh(
    new THREE.TorusGeometry(0.064, 0.015, 4, 9),
    "#cdaa57",
    root,
    0.59,
    2.54,
    2.55,
  );
  for (const side of [-1, 1])
    stem(root, [0, 4.5, 2.6], [side * 2.8, 3.45, 2.6], 0.095, "#ad7d4d");
  box(root, 0, 4.12, 0, 5.8, 0.2, 5.65, "#4b402c");
  const underRoof = new THREE.BufferGeometry();
  underRoof.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 7.65, 0, -3.4, 4.12, -3.4, 3.4, 4.12, -3.4, 3.4, 4.12, 3.4, -3.4,
        4.12, 3.4,
      ],
      3,
    ),
  );
  underRoof.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
  underRoof.computeVertexNormals();
  mesh(underRoof, "#5e693b", root);
  // Shingled leaf roof: broad overlapping strips with curled, irregular eaves.
  for (let side = 0; side < 4; side++)
    for (let row = 0; row < 4; row++)
      for (let col = -3; col <= 3; col++)
        roofLeaf(root, side, col * 0.29, row * 0.23 + 0.045);
  stem(root, [0, 7.5, -0.3], [0, 7.9, 0.25], 0.08, "#b29559");
  // Rope lashings around porch posts and a white canvas awning.
  const clothGeo = new THREE.PlaneGeometry(3.1, 2.5, 12, 12);
  clothGeo.rotateX(-Math.PI / 2);
  const cp = clothGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i),
      z = cp.getZ(i);
    cp.setY(
      i,
      Math.cos(x * 1.8) * 0.07 - (1 - Math.pow(x / 1.55, 2)) * 0.28 + z * 0.17,
    );
  }
  clothGeo.computeVertexNormals();
  mesh(clothGeo, "#d8d3ad", root, 1.95, 3.65, 4.0, 0.025);
  for (const x of [0.3, 3.5])
    stem(root, [x, 1.59, 5.1], [x, 4.03, 5.1], 0.058, "#705032");
  stem(root, [0.3, 4.03, 5.1], [3.5, 4.03, 5.1], 0.043, "#8d7248");
  for (const x of [0.3, 3.5])
    for (let i = 0; i < 3; i++) {
      const ring = mesh(
        new THREE.TorusGeometry(0.07, 0.013, 4, 8),
        "#c3ad74",
        root,
        x,
        3.72 + i * 0.045,
        5.1,
      );
      ring.rotation.x = Math.PI / 2;
    }
  // Rugs, cushions, pottery, crates, and a low outdoor table.
  const rug = mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.025, 9),
    "#a34d49",
    root,
    1.75,
    1.655,
    3.88,
  );
  rug.scale.z = 0.85;
  const table = box(root, 1.95, 2.15, 4, 1.2, 0.12, 0.72, "#637544");
  for (const x of [1.5, 2.4])
    for (const z of [3.75, 4.25])
      stem(root, [x, 1.65, z], [x, 2.1, z], 0.04, "#816645");
  for (const [x, z, s, c] of [
    [0.9, 3.8, 0.43, "#b35436"],
    [2.8, 4.1, 0.33, "#71506c"],
    [1.4, 4.65, 0.28, "#c9a181"],
  ]) {
    const cushion = mesh(
      new THREE.SphereGeometry(1, 9, 5),
      c,
      root,
      x,
      1.89,
      z,
    );
    cushion.scale.set(s, 0.2, s);
  }
  pot(root, -1.9, 1.65, 3.4, 0.9);
  pot(root, 1.7, 2.23, 4, 0.38, "#b98356");
  pot(root, 2.2, 2.23, 4.1, 0.27, "#747d73");
  crate(root, -2.75, 1.67, 2.7, 0.7);
  crate(root, -2.4, 1.67, 1.9, 0.55);
  barrel(root, -3, 1.67, -1, 1.05);
  // Ladder down to the water, with its lowest rung submerged.
  for (const z of [2.7, 3.5])
    stem(root, [4, -1.4, z], [3.7, 1.7, z], 0.055, "#8f6f47");
  for (let i = 0; i < 9; i++)
    stem(
      root,
      [4 - i * 0.033, -1.3 + i * 0.34, 2.7],
      [4 - i * 0.033, -1.3 + i * 0.34, 3.5],
      0.038,
      "#b08b58",
    );
  lantern(root, 0, 3.86, 2.9);
  lantern(root, -2.75, 3.48, 2.75);
  // A coil of rope lies beside the pots.
  for (let i = 0; i < 4; i++) {
    const coil = mesh(
      new THREE.TorusGeometry(0.18 + i * 0.043, 0.025, 4, 16),
      "#b4a47a",
      root,
      -1,
      1.67,
      3.7,
    );
    coil.rotation.x = Math.PI / 2;
  }
  // Glowing panes remain warm even where the roof casts a deep shadow.
  const windowMat = new THREE.MeshStandardMaterial({
    color: "#e8aa57",
    emissive: "#d88828",
    emissiveIntensity: 0.7,
    roughness: 1,
  });
  const windowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.9),
    windowMat,
  );
  windowMesh.position.set(-15.825, 3.05, -9.4);
  windowMesh.rotation.y = -Math.PI / 2;
  scene.add(windowMesh);
  for (const z of [-0.72, -0.27, 0.18])
    box(root, -2.69, 3.05, z, 0.09, 1.1, 0.06, "#483c29");
  for (const y of [2.54, 3.07, 3.58])
    box(root, -2.69, y, -0.27, 0.09, 0.055, 1.06, "#483c29");
  const lamp = new THREE.PointLight("#ffc479", 8, 5, 2);
  lamp.position.set(-13.15, 3.72, -6.05);
  scene.add(lamp);
  batchStatic(root);
  return { position: new THREE.Vector3(-12, 1, -7) };
}
