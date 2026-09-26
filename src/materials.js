import * as THREE from "three";

export const artTime = { value: 0 };

export const painterNoise = /* glsl */ `
float artHash(vec2 p) {
  vec3 q=fract(vec3(p.xyx)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float artNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(artHash(i),artHash(i+vec2(1,0)),f.x),mix(artHash(i+vec2(0,1)),artHash(i+1.),f.x),f.y);
}
float artFbm(vec2 p) {
  return artNoise(p)*.57+artNoise(p*2.03+13.1)*.29+artNoise(p*4.11-5.7)*.14;
}
float artCaustic(vec2 p,float t) {
  vec2 q=p*1.65+vec2(t*.09,-t*.055);
  float a=sin(q.x+sin(q.y*1.17+t*.21)*1.45);
  float b=sin(q.y*1.14+sin(q.x*.91-t*.19)*1.25);
  float ridge=1.-abs(a+b)*.5;
  return smoothstep(.90,.99,ridge)*(.45+.55*artNoise(q*.6));
}
`;

export function surfaceKind(hex) {
  const c = new THREE.Color(hex);
  if (c.r > c.g * 1.8) return 3;
  if (c.r > c.g * 1.14 && c.g > c.b * 1.2) return 1;
  if (c.g > c.r * 1.17 && c.g > c.b * 1.45) return 2;
  return 0;
}

export function makePainterMaterial() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.91,
    flatShading: false,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.artTime = artTime;
    shader.vertexShader =
      `attribute float artKind; attribute vec2 artUv;
      varying vec3 vArtWorld; varying vec3 vArtNormal;
      varying float vArtKind; varying vec2 vArtUv;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vArtWorld=(modelMatrix*vec4(position,1.)).xyz;
      vArtNormal=normalize(mat3(modelMatrix)*normal);
      vArtKind=artKind; vArtUv=artUv;`,
    );
    shader.fragmentShader =
      `uniform float artTime;
      varying vec3 vArtWorld; varying vec3 vArtNormal;
      varying float vArtKind; varying vec2 vArtUv;
      ${painterNoise}\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec3 wp=vArtWorld;
      vec3 axis=pow(abs(normalize(vArtNormal)),vec3(4.)); axis/=max(dot(axis,vec3(1.)),.0001);
      float pigment=artFbm(wp.yz*2.4)*axis.x+artFbm(wp.xz*2.4)*axis.y+artFbm(wp.xy*2.4)*axis.z;
      float wash=artFbm(wp.xz*.43+wp.y*.23);
      float stone=1.-step(.5,vArtKind);
      float wood=step(.5,vArtKind)*(1.-step(1.5,vArtKind));
      float foliage=step(1.5,vArtKind)*(1.-step(2.5,vArtKind));
      float wet=(1.-smoothstep(-.1,.55+pigment*.32,wp.y))*stone;
      // Broad washes and elongated pigment marks read as painted surfaces, not grain.
      diffuseColor.rgb*=mix(.94,1.04,pigment)*mix(.96,1.045,wash);
      float edge=min(min(vArtUv.x,1.-vArtUv.x),min(vArtUv.y,1.-vArtUv.y));
      float edgeWear=(1.-smoothstep(.012,.065,edge))*(.45+.55*pigment)*stone;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.12+vec3(.012,.011,.008),edgeWear*.2);
      float grain=artFbm(vec2(wp.x*24.+wp.z*18.,wp.y*.6+wp.z*.13));
      float fineGrain=sin(wp.x*75.+wp.z*49.+grain*9.);
      diffuseColor.rgb*=1.+wood*((grain-.5)*.14-fineGrain*.008);
      float moss=stone*smoothstep(.53,.69,artFbm(wp.xz*.9+wp.y*.35))*(1.-smoothstep(.9,2.3,wp.y));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.78,.9,.63),moss*.45);
      diffuseColor.rgb*=mix(vec3(1.),vec3(.8,.91,.9),wet*.45);
      float underwater=1.-smoothstep(-.6,-.12,wp.y);
      float caustic=artCaustic(wp.xz+wp.y*.2,artTime)*underwater;
      diffuseColor.rgb*=1.+caustic*.28*max(vArtNormal.y,.1);
      // Leaf roots stay dark; broad lit faces retain yellow-green pigment.
      diffuseColor.rgb*=mix(1.,.83+wash*.3,foliage);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      roughnessFactor=mix(.95,.61,wet*.7);
      roughnessFactor-=wood*.12;
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      vec3 sigmaX=dFdx(-vViewPosition),sigmaY=dFdy(-vViewPosition);
      vec3 rx=cross(sigmaY,normal),ry=cross(normal,sigmaX);
      float determinant=dot(sigmaX,rx);
      float height=artFbm(wp.xz*5.2+wp.y*2.7)*.003*stone;
      vec3 gradient=sign(determinant)*(dFdx(height)*rx+dFdy(height)*ry);
      normal=normalize(abs(determinant)*normal-gradient);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      `#include <lights_fragment_end>
      // Broad sky fill gives shaded stone a colored middle value.
      reflectedLight.indirectDiffuse*=vec3(.97,1.,1.025);
    `,
    );
  };
  material.customProgramCacheKey = () => "painted-surfaces-soft-v3";
  return material;
}

export function softenRockNormals(geometry) {
  const p = geometry.attributes.position,
    n = geometry.attributes.normal;
  const radial = new THREE.Vector3(),
    face = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    radial.fromBufferAttribute(p, i).normalize();
    face.fromBufferAttribute(n, i);
    face.lerp(radial, 0.82).normalize();
    n.setXYZ(i, face.x, face.y, face.z);
  }
}
