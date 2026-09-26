import * as THREE from "three";

// Diffusion is applied to transmitted light only. Above-water silhouettes never
// pass through this filter; the water shader controls its strength with depth.
export function makeWaterScatter(renderer, width, height) {
  const options = { type: THREE.HalfFloatType, depthBuffer: false };
  const horizontal = new THREE.WebGLRenderTarget(1, 1, options);
  const vertical = new THREE.WebGLRenderTarget(1, 1, options);
  const uniforms = {
    source: { value: null },
    stepSize: { value: new THREE.Vector2() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform sampler2D source;uniform vec2 stepSize;varying vec2 vUv;
      void main(){
        vec4 c=texture2D(source,vUv)*.227027;
        c+=texture2D(source,clamp(vUv+stepSize*1.384615,vec2(.001),vec2(.999)))*.316216;
        c+=texture2D(source,clamp(vUv-stepSize*1.384615,vec2(.001),vec2(.999)))*.316216;
        c+=texture2D(source,clamp(vUv+stepSize*3.230769,vec2(.001),vec2(.999)))*.070270;
        c+=texture2D(source,clamp(vUv-stepSize*3.230769,vec2(.001),vec2(.999)))*.070270;
        gl_FragColor=c;
      }`,
  });
  const scene = new THREE.Scene(),
    camera = new THREE.Camera();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  function resize(w, h) {
    width = w;
    height = h;
    horizontal.setSize(Math.ceil(w * 0.5), Math.ceil(h * 0.5));
    vertical.setSize(Math.ceil(w * 0.5), Math.ceil(h * 0.5));
  }
  resize(width, height);
  return {
    texture: vertical.texture,
    resize,
    render(texture) {
      // Proportional to image height, so captures and high-DPI views agree.
      const radius = (height / 900) * 1.65;
      uniforms.source.value = texture;
      uniforms.stepSize.value.set(radius / width, 0);
      renderer.setRenderTarget(horizontal);
      renderer.render(scene, camera);
      uniforms.source.value = horizontal.texture;
      uniforms.stepSize.value.set(0, radius / height);
      renderer.setRenderTarget(vertical);
      renderer.render(scene, camera);
    },
  };
}
