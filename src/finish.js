import * as THREE from "three";

export function makeFinish(renderer, camera, quality = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: quality.samples ?? 4,
  });
  target.depthTexture = new THREE.DepthTexture(
    size.x,
    size.y,
    THREE.UnsignedIntType,
  );
  const uniforms = {
    tColor: { value: target.texture },
    tDepth: { value: target.depthTexture },
    resolution: { value: size },
    inverseProjection: { value: camera.projectionMatrixInverse },
    projection: { value: camera.projectionMatrix },
  };
  const material = new THREE.ShaderMaterial({
    defines: { AO_SAMPLES: quality.ao === false ? 0 : 8 },
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform sampler2D tColor,tDepth;uniform vec2 resolution;uniform mat4 inverseProjection,projection;varying vec2 vUv;
      vec3 positionAt(vec2 uv){float d=texture2D(tDepth,uv).r;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
      void main(){
        vec3 c=texture2D(tColor,vUv).rgb;
        vec3 p=positionAt(vUv),n=normalize(cross(dFdx(p),dFdy(p)));if(n.z<0.)n=-n;
        float ao=0.;
        for(int i=0;i<AO_SAMPLES;i++){
          float a=float(i)*2.399963,r=.12+float(i%3)*.22;
          vec2 offset=vec2(cos(a),sin(a))*r*vec2(projection[0][0],projection[1][1])*.5;
          vec3 q=positionAt(clamp(vUv+offset,vec2(.001),vec2(.999)))-p;
          float d=length(q);float horizon=max(dot(n,q/max(d,.0001))-.11,0.);
          ao+=horizon*(1.-smoothstep(.25,1.2,d));
        }
        float vegetationMask=smoothstep(.025,.09,c.g-max(c.r,c.b));
        c*=1.-min(ao/8.*.72,.16)*mix(1.,.4,vegetationMask);
        // Broad highlight diffusion stays below the level of a visible bloom halo.
        vec3 bloom=vec3(0.);
        for(int i=0;i<6;i++){
          float a=float(i)*1.0471976;vec3 tap=texture2D(tColor,vUv+vec2(cos(a),sin(a))*7./resolution).rgb;
          bloom+=max(tap-vec3(.72),vec3(0.));
        }
        c+=bloom*.018;
        float luminance=dot(c,vec3(.2126,.7152,.0722));
        c*=mix(vec3(.98,1.015,1.035),vec3(1.025,1.015,.975),smoothstep(.04,.6,luminance));
        c+=vec3(.007,.009,.008)*(1.-smoothstep(.02,.32,luminance));
        c=mix(vec3(luminance),c,.97);
        float vignette=smoothstep(.18,.77,length((vUv-.5)*vec2(.95,1.)));
        c*=1.-vignette*.065;
        gl_FragColor=vec4(max(c,vec3(0.)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const postScene = new THREE.Scene(),
    postCamera = new THREE.Camera();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  return {
    target,
    resize(w, h) {
      target.setSize(w, h);
      uniforms.resolution.value.set(w, h);
    },
    render() {
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
  };
}
