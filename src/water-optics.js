import * as THREE from "three";
import { painterNoise } from "./materials.js";
import { makeWaterScatter } from "./water-scatter.js";

export function makeWater(renderer, scene, camera, quality = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const refractScale = quality.refraction ?? 1,
    reflectScale = quality.reflection ?? 0.6;
  const target = new THREE.WebGLRenderTarget(
    Math.ceil(size.x * refractScale),
    Math.ceil(size.y * refractScale),
    {
      type: THREE.HalfFloatType,
      samples: quality.samples ?? 2,
    },
  );
  target.depthTexture = new THREE.DepthTexture(
    size.x,
    size.y,
    THREE.UnsignedIntType,
  );
  const reflection = new THREE.WebGLRenderTarget(
    Math.ceil(size.x * reflectScale),
    Math.ceil(size.y * reflectScale),
    { type: THREE.HalfFloatType },
  );
  const scatter = makeWaterScatter(renderer, size.x, size.y);
  const mirror = camera.clone();
  const reflectedDirection = new THREE.Vector3(),
    rotation = new THREE.Matrix4();
  const upNormal = new THREE.Vector3(0, 1, 0),
    lookAt = new THREE.Vector3();
  const textureMatrix = new THREE.Matrix4();
  const clipping = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.045)];
  const uniforms = {
    tScene: { value: target.texture },
    tSoftScene: { value: scatter.texture },
    tDepth: { value: target.depthTexture },
    tReflection: { value: reflection.texture },
    time: { value: 0 },
    resolution: { value: size },
    clarity: { value: 0.68 },
    eye: { value: camera.position },
    viewDirection: { value: new THREE.Vector3() },
    inverseViewProjection: { value: new THREE.Matrix4() },
    reflectionMatrix: { value: textureMatrix },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vWorld;varying vec4 vReflect;uniform mat4 reflectionMatrix;
      void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vReflect=reflectionMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform sampler2D tScene,tSoftScene,tDepth,tReflection;
      uniform float time,clarity;uniform vec2 resolution;uniform vec3 eye,viewDirection;
      uniform mat4 inverseViewProjection;varying vec3 vWorld;varying vec4 vReflect;
      ${painterNoise}
      vec3 worldPosition(vec2 uv,float depth){vec4 p=inverseViewProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/p.w;}
      float waveHeight(vec2 p){float t=time*.36;return sin(p.x*.96+p.y*1.7+t)*.026+sin(p.x*2.2-p.y*.72-t*.83)*.018+sin(p.x*3.7+p.y*2.3+t*.5)*.008;}
      void main(){
        vec2 p=vWorld.xz,uv=gl_FragCoord.xy/resolution;
        float h=waveHeight(p);
        vec2 slope=vec2(waveHeight(p+vec2(.06,0))-h,waveHeight(p+vec2(0,.06))-h)/.06;
        vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
        vec2 warp=slope*vec2(.035,.027);
        float surfaceDepth=gl_FragCoord.z;
        if(texture2D(tDepth,uv+warp).r<surfaceDepth)warp*=0.;
        vec2 refractUv=clamp(uv+warp,vec2(.001),vec2(.999));
        float floorDepth=texture2D(tDepth,refractUv).r;
        vec3 below=worldPosition(refractUv,floorDepth);
        float depth=max(.0,.015-below.y);
        vec3 under=texture2D(tScene,refractUv).rgb;
        float diffusion=smoothstep(.35,3.6,depth)*mix(.86,.58,clarity);
        under=mix(under,texture2D(tSoftScene,refractUv).rgb,diffusion);
        float density=mix(1.6,.72,clarity);
        vec3 transmission=exp(-depth*vec3(.58,.245,.205)*density);
        vec3 waterColor=mix(vec3(.016,.245,.177),vec3(.015,.086,.105),smoothstep(1.,7.,depth));
        // Scattered light follows the illumination of the submerged surfaces:
        // shadowed water keeps its depth instead of receiving a uniform fog veil.
        float underwaterLight=smoothstep(.025,.29,dot(under,vec3(.2126,.7152,.0722)));
        waterColor*=mix(.46,1.08,underwaterLight);
        vec3 c=under*transmission+waterColor*(1.-transmission);
        // The reflected camera renders only above-water geometry, with alpha as its mask.
        vec2 reflectUv=vReflect.xy/vReflect.w+slope*.095;
        vec2 reflectionSpread=vec2(2.4)/resolution;
        vec4 reflected=texture2D(tReflection,clamp(reflectUv,vec2(.001),vec2(.999)))*.4;
        reflected+=texture2D(tReflection,clamp(reflectUv+vec2(reflectionSpread.x,0),vec2(.001),vec2(.999)))*.15;
        reflected+=texture2D(tReflection,clamp(reflectUv-vec2(reflectionSpread.x,0),vec2(.001),vec2(.999)))*.15;
        reflected+=texture2D(tReflection,clamp(reflectUv+vec2(0,reflectionSpread.y),vec2(.001),vec2(.999)))*.15;
        reflected+=texture2D(tReflection,clamp(reflectUv-vec2(0,reflectionSpread.y),vec2(.001),vec2(.999)))*.15;
        float fresnel=.025+.975*pow(1.-max(dot(normal,normalize(-viewDirection)),0.),5.);
        vec3 sky=vec3(.16,.225,.24);
        vec3 reflectionColor=mix(sky,reflected.rgb*vec3(.66,.72,.74)+vec3(.008,.015,.013),reflected.a);
        float reflectionWeight=mix(.10+fresnel*.5,.40+fresnel*.4,reflected.a);
        c=mix(c,reflectionColor,clamp(reflectionWeight,.0,.86));
        // Soft light pools, not pixel-scale sparkles.
        float pool=artFbm(p*.105+vec2(6.8,3.2));
        float litPool=smoothstep(.25,.72,pool);
        c*=mix(.76,1.16,litPool);
        c+=vec3(.003,.021,.014)*litPool*smoothstep(.3,1.8,depth);
        // Broad moving washes retain water movement between the sparse highlights.
        vec2 washUv=p*.7+vec2(sin(p.y*.4+time*.17),cos(p.x*.38-time*.13))*.55;
        float waterWash=artFbm(washUv+vec2(time*.023,-time*.019));
        c*=mix(.94,1.075,smoothstep(.27,.72,waterWash));
        vec3 halfVector=normalize(normalize(vec3(-.4,.8,-.35))+normalize(-viewDirection));
        float spec=pow(max(dot(normal,halfVector),0.),85.);
        c+=vec3(.72,.77,.66)*spec*.12;
        float ridge=abs(sin(p.x*2.5+p.y*1.7+artNoise(p*.7+time*.05)*5.));
        float stroke=(1.-smoothstep(.013,.035,ridge))*smoothstep(.65,.82,artFbm(p*.38+vec2(time*.045,1.)));
        c+=vec3(.19,.25,.23)*stroke*.19;
        // Contact foam is driven by actual water depth, so it follows geometry.
        float shore=(1.-smoothstep(.025,.16,depth))*(.3+.7*artNoise(p*8.+time*.2));
        shore*=smoothstep(.005,.03,depth);
        c=mix(c,vec3(.54,.66,.55),shore*.17);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.015;
  water.name = "Reflection and refraction water";
  scene.add(water);
  return {
    water,
    uniforms,
    target,
    resize(w, h) {
      target.setSize(Math.ceil(w * refractScale), Math.ceil(h * refractScale));
      scatter.resize(w, h);
      reflection.setSize(
        Math.ceil(w * reflectScale),
        Math.ceil(h * reflectScale),
      );
      uniforms.resolution.value.set(w, h);
    },
    render(t, hidden = [], destination = null) {
      uniforms.time.value = t;
      camera.updateMatrixWorld();
      uniforms.inverseViewProjection.value.multiplyMatrices(
        camera.matrixWorld,
        camera.projectionMatrixInverse,
      );
      camera.getWorldDirection(uniforms.viewDirection.value);
      const visibility = hidden.map((o) => o.visible);
      water.visible = false;
      hidden.forEach((o) => (o.visible = false));
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      scatter.render(target.texture);
      // A half-resolution planar reflection retains silhouettes while avoiding a second full-size pass.
      mirror.copy(camera, false);
      mirror.position.copy(camera.position);
      mirror.position.y = 0.03 - camera.position.y;
      camera.getWorldDirection(reflectedDirection);
      reflectedDirection.reflect(upNormal);
      rotation.extractRotation(camera.matrixWorld);
      mirror.up.set(0, 1, 0).applyMatrix4(rotation).reflect(upNormal);
      lookAt.copy(mirror.position).add(reflectedDirection);
      mirror.lookAt(lookAt);
      mirror.updateMatrixWorld();
      textureMatrix.set(
        0.5,
        0,
        0,
        0.5,
        0,
        0.5,
        0,
        0.5,
        0,
        0,
        0.5,
        0.5,
        0,
        0,
        0,
        1,
      );
      textureMatrix
        .multiply(mirror.projectionMatrix)
        .multiply(mirror.matrixWorldInverse);
      const background = scene.background,
        clear = new THREE.Color();
      renderer.getClearColor(clear);
      const alpha = renderer.getClearAlpha();
      const previousClipping = renderer.clippingPlanes,
        shadowUpdate = renderer.shadowMap.autoUpdate;
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.clippingPlanes = clipping;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(reflection);
      renderer.render(scene, mirror);
      renderer.clippingPlanes = previousClipping;
      renderer.shadowMap.autoUpdate = shadowUpdate;
      scene.background = background;
      renderer.setClearColor(clear, alpha);
      water.visible = true;
      hidden.forEach((o, i) => (o.visible = visibility[i]));
      renderer.setRenderTarget(destination);
      renderer.render(scene, camera);
    },
  };
}
