import * as THREE from "three";
import { box, mesh, stem, batchStatic } from "./world.js";
import { MISSIONS, REEFS, CURRENTS } from "./game.js";

export function makeGameWorld(scene) {
  const props = new THREE.Group();
  scene.add(props);
  // A line of small buoys marks the downstream edge of the playable garden.
  for (let i = 0; i < 12; i++) {
    const x = -7 + i * 1.45;
    const buoy = mesh(
      new THREE.SphereGeometry(0.14, 8, 5),
      i % 2 ? "#cfba86" : "#947d56",
      props,
      x,
      0.06,
      22.15,
    );
    buoy.castShadow = false;
    if (i < 11)
      stem(props, [x, 0.04, 22.15], [x + 1.45, 0.04, 22.15], 0.014, "#968b66");
  }
  for (const reef of REEFS.slice(0, 3)) {
    const rock = mesh(
      new THREE.DodecahedronGeometry(1, 1),
      "#82977d",
      props,
      reef.x,
      -0.38,
      reef.z,
    );
    rock.scale.set(reef.r, 0.83, reef.r);
    stem(
      props,
      [reef.x, 0.36, reef.z],
      [reef.x, 1.15, reef.z],
      0.026,
      "#9b8660",
    );
    const flag = mesh(
      new THREE.PlaneGeometry(0.42, 0.28),
      "#c4b985",
      props,
      reef.x + 0.2,
      1.02,
      reef.z,
    );
    flag.rotation.y = -0.2;
  }
  const shrines = MISSIONS.map((m) => {
    const root = new THREE.Group();
    root.position.set(m.home.x, 0, m.home.z);
    scene.add(root);
    const bowl = mesh(
      new THREE.TorusGeometry(2.18, 0.13, 6, 32),
      "#a9b18b",
      root,
      0,
      -0.07,
      0,
    );
    bowl.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      box(
        root,
        Math.cos(a) * 2.2,
        -0.12,
        Math.sin(a) * 2.2,
        0.22,
        0.38,
        0.22,
        "#bdba8e",
      );
    }
    box(root, 0, 0.2, -2.2, 0.65, 0.5, 0.65, "#b6b596");
    const lanternMaterial = new THREE.MeshStandardMaterial({
      color: "#9d9472",
      emissive: new THREE.Color(m.color),
      emissiveIntensity: 0,
      roughness: 0.8,
    });
    const lantern = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 1),
      lanternMaterial,
    );
    lantern.position.set(0, 0.87, -2.2);
    root.add(lantern);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.1, 48),
      new THREE.MeshBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.055;
    root.add(ring);
    const flowers = new THREE.Group();
    root.add(flowers);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.399963,
        f = new THREE.Group();
      f.position.set(Math.cos(a) * 1.8, 0.13, Math.sin(a) * 1.8);
      for (let j = 0; j < 5; j++) {
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 6, 4),
          new THREE.MeshStandardMaterial({
            color: i % 2 ? "#efa98a" : "#e5cb91",
            roughness: 1,
          }),
        );
        petal.position.set(
          Math.cos(j * 1.256) * 0.14,
          0.045,
          Math.sin(j * 1.256) * 0.14,
        );
        petal.scale.set(0.7, 0.4, 1.5);
        petal.rotation.y = -j * 1.256;
        f.add(petal);
      }
      flowers.add(f);
    }
    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.62, 5, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    halo.position.set(0, 3, -2.2);
    root.add(halo);
    return { root, lantern, ring, flowers, halo };
  });
  batchStatic(props);
  const fishGeo = new THREE.BufferGeometry();
  fishGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, -0.33, -0.09, 0.025, -0.03, 0, 0.055, 0.15, 0.09, 0.025, -0.03, 0,
        -0.025, 0.07, -0.105, 0, 0.29, 0, 0, 0.22, 0.105, 0, 0.29,
      ],
      3,
    ),
  );
  fishGeo.setIndex([
    0, 1, 2, 0, 2, 3, 0, 4, 1, 0, 3, 4, 1, 4, 2, 3, 2, 4, 2, 5, 6, 2, 6, 7,
  ]);
  fishGeo.computeVertexNormals();
  const fish = new THREE.InstancedMesh(
    fishGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: false,
      side: THREE.DoubleSide,
    }),
    72,
  );
  fish.frustumCulled = false;
  scene.add(fish);
  const dummy = new THREE.Object3D(),
    color = new THREE.Color();
  for (let i = 0; i < 72; i++)
    fish.setColorAt(i, color.set(MISSIONS[Math.floor(i / 24)].color));
  const bell = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1, 64),
    new THREE.MeshBasicMaterial({
      color: "#fff0b6",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  bell.rotation.x = -Math.PI / 2;
  bell.renderOrder = 5;
  scene.add(bell);
  const streams = new THREE.Group();
  scene.add(streams);
  const streamMaterial = new THREE.MeshBasicMaterial({
    color: "#d2e6c7",
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const streaks = [];
  CURRENTS.forEach((c) => {
    for (let i = 0; i < 16; i++) {
      const streak = new THREE.Mesh(
        new THREE.PlaneGeometry(0.025, 0.3 + (i % 3) * 0.12),
        streamMaterial,
      );
      streak.rotation.x = -Math.PI / 2;
      streak.rotation.z = -Math.atan2(c.dx, c.dz);
      streams.add(streak);
      streaks.push({ streak, c, i });
    }
  });
  const fireflyGeo = new THREE.BufferGeometry(),
    fireflyPositions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    fireflyPositions[i * 3] = Math.sin(i * 2.4) * 9;
    fireflyPositions[i * 3 + 1] = 0.5 + (i % 9) * 0.3;
    fireflyPositions[i * 3 + 2] = Math.cos(i * 1.1) * 18;
  }
  fireflyGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(fireflyPositions, 3),
  );
  const fireflies = new THREE.Points(
    fireflyGeo,
    new THREE.PointsMaterial({
      color: "#ffdfa0",
      size: 0.06,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  scene.add(fireflies);
  return {
    hidden: [bell, streams, fireflies],
    update(game, t) {
      for (let i = 0; i < 72; i++) {
        const f = game.fish[i];
        dummy.position.set(f.x, -0.24 - Math.sin(t * 1.7 + i) * 0.035, f.z);
        dummy.rotation.set(0, f.angle + Math.sin(t * 5 + i) * 0.07, 0);
        dummy.scale.setScalar(0.7 + (i % 5) * 0.07);
        dummy.updateMatrix();
        fish.setMatrixAt(i, dummy.matrix);
      }
      fish.instanceMatrix.needsUpdate = true;
      shrines.forEach((s, i) => {
        const restored = game.results.length > i,
          active = game.mission === i;
        s.lantern.material.emissiveIntensity = restored
          ? 2.1
          : active
            ? 0.18
            : 0;
        s.lantern.rotation.y = t * 0.35;
        s.ring.material.opacity = restored
          ? 0.22
          : active
            ? 0.14 + Math.sin(t * 2) * 0.055
            : 0.045;
        s.flowers.scale.setScalar(
          restored
            ? i === game.mission
              ? Math.min(1, 0.08 + (3.8 - game.transition) * 0.3)
              : 1
            : 0.001,
        );
        s.halo.material.opacity =
          restored && game.transition > 0 ? (0.07 * game.transition) / 3.8 : 0;
      });
      bell.position.set(game.boat.x, 0.1, game.boat.z);
      bell.scale.setScalar((1.5 - game.bellPulse) * 4 + 0.3);
      bell.material.opacity = Math.max(0, game.bellPulse / 1.5) * 0.55;
      for (const { streak, c, i } of streaks) {
        const phase = (t * 0.32 + i * 0.13) % 1,
          side = Math.sin(i * 4.5) * c.r * 0.65;
        streak.position.set(
          c.x + c.dx * (phase - 0.5) * 5 + c.dz * side,
          0.045,
          c.z + c.dz * (phase - 0.5) * 5 - c.dx * side,
        );
      }
      fireflies.material.opacity = game.results.length * 0.16;
      fireflies.rotation.y = Math.sin(t * 0.06) * 0.06;
    },
  };
}
