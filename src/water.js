import * as THREE from "three";

const noise = `
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.04+7.2)*.28+noise(p*4.1+1.8)*.15;}
`;

export function makeWake(scene) {
  const group = new THREE.Group();
  scene.add(group);
  group.position.set(-0.5, 0.06, 1);
  group.rotation.y = -0.17;
  const uniforms = { time: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time;varying vec2 vUv;${noise}
    void main(){
      float z=(1.-vUv.y)*16.,x=(vUv.x-.5)*10.;
      float width=.18+z*.25;
      float t=time*1.5;
      float n=fbm(vec2(x*3.5,z*2.5-t));
      float bend=sin(z*1.6-time*.38)*(.035+z*.008)+(noise(vec2(z*2.8,time*.23))-.5)*(.035+z*.025);
      float edge=abs(abs(x+bend)-width);
      float breakup=smoothstep(.29,.58,fbm(vec2(z*1.25-time*.19,sign(x)*6.3)));
      float arms=exp(-edge*edge/(.0007+z*.000075))*.3*breakup;
      float second=exp(-pow((abs(x-bend*.7)-width*.86)/.026,2.))*.1*breakup;
      float inner=0.;
      float coreWidth=.15+z*.145;
      float core=(1.-smoothstep(coreWidth*.3,coreWidth+.15,abs(x+(n-.5)*.4)));
      float foam=core*smoothstep(.43,.66,n+sin(z*1.7-t)*.11);
      foam*=1.-smoothstep(3.5,10.,z);
      float broken=smoothstep(.66,.78,n)* (1.-smoothstep(width*.4,width,abs(x)))*smoothstep(3.,5.,z);
      float alpha=max(foam*.8,broken*.58)+arms+second+inner;
      alpha*=smoothstep(.15,.7,z)*(1.-smoothstep(10.,16.,z));
      if(alpha<.012)discard;
      vec3 c=mix(vec3(.68,.89,.83),vec3(.97,.98,.88),smoothstep(.3,.8,foam+broken));
      gl_FragColor=vec4(c,min(alpha,.94));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), mat);
  wake.rotation.x = -Math.PI / 2;
  wake.position.z = 8;
  wake.renderOrder = 4;
  group.add(wake);
  // Droplets break up the sharp bow and give the small craft a sense of speed.
  const geo = new THREE.IcosahedronGeometry(0.035, 0),
    splash = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: "#e3eee0",
        transparent: true,
        opacity: 0.8,
      }),
      65,
    );
  splash.frustumCulled = false;
  splash.renderOrder = 5;
  group.add(splash);
  const dummy = new THREE.Object3D();
  return {
    group,
    update(t, boat) {
      uniforms.time.value = t;
      group.position.x = boat ? boat.x : -0.5 + Math.sin(t * 0.25) * 0.16;
      if (boat) {
        group.position.z = boat.z;
        group.rotation.y = boat.angle;
        const speed = Math.hypot(boat.vx, boat.vz);
        group.scale.set(1, 1, Math.max(0.05, Math.min(0.65, speed / 4.5)));
        group.visible = speed > 0.12;
      }
      for (let i = 0; i < 65; i++) {
        const age = (t * 0.7 + i * 0.071) % 1,
          a = i * 2.4;
        dummy.position.set(
          Math.sin(a) * (0.22 + age * 0.5),
          Math.sin(age * Math.PI) * 0.22,
          0.1 + age * 1.7,
        );
        dummy.scale.setScalar((1 - age) * (0.45 + (i % 4) * 0.3));
        dummy.updateMatrix();
        splash.setMatrixAt(i, dummy.matrix);
      }
      splash.instanceMatrix.needsUpdate = true;
    },
  };
}
