import * as THREE from "three";

const noise = `
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.04+7.2)*.28+noise(p*4.1+1.8)*.15;}
`;

export function makeWake(scene) {
  // Every sample is born in world space. Steering cannot rotate older water.
  const group = new THREE.Group();
  group.name = "Lingering wake and paddle ripples";
  group.visible = false;
  scene.add(group);
  const lifetime = 5.2,
    capacity = 180,
    patchCount = 80,
    dropCount = 36;
  const uniforms = { time: { value: 0 } };
  const samples = [];
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(capacity * 6);
  const uvs = new Float32Array(capacity * 4);
  const ages = new Float32Array(capacity * 2);
  const strengths = new Float32Array(capacity * 2);
  for (const [name, array, size] of [
    ["position", positions, 3],
    ["uv", uvs, 2],
    ["age", ages, 1],
    ["strength", strengths, 1],
  ])
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage),
    );
  const indices = [];
  for (let i = 0; i < capacity - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(indices);
  geometry.setDrawRange(0, 0);
  const ribbon = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `attribute float age,strength;varying vec2 vUv;varying vec3 vWorld;varying float vAge,vStrength;
      void main(){vUv=uv;vAge=age;vStrength=strength;vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time;varying vec2 vUv;varying vec3 vWorld;varying float vAge,vStrength;${noise}
      void main(){
        float n=fbm(vWorld.xz*3.7+vec2(time*.11,-time*.08));
        float x=abs(vUv.x+sin(vUv.y*3.1-time*.7)*.035);
        float edge=.73+(n-.5)*.16;
        float breakup=smoothstep(.32,.66,fbm(vec2(vUv.y*1.9,time*.18)));
        float arms=exp(-pow((x-edge)/(.032+vAge*.012),2.))*breakup;
        float inner=exp(-pow((x-edge*.78)/.05,2.))*.16*breakup;
        float churn=fbm(vec2(vUv.x*4.2,vUv.y*3.1-time*.28)+n*.65);
        float foam=smoothstep(.43,.72,churn)*(1.-smoothstep(.05,.62,x));
        float fade=smoothstep(0.,.18,vAge)*(1.-smoothstep(2.5,5.2,vAge));
        float alpha=(foam*.57*exp(-vAge*.4)+arms*.30+inner)*fade*vStrength;
        alpha*=1.-smoothstep(.87,1.,x);
        if(alpha<.008)discard;
        gl_FragColor=vec4(mix(vec3(.52,.76,.69),vec3(.86,.94,.84),foam*.8+arms*.2),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  );
  ribbon.name = "Recorded water trail";
  ribbon.renderOrder = 4;
  ribbon.frustumCulled = false;
  group.add(ribbon);

  // Short, broken eddies outlive each individual pull of the paddle.
  const patchGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const births = new Float32Array(patchCount).fill(-100);
  const powers = new Float32Array(patchCount);
  patchGeo.setAttribute(
    "born",
    new THREE.InstancedBufferAttribute(births, 1).setUsage(
      THREE.DynamicDrawUsage,
    ),
  );
  patchGeo.setAttribute(
    "power",
    new THREE.InstancedBufferAttribute(powers, 1).setUsage(
      THREE.DynamicDrawUsage,
    ),
  );
  const patches = new THREE.InstancedMesh(
    patchGeo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `uniform float time;attribute float born,power;varying vec2 vUv;varying float vAge,vPower;
      void main(){vUv=uv;vAge=max(0.,time-born);vPower=power;vec3 p=position*(1.+min(vAge,3.2)*.7);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float time;varying vec2 vUv;varying float vAge,vPower;${noise}
      void main(){
        vec2 p=vUv*2.-1.;
        float n=fbm(p*4.+vec2(vAge*.28,0.));
        float r=length(p)+(n-.5)*.19;
        float rim=exp(-pow((r-.58)/.05,2.));
        float arc=smoothstep(.24,.64,noise(p*5.+vAge*.3));
        float foam=smoothstep(.55,.76,n)*(1.-smoothstep(.1,.53,r))*exp(-vAge*2.);
        float fade=smoothstep(0.,.1,vAge)*(1.-smoothstep(.6,3.2,vAge));
        float alpha=(rim*arc*.19+foam*.34)*fade*vPower;
        if(alpha<.006)discard;
        gl_FragColor=vec4(.83,.93,.84,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
    patchCount,
  );
  patches.name = "Paddle eddies";
  patches.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  patches.frustumCulled = false;
  patches.renderOrder = 5;
  group.add(patches);

  const droplets = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.025, 0),
    new THREE.MeshBasicMaterial({
      color: "#d5e5d4",
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
    dropCount,
  );
  droplets.name = "Paddle spray";
  droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  droplets.frustumCulled = false;
  droplets.renderOrder = 6;
  group.add(droplets);
  const drops = Array.from({ length: dropCount }, () => ({ born: -100 }));
  const dummy = new THREE.Object3D();
  const lastBoat = new THREE.Vector2();
  let previousTime,
    previousSample,
    travel = 0,
    patchIndex = 0,
    dropIndex = 0;
  let paddleClock = 0,
    sternClock = 0;
  function addPatch(t, x, z, scale, power, angle) {
    const i = patchIndex++ % patchCount;
    births[i] = t;
    powers[i] = power;
    dummy.position.set(x, 0.048, z);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(scale, 1, scale * 0.72);
    dummy.updateMatrix();
    patches.setMatrixAt(i, dummy.matrix);
    patches.instanceMatrix.needsUpdate = true;
    patchGeo.attributes.born.needsUpdate = true;
    patchGeo.attributes.power.needsUpdate = true;
  }
  return {
    group,
    update(t, boat, motion) {
      const dt =
        previousTime === undefined
          ? 0
          : Math.max(0, Math.min(0.05, t - previousTime));
      const reset =
        previousTime === undefined ||
        t < previousTime ||
        (boat && Math.hypot(boat.x - lastBoat.x, boat.z - lastBoat.y) > 4);
      previousTime = t;
      uniforms.time.value = t;
      if (!boat) return;
      if (reset) {
        samples.length = 0;
        previousSample = undefined;
        travel = 0;
        births.fill(-100);
        patchGeo.attributes.born.needsUpdate = true;
        drops.forEach((drop) => {
          drop.born = -100;
        });
        lastBoat.set(boat.x, boat.z);
      }
      const moved = Math.hypot(boat.x - lastBoat.x, boat.z - lastBoat.y);
      lastBoat.set(boat.x, boat.z);
      const speed = Math.hypot(boat.vx, boat.vz);
      const sin = Math.sin(boat.angle),
        cos = Math.cos(boat.angle);
      const x = boat.x + sin * 0.86,
        z = boat.z + cos * 0.86;
      const distance = previousSample
        ? Math.hypot(x - previousSample.x, z - previousSample.z)
        : 0;
      if (
        dt > 0 &&
        speed > 0.12 &&
        moved > 0.0001 &&
        (!previousSample ||
          distance > 0.085 ||
          (t - previousSample.born > 0.16 && distance > 0.015))
      ) {
        travel += distance;
        previousSample = {
          x,
          z,
          nx: cos,
          nz: -sin,
          born: t,
          distance: travel,
          power: Math.min(1, speed / 2.5),
        };
        samples.push(previousSample);
      }
      while (
        samples.length &&
        (t - samples[0].born > lifetime || samples.length > capacity)
      )
        samples.shift();
      for (let i = 0; i < samples.length; i++) {
        const p = samples[i],
          age = t - p.born;
        const width = 0.22 + p.power * 0.14 + age * (0.23 + p.power * 0.08);
        const drift = Math.sin(age * 1.4 + p.distance * 1.3) * age * 0.018;
        for (let side = 0; side < 2; side++) {
          const j = i * 2 + side,
            across = side * 2 - 1;
          positions[j * 3] = p.x + p.nx * (across * width + drift);
          positions[j * 3 + 1] = 0.038;
          positions[j * 3 + 2] = p.z + p.nz * (across * width + drift);
          uvs[j * 2] = across;
          uvs[j * 2 + 1] = p.distance;
          ages[j] = age;
          strengths[j] = p.power;
        }
      }
      geometry.setDrawRange(0, Math.max(0, samples.length - 1) * 6);
      for (const attribute of Object.values(geometry.attributes))
        attribute.needsUpdate = true;
      sternClock += dt;
      if (
        speed > 0.18 &&
        moved > 0.0001 &&
        sternClock > 0.18 + (patchIndex % 3) * 0.055
      ) {
        sternClock = 0;
        const offset = Math.sin(patchIndex * 2.399) * 0.15;
        addPatch(
          t,
          x + cos * offset,
          z - sin * offset,
          0.19 + speed * 0.022 + (patchIndex % 4) * 0.018,
          Math.min(0.38, speed / 7),
          boat.angle + offset * 2,
        );
      }
      paddleClock += dt;
      if (dt > 0 && motion?.wet > 0.2 && paddleClock > 0.16) {
        paddleClock = 0;
        addPatch(
          t,
          motion.paddle.x,
          motion.paddle.z,
          0.2,
          motion.wet,
          boat.angle + 0.6,
        );
        for (let k = 0; k < 2; k++) {
          const index = dropIndex++ % dropCount,
            a = index * 2.399;
          drops[index] = {
            born: t,
            x: motion.paddle.x,
            z: motion.paddle.z,
            vx: Math.cos(a) * 0.32 + sin * 0.24,
            vz: Math.sin(a) * 0.32 + cos * 0.24,
            vy: 0.6 + (index % 3) * 0.13,
          };
        }
      }
      let liveDrops = false;
      for (let i = 0; i < dropCount; i++) {
        const p = drops[i],
          age = t - p.born;
        const live = age >= 0 && age < 0.6;
        liveDrops ||= live;
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(live ? Math.max(0, 1 - age / 0.6) : 0);
        if (live)
          dummy.position.set(
            p.x + p.vx * age,
            0.055 + Math.max(0, p.vy * age - 1.9 * age * age),
            p.z + p.vz * age,
          );
        dummy.updateMatrix();
        droplets.setMatrixAt(i, dummy.matrix);
      }
      droplets.instanceMatrix.needsUpdate = true;
      group.visible =
        samples.length > 1 ||
        births.some((born) => t - born < 3.2) ||
        liveDrops;
    },
  };
}
