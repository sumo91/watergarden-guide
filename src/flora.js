import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { random, mesh, stem, box, batchStatic } from "./world.js";
import { painterNoise } from "./materials.js";

const grassMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  roughness: 1,
  emissive: "#547532",
  emissiveIntensity: 0.1,
});
const broadMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  roughness: 0.86,
});
const time = { value: 0 };
grassMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uWindTime = time;
  shader.vertexShader =
    "uniform float uWindTime; attribute float flex; varying vec3 vGrassWorld; varying float vGrassTip;\n" +
    shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <beginnormal_vertex>",
    `#include <beginnormal_vertex>
    objectNormal=normalize(vec3(objectNormal.x*.3,.9,objectNormal.z*.3));`,
  );
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
    float wind=sin(position.x*.75+position.z*.42+uWindTime*1.25)*.6+sin(position.z*1.6-uWindTime*.9)*.4;
    transformed.x+=wind*flex*.13; transformed.z+=wind*flex*.065;
    vGrassWorld=position;vGrassTip=clamp(flex,0.,1.);`,
  );
  shader.fragmentShader =
    `varying vec3 vGrassWorld; varying float vGrassTip; ${painterNoise}\n` +
    shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <color_fragment>",
    `#include <color_fragment>
    float grassWash=artFbm(vGrassWorld.xz*.54);
    diffuseColor.rgb*=mix(.9,1.08,grassWash);
    diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.86,.93,.8),diffuseColor.rgb,smoothstep(0.,.48,vGrassTip));`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_end>",
    `#include <lights_fragment_end>
    totalEmissiveRadiance+=diffuseColor.rgb*vGrassTip*.09;`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_begin>",
    `#include <normal_fragment_begin>
    normal*=faceDirection;`,
  );
};
grassMaterial.customProgramCacheKey = () => "grass-wrap-light-soft-v3";
broadMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uLeafTime = time;
  shader.vertexShader =
    "uniform float uLeafTime; varying vec2 vLeafUv;\n" + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
    vLeafUv=uv;transformed.x+=sin(uLeafTime*.9+position.x*.7+position.z*.4)*uv.y*uv.y*.045;`,
  );
  shader.fragmentShader = "varying vec2 vLeafUv;\n" + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <color_fragment>",
    `#include <color_fragment>
    float midrib=exp(-pow((vLeafUv.x-.5)*85.,2.));
    float veins=pow(max(0.,sin(vLeafUv.y*65.-abs(vLeafUv.x-.5)*35.)),16.);
    diffuseColor.rgb*=1.+midrib*.11+veins*.035;
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_end>",
    `#include <lights_fragment_end>
    float transmission=pow(max(dot(-geometryNormal,normalize(vec3(-.4,.8,-.4))),0.),2.);
    totalEmissiveRadiance+=diffuseColor.rgb*vec3(.62,.9,.28)*(.09+transmission*.25);
  `,
  );
};
broadMaterial.customProgramCacheKey = () => "leaf-translucency-v2";

function broadLeaf(root, start, angle, length, width, red = false) {
  const rows = 12,
    cols = 4,
    positions = [],
    uvs = [],
    colors = [],
    indices = [];
  const edge = new THREE.Color("#b5bd45"),
    green = new THREE.Color("#547c30"),
    coral = new THREE.Color("#c96943");
  for (let i = 0; i <= rows; i++) {
    const t = i / rows,
      bulge = Math.pow(Math.sin(Math.PI * t), 0.68),
      curl = Math.sin(t * Math.PI * 0.83) * length * 0.48;
    for (let j = 0; j <= cols; j++) {
      const s = (j / cols) * 2 - 1;
      uvs.push(j / cols, t);
      positions.push(
        s * width * bulge,
        curl - Math.pow(Math.abs(s), 1.5) * width * 0.25 * bulge,
        t * length,
      );
      const c = green
        .clone()
        .lerp(edge, Math.pow(Math.abs(s), 2) * 0.8 + t * 0.15);
      if (red)
        c.lerp(coral, Math.exp(-s * s * 5) * Math.sin(t * Math.PI) * 0.92);
      c.multiplyScalar(0.72 + t * 0.37);
      colors.push(c.r, c.g, c.b);
      if (i < rows && j < cols) {
        let a = i * (cols + 1) + j,
          b = a + cols + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  const leaf = new THREE.Mesh(g, broadMaterial);
  leaf.position.set(...start);
  leaf.rotation.y = angle;
  leaf.rotation.x = random(-0.48, -0.14);
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  root.add(leaf);
  return leaf;
}

export function makeFlora(scene, density = 1) {
  const root = new THREE.Group(),
    stalks = new THREE.Group();
  scene.add(root, stalks);
  const positions = [],
    colors = [],
    flex = [],
    indices = [];
  let offset = 0;
  const baseColor = new THREE.Color("#5b7935"),
    tipColor = new THREE.Color("#a6bd50");
  function blade(x, y, z, h, w, a) {
    const bend = random(0.32, 0.65) * h,
      dx = Math.cos(a),
      dz = Math.sin(a),
      shade = random(0.94, 1.06);
    for (let j = 0; j < 7; j++) {
      const t = j / 6,
        ww = w * Math.pow(Math.sin(Math.PI * (t * 0.87 + 0.13)), 0.85) * 0.5,
        c = baseColor
          .clone()
          .lerp(tipColor, t * 0.85)
          .multiplyScalar(shade);
      for (const side of [-1, 1]) {
        positions.push(
          x + dx * ww * side + dz * bend * t * t,
          y + (t - Math.pow(t, 4) * 0.17) * h,
          z + dz * ww * side - dx * bend * t * t,
        );
        colors.push(c.r, c.g, c.b);
        flex.push(t * t * h);
      }
      if (j < 6) {
        const i = offset + j * 2;
        indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
      }
    }
    offset += 14;
  }
  // An irregular ground ribbon fills the bank between the individual rocks.
  const groundPos = [],
    groundIdx = [];
  for (let k = 0; k <= 56; k++) {
    const z = -28 + k,
      edge = 13.2 + Math.sin(((z + 23) / 2.25) * 0.7) * 1.3;
    groundPos.push(
      edge,
      2.72,
      z,
      edge + 2,
      3.18,
      z,
      edge + 5,
      3.68,
      z,
      28,
      3.68,
      z,
    );
    if (k < 56) {
      for (let column = 0; column < 3; column++) {
        const j = k * 4 + column;
        groundIdx.push(j, j + 4, j + 1, j + 1, j + 4, j + 5);
      }
    }
  }
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(groundPos, 3),
  );
  groundGeo.setIndex(groundIdx);
  groundGeo.computeVertexNormals();
  mesh(groundGeo, "#4a6230", stalks);
  for (let i = 0; i < Math.floor(7800 * density); i++) {
    const z = random(-27, 28),
      edge = 13.2 + Math.sin(((z + 23) / 2.25) * 0.7) * 1.3,
      x = random(edge, 23),
      bankDistance = x - edge,
      y =
        bankDistance < 2
          ? 2.72 + bankDistance * 0.23
          : 3.18 + (Math.min(3, bankDistance - 2) / 3) * 0.5;
    blade(
      x,
      y,
      z,
      random(0.95, 1.95),
      random(0.28, 0.53),
      Math.sin(Math.floor(x * 0.7) * 1.9 + Math.floor(z * 0.7)) * 2.5 +
        random(-0.65, 0.65),
    );
  }
  // Smaller tufted patches beside the quay, with space left for the stonework.
  for (let i = 0; i < 800; i++) {
    const z = random(-22, -5),
      x = random(-10.2, -8.7);
    blade(x, 1.4, z, random(0.32, 0.85), random(0.07, 0.16), random(0, 6.28));
  }
  // Low shoreline rushes bridge the water and taller grass.
  for (let k = 0; k < 75; k++) {
    const z = random(-22, 24),
      x = 11.05 + Math.sin(((z + 23) / 2.25) * 0.7) * 1.3,
      y = random(0.1, 0.42);
    for (let j = 0; j < 10; j++)
      blade(
        x + random(-0.3, 0.3),
        y,
        z + random(-0.3, 0.3),
        random(0.6, 1.45),
        random(0.14, 0.25),
        random(0, 6.28),
      );
    if (k % 2 === 0) {
      const h = random(1.3, 2.05);
      stem(stalks, [x, y, z], [x + 0.05, y + h, z + 0.07], 0.017, "#839747");
      const cattail = mesh(
        new THREE.CapsuleGeometry(0.048, 0.28, 2, 5),
        "#75452e",
        stalks,
        x + 0.05,
        y + h - 0.07,
        z + 0.07,
      );
    }
  }
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  grassGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  grassGeo.setAttribute("flex", new THREE.Float32BufferAttribute(flex, 1));
  grassGeo.setIndex(indices);
  grassGeo.computeVertexNormals();
  const grass = new THREE.Mesh(grassGeo, grassMaterial);
  grass.castShadow = false;
  grass.receiveShadow = true;
  root.add(grass);
  // Large, cupped tropical leaves with lime rims and coral midribs.
  const plants = [
    [10.8, -2.5, 1],
    [11.7, 8, 1.05],
    [10.1, -12.3, 1.1],
    [-7.9, -12.2, 0.7],
    [12.6, 15.5, 1.2],
    [11.4, 3.2, 0.9],
    [-8.1, -6.3, 0.65],
  ];
  const broadRoot = new THREE.Group();
  scene.add(broadRoot);
  plants.forEach(([x, z, scale]) => {
    const y = x > 0 ? 0.5 : 0.1;
    for (let j = 0; j < 9; j++) {
      const a = (j / 9) * 6.28 + random(-0.2, 0.2),
        h = random(0.7, 1.75) * scale;
      const end = [
        x + Math.sin(a) * 0.3 * scale,
        y + h,
        z + Math.cos(a) * 0.3 * scale,
      ];
      stem(stalks, [x, y - 0.12, z], end, 0.026 * scale, "#789142");
      broadLeaf(
        broadRoot,
        end,
        a,
        random(0.85, 1.65) * scale,
        random(0.32, 0.52) * scale,
        j % 3 !== 0,
      );
    }
  });
  // A fallen limestone monolith and its split cap echo the narrow-channel reference.
  box(stalks, 9.2, -0.45, -16.7, 1.6, 1.3, 5.8, "#acae87", -0.43, 0.12);
  box(stalks, 7.8, -1.18, -13.3, 1.66, 1, 1.4, "#8b9e7b", -0.57, 0.1);
  batchStatic(stalks);
  broadRoot.updateMatrixWorld(true);
  const parts = [];
  broadRoot.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      parts.push(g.toNonIndexed());
    }
  });
  const merged = mergeGeometries(parts);
  broadRoot.clear();
  const broadMesh = new THREE.Mesh(merged, broadMaterial);
  broadMesh.castShadow = true;
  broadMesh.receiveShadow = true;
  broadRoot.add(broadMesh);
  parts.forEach((g) => g.dispose());
  return {
    update(t) {
      time.value = t;
    },
  };
}
