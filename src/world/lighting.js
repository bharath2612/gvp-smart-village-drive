import * as THREE from 'three';
import { lerp } from '../util/math.js';

const PRESETS = {
  day: { sunEl: 58, sunAz: 210, sunColor: 0xfff1dc, sunI: 2.8, hemiSky: 0x9ec9ff, hemiGround: 0x6b7a4b, hemiI: 1.25, fog: 0xcfe0f2, fogNear: 350, fogFar: 1600, top: 0x2f6fd0, horizon: 0xcfe3f7, exposure: 1.1, lamps: 0, windows: 0, stars: 0, pools: 0, ambience: 'day' },
  // Sunset = about 6 pm: sun still 16 degrees up, warm but bright.
  sunset: { sunEl: 16, sunAz: 262, sunColor: 0xffb56b, sunI: 2.5, hemiSky: 0xe8b48a, hemiGround: 0x5a553f, hemiI: 0.95, fog: 0xf4d6b4, fogNear: 320, fogFar: 1300, top: 0x4a63a8, horizon: 0xfacd94, exposure: 1.05, lamps: 1.0, windows: 0.8, stars: 0, pools: 0.55, ambience: 'day' },
  // Night = deep blue sky, moonlit, with every street, garden and facade lit.
  night: { sunEl: 48, sunAz: 120, sunColor: 0x9db4ff, sunI: 0.45, hemiSky: 0x2c4478, hemiGround: 0x12182a, hemiI: 0.55, fog: 0x121d38, fogNear: 120, fogFar: 750, top: 0x0a1430, horizon: 0x26396a, exposure: 0.95, lamps: 2.4, windows: 1.5, stars: 1, pools: 1, ambience: 'night' },
};
export const PRESET_ORDER = ['day', 'sunset', 'night'];

export function buildLighting(ctx) {
  const { scene, renderer } = ctx;
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = ctx.qualityPreset.shadows;
  const R = ctx.qualityPreset.shadowRadius;
  sun.shadow.mapSize.set(ctx.qualityPreset.shadowMap, ctx.qualityPreset.shadowMap);
  sun.shadow.camera.left = -R; sun.shadow.camera.right = R; sun.shadow.camera.top = R; sun.shadow.camera.bottom = -R;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 900; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  scene.fog = new THREE.Fog(0xffffff, 300, 1500);

  // Sky dome shader: vertical gradient + sun glow + stars at night.
  const skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, stars: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3800, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars; varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 col = mix(horizon, top, pow(h, 0.55));
        float s = max(dot(vDir, sunDir), 0.0); col += sunColor * (pow(s, 600.0) * 1.6 + pow(s, 24.0) * 0.25 + pow(s, 3.0) * 0.06);
        if (stars > 0.0) { vec3 g = floor(vDir * 220.0); float st = step(0.995, hash(g)) * stars * smoothstep(0.02, 0.2, vDir.y); col += vec3(st) * 0.9; }
        gl_FragColor = vec4(col, 1.0); }`,
  }));
  sky.name = 'sky'; sky.frustumCulled = false; scene.add(sky);

  const state = { current: 'day', target: 'day', t: 1 };
  const cur = {};
  const applyPreset = (name, blend) => {
    const a = PRESETS[state.current], b = PRESETS[name];
    const mix = (ka, kb) => lerp(ka, kb, blend);
    const mixColor = (ca, cb) => new THREE.Color(ca).lerp(new THREE.Color(cb), blend);
    const el = mix(a.sunEl, b.sunEl) * Math.PI / 180, az = mix(a.sunAz, b.sunAz) * Math.PI / 180;
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    cur.sunDir = dir;
    sun.color.copy(mixColor(a.sunColor, b.sunColor)); sun.intensity = mix(a.sunI, b.sunI);
    hemi.color.copy(mixColor(a.hemiSky, b.hemiSky)); hemi.groundColor.copy(mixColor(a.hemiGround, b.hemiGround)); hemi.intensity = mix(a.hemiI, b.hemiI);
    scene.fog.color.copy(mixColor(a.fog, b.fog)); scene.fog.near = mix(a.fogNear, b.fogNear); scene.fog.far = mix(a.fogFar, b.fogFar);
    skyUniforms.top.value.copy(mixColor(a.top, b.top)); skyUniforms.horizon.value.copy(mixColor(a.horizon, b.horizon)); skyUniforms.sunDir.value.copy(dir); skyUniforms.sunColor.value.copy(sun.color); skyUniforms.stars.value = mix(a.stars, b.stars);
    renderer.toneMappingExposure = mix(a.exposure, b.exposure);
    if (ctx.lampHeadMat) ctx.lampHeadMat.emissiveIntensity = mix(a.lamps, b.lamps);
    if (ctx.glassMat) ctx.glassMat.emissiveIntensity = mix(a.windows, b.windows);
    if (ctx.bodyMat) ctx.bodyMat.emissiveIntensity = mix(a.windows, b.windows) * 0.22;
    const pools = mix(a.pools || 0, b.pools || 0); for (const m of ctx.poolMats || []) { m.opacity = pools * m.userData.maxOpacity; m.visible = pools > 0.02; }
    cur.night = mix(a.lamps, b.lamps) > 0.5;
    cur.ambience = blend > 0.5 ? b.ambience : a.ambience;
  };
  applyPreset('day', 1);
  ctx.lighting = {
    sun, hemi, sky, state, cur,
    set(name) { if (!PRESETS[name]) return; state.current = state.t >= 1 ? state.target : state.current; state.target = name; state.t = 0; },
    update(dt, carPos) {
      if (state.t < 1) { state.t = Math.min(1, state.t + dt / 0.9); applyPreset(state.target, state.t); if (state.t >= 1) state.current = state.target; }
      // Shadow frustum and sky follow the car.
      const d = cur.sunDir; sun.position.set(carPos.x + d.x * 400, d.y * 400, carPos.z + d.z * 400); sun.target.position.set(carPos.x, 0, carPos.z);
      // The sky dome follows the camera (not the car) so the title orbit and swoop never clip it.
      const cp = ctx.camera ? ctx.camera.position : carPos; sky.position.set(cp.x, 0, cp.z);
    },
    get name() { return state.target; },
    get isNight() { return cur.night; },
    get ambience() { return cur.ambience; },
  };
}
