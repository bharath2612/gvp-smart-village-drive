// The lake: reflective animated water, marina with a boarding gate, islands, fountain, buoy course,
// boardwalk, lighthouse, lily pads, and lighting for sunset and night.
import * as THREE from 'three';
import { patchGeo, box, cyl, ico, merge, stdMat } from './geo.js';
import { instancedChunks } from './instancing.js';
import { pointInPolygon, rng } from '../util/math.js';

// Simple sky-gradient cube map so the water reflects a sky (tinted per preset via envMapIntensity/colour).
function skyCube(top = '#2f66b8', horizon = '#9fbfe0', ground = '#22381f') {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 64);
    if (i === 2) { grad.addColorStop(0, top); grad.addColorStop(1, top); } else if (i === 3) { grad.addColorStop(0, ground); grad.addColorStop(1, ground); }
    else { grad.addColorStop(0, top); grad.addColorStop(0.55, horizon); grad.addColorStop(0.6, ground); grad.addColorStop(1, ground); }
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64); faces.push(c);
  }
  const t = new THREE.CubeTexture(faces); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}

export function buildLake(ctx) {
  const { scene, world, T, colliders } = ctx;
  const pts = world.lake.points; const bb = world.lake.bbox;
  // Water surface: polygon in the XZ plane, face up. Shape y = -layout y, then rotate so shape y maps to +Z.
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, -y)));
  const g = new THREE.ShapeGeometry(shape, 1); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 30, pos.getZ(i) / 30);
  g.computeVertexNormals();
  const env = skyCube();
  const water = new THREE.MeshPhysicalMaterial({ color: 0x0f4f6e, roughness: 0.14, metalness: 0.0, transparent: true, opacity: 0.95, normalMap: T.waterNormal, envMap: env, envMapIntensity: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.2, specularIntensity: 0.6 });
  water.normalScale.set(0.55, 0.55);
  // Second, finer ripple layer blended in the shader for a livelier surface.
  water.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 }; water.userData.shader = sh;
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      #ifdef USE_NORMALMAP
        vec3 n1 = texture2D( normalMap, vNormalMapUv * 1.0 + vec2(uTime * 0.012, uTime * 0.008) ).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D( normalMap, vNormalMapUv * 3.1 - vec2(uTime * 0.021, -uTime * 0.017) ).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(vec3((n1.xy + n2.xy * 0.6) * normalScale, n1.z + n2.z));
        normal = normalize( tbn * mapN );
      #endif`).replace('void main() {', 'uniform float uTime;\nvoid main() {');
  };
  const mesh = new THREE.Mesh(g, water); mesh.position.y = 0.12; mesh.name = 'lake'; mesh.receiveShadow = true; scene.add(mesh);
  ctx.waterMat = water;
  // Wet shore band just above the sand.
  const rimShape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, -y)));
  const rim = new THREE.Mesh(new THREE.ShapeGeometry(rimShape), new THREE.MeshStandardMaterial({ color: 0x8a8272, roughness: 1 })); rim.geometry.rotateX(-Math.PI / 2);
  const c = bb; rim.scale.set(1.012, 1, 1.012); rim.position.set(-(c.x + c.w / 2) * 0.012, 0.05, -(c.y + c.h / 2) * 0.012); scene.add(rim);

  ctx.animate = ctx.animate || [];
  ctx.animate.push((dt, t) => { if (water.userData.shader) water.userData.shader.uniforms.uTime.value = t; if (ctx.poolMat) ctx.poolMat.normalMap.offset.set(t * 0.02, -t * 0.015); });
  ctx.lakeEnv = env;

  // ---------------------------------------------------------------- marina (west shore, by the parking lot)
  const wood = [], white = [], dark = [], glow = [], metal = [], stone = [];
  const mx = 2195, mz = 2500; // shore line x at the notch, marina centre
  const R = rng(1212);
  // Boardwalk from the parking lot edge to the shore, pier 34 m into the lake on piles.
  wood.push(box(12, 0.25, 8, 0x8b6a45, { x: mx - 5, z: mz, y: 0.3 }));
  wood.push(box(36, 0.3, 5, 0x8b6a45, { x: mx + 17, z: mz, y: 0.55 }));
  for (let x = mx + 1; x <= mx + 34; x += 4) for (const s of [-1, 1]) { wood.push(cyl(0.22, 0.25, 1.6, 6, 0x5a4330, { x, z: mz + s * 2.2, y: 0.2 })); wood.push(cyl(0.06, 0.06, 1.0, 6, 0x5a4330, { x, z: mz + s * 2.4, y: 1.2 })); }
  for (const s of [-1, 1]) wood.push(box(34, 0.08, 0.08, 0x5a4330, { x: mx + 18, z: mz + s * 2.4, y: 1.7 }));
  // Boathouse pavilion over the water beside the pier.
  const bhx = mx + 12, bhz = mz + 12;
  for (const [dx, dz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) wood.push(cyl(0.3, 0.3, 5.5, 8, 0x5a4330, { x: bhx + dx, z: bhz + dz, y: 2.75 }));
  wood.push(box(14, 0.3, 12, 0x8b6a45, { x: bhx, z: bhz, y: 0.6 }));
  wood.push(box(15, 0.4, 13, 0xa3452e, { x: bhx, z: bhz, y: 5.6 })); wood.push(box(11, 0.4, 9, 0xa3452e, { x: bhx, z: bhz, y: 6.4 })); wood.push(box(6, 0.4, 5, 0xa3452e, { x: bhx, z: bhz, y: 7.2 }));
  white.push(box(0.15, 1.0, 12, 0xf5f5f0, { x: bhx + 7, z: bhz, y: 1.25 })); white.push(box(14, 1.0, 0.15, 0xf5f5f0, { x: bhx, z: bhz + 6, y: 1.25 }));
  glow.push(box(14.6, 0.08, 0.12, 0xffe6c0, { x: bhx, z: bhz - 6.5, y: 5.3 })); glow.push(box(14.6, 0.08, 0.12, 0xffe6c0, { x: bhx, z: bhz + 6.5, y: 5.3 }));
  // Gate arch on the shore (the boarding point) with a sign and lanterns.
  for (const s of [-1, 1]) stone.push(box(1.2, 4.6, 1.2, 0xe4dccd, { x: mx - 9, z: mz + s * 5.2, y: 2.3 }));
  stone.push(box(1.4, 0.9, 12, 0xe4dccd, { x: mx - 9, z: mz, y: 5.1 })); stone.push(box(1.8, 0.3, 12.4, 0xc9a227, { x: mx - 9, z: mz, y: 5.7 }));
  for (const s of [-1, 1]) glow.push(box(0.5, 0.6, 0.5, 0xffe6c0, { x: mx - 9, z: mz + s * 5.2, y: 4.9 }));
  // Lantern posts along the pier.
  for (let x = mx + 5; x <= mx + 33; x += 7) for (const s of [-1, 1]) { wood.push(cyl(0.08, 0.1, 2.6, 6, 0x3a3f46, { x, z: mz + s * 2.0, y: 1.9 })); glow.push(box(0.35, 0.4, 0.35, 0xffe6c0, { x, z: mz + s * 2.0, y: 3.3 })); }
  colliders.add(mx - 9.8, mz - 6, mx - 8.2, mz - 4.4, 'marina'); colliders.add(mx - 9.8, mz + 4.4, mx - 8.2, mz + 6, 'marina');
  ctx.marina = { gate: { x: mx - 12, z: mz }, park: { x: mx - 16, z: mz + 9, yaw: Math.PI / 2 }, pierEnd: { x: mx + 27, z: mz - 6.8, yaw: Math.PI / 2 }, boathouse: { x: bhx, z: bhz } };
  ctx.lakeObstacles = [{ x: bhx, z: bhz, r: 9 }]; // circles the boat must avoid (islands, fountain, boathouse)
  for (let x = mx + 1; x <= mx + 36; x += 1) ctx.lakeObstacles.push({ x, z: mz, r: 3.1, pier: true });

  // ---------------------------------------------------------------- islands, fountain, buoys, boardwalk, lighthouse
  const island = (ix, iz, r, pav) => {
    const geo = new THREE.CylinderGeometry(r, r + 3, 1.4, 24); geo.translate(ix, 0.5, iz);
    const col = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) { col[i] = 0.78; col[i + 1] = 0.72; col[i + 2] = 0.55; } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); stone.push(geo);
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(r - 1.5, 24), stdMat(T, T.lawn)); lawn.rotation.x = -Math.PI / 2; lawn.position.set(ix, 1.22, iz); scene.add(lawn);
    if (pav) { for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) wood.push(cyl(0.25, 0.25, 3.6, 8, 0xf2ede4, { x: ix + dx, z: iz + dz, y: 1.2 + 1.8 })); wood.push(box(8.5, 0.4, 8.5, 0xc9a227, { x: ix, z: iz, y: 5.2 })); wood.push(box(6, 0.4, 6, 0xc9a227, { x: ix, z: iz, y: 5.8 })); glow.push(box(8.7, 0.08, 0.12, 0xffe6c0, { x: ix, z: iz - 4.35, y: 5.0 })); glow.push(box(8.7, 0.08, 0.12, 0xffe6c0, { x: ix, z: iz + 4.35, y: 5.0 })); }
    ctx.lakeObstacles.push({ x: ix, z: iz, r: r + 2.5 });
    ctx.islands = ctx.islands || []; ctx.islands.push({ x: ix, z: iz, r });
  };
  island(2450, 2350, 22, true); island(2705, 2705, 17, false); island(2560, 2790, 12, false);
  // Fountain in the middle of the lake: stone basin, three-tier jets (animated cones), splash ring.
  const fx = 2583, fz = 2505;
  stone.push(cyl(9, 10, 1.2, 24, 0xd9d0c0, { x: fx, z: fz, y: 0.6 })); stone.push(cyl(2.2, 2.6, 2.4, 12, 0xd9d0c0, { x: fx, z: fz, y: 1.8 })); stone.push(cyl(4.5, 4.5, 0.4, 16, 0xd9d0c0, { x: fx, z: fz, y: 3.0 }));
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const jets = new THREE.Group();
  for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI * 2; const h = i === 0 ? 16 : 9; const j = new THREE.Mesh(new THREE.ConeGeometry(i === 0 ? 1.4 : 0.8, h, 8, 1, true), jetMat); j.position.set(fx + (i === 0 ? 0 : Math.cos(a) * 3.2), 3.2 + h / 2, fz + (i === 0 ? 0 : Math.sin(a) * 3.2)); j.rotation.z = i === 0 ? 0 : -Math.cos(a) * 0.35; j.rotation.x = i === 0 ? 0 : Math.sin(a) * 0.35; jets.add(j); }
  scene.add(jets); ctx.lakeObstacles.push({ x: fx, z: fz, r: 12 });
  ctx.animate.push((dt, t) => { jets.children.forEach((j, i) => { j.scale.y = 0.9 + Math.sin(t * 3 + i) * 0.1; }); jetMat.opacity = 0.45 + Math.sin(t * 4) * 0.1; });
  // Buoy course: a loop of red and yellow buoys with blinking lights.
  const buoys = []; const loop = [[2360, 2200], [2560, 2190], [2800, 2260], [2830, 2500], [2800, 2720], [2620, 2840], [2400, 2800], [2330, 2620], [2340, 2420]];
  loop.forEach(([x, z], i) => buoys.push({ x, z, rot: R() * 6.28, color: new THREE.Color(i % 2 ? 0xd0342c : 0xffd35a) }));
  const buoyGeo = merge([cyl(0.7, 0.9, 1.2, 10, 0xffffff, { y: 0.6 }), cyl(0.12, 0.12, 2.2, 6, 0xffffff, { y: 2.2 }), ico(0.28, 1, 0xffffff, { y: 3.4 })]);
  scene.add(instancedChunks(buoyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), buoys, { name: 'buoys', chunk: 1000 }));
  ctx.buoys = buoys;
  const buoyLight = ico(0.3, 1, 0xffffff, { y: 3.4 }); scene.add(instancedChunks(buoyLight, ctx.lampHeadMat || new THREE.MeshStandardMaterial({ color: 0xffffff }), buoys.map((b) => ({ x: b.x, z: b.z })), { name: 'buoy-lights', chunk: 1000 }));
  // Boardwalk along the south shore with lamps; lighthouse on a rock at the south-east corner.
  wood.push(box(560, 0.3, 4, 0x8b6a45, { x: 2583, z: bb.y + bb.h - 4, y: 0.35 }));
  for (let x = 2320; x < 2850; x += 24) { wood.push(cyl(0.08, 0.1, 3.4, 6, 0x3a3f46, { x, z: bb.y + bb.h - 5.5, y: 2.0 })); glow.push(box(0.4, 0.45, 0.4, 0xffe6c0, { x, z: bb.y + bb.h - 5.5, y: 3.9 })); }
  const lx = 2848, lz = 2848;
  stone.push(cyl(6, 7, 1.6, 12, 0x8a8272, { x: lx, z: lz, y: 0.8 })); white.push(cyl(2.0, 2.6, 16, 12, 0xf5f5f0, { x: lx, z: lz, y: 9.6 })); dark.push(cyl(2.3, 2.3, 1.2, 12, 0xb8302a, { x: lx, z: lz, y: 6 })); dark.push(cyl(2.3, 2.3, 1.2, 12, 0xb8302a, { x: lx, z: lz, y: 12 }));
  glow.push(cyl(1.6, 1.6, 2.2, 12, 0xffe6c0, { x: lx, z: lz, y: 18.7 })); dark.push(cyl(0.2, 2.2, 1.4, 12, 0xb8302a, { x: lx, z: lz, y: 20.5 }));
  ctx.lakeObstacles.push({ x: lx, z: lz, r: 9 });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 90, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.rotateZ(Math.PI / 2); beam.geometry.translate(45, 0, 0); beam.position.set(lx, 18.7, lz); scene.add(beam); beam.material.userData.maxOpacity = 0.18; beam.material.visible = false; (ctx.poolMats = ctx.poolMats || []).push(beam.material);
  ctx.animate.push((dt, t) => { beam.rotation.y = t * 0.6; });
  // Lily pads in the calm north-west notch.
  const pads = []; for (let i = 0; i < 160; i++) pads.push({ x: 2200 + R() * 85, z: 2270 + R() * 470, rot: R() * 6.28, sx: 0.6 + R() * 0.8, sy: 1, sz: 0.6 + R() * 0.8 });
  const padGeo = new THREE.CircleGeometry(1, 10, 0.4, 5.6); padGeo.rotateX(-Math.PI / 2); padGeo.translate(0, 0.16, 0);
  const padCol = new Float32Array(padGeo.attributes.position.count * 3); for (let i = 0; i < padCol.length; i += 3) { padCol[i] = 0.25; padCol[i + 1] = 0.5; padCol[i + 2] = 0.22; } padGeo.setAttribute('color', new THREE.BufferAttribute(padCol, 3));
  scene.add(instancedChunks(padGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), pads, { name: 'lily-pads', chunk: 600 }));

  const add = (list, mat, name) => { const m = merge(list); if (!m) return; const mm = new THREE.Mesh(m, mat); mm.name = name; mm.castShadow = true; mm.receiveShadow = true; scene.add(mm); };
  add(wood, stdMat(T, T.roof, { vertexColors: true, roughness: 0.85 }), 'lake-wood');
  add(white, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'lake-white');
  add(dark, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'lake-dark');
  add(stone, stdMat(T, T.plaster, { vertexColors: true, roughness: 0.9 }), 'lake-stone');
  add(metal, stdMat(T, T.metal, { vertexColors: true, metalness: 0.4, roughness: 0.5 }), 'lake-metal');
  add(glow, ctx.templeLightMat || new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffd9a8, emissiveIntensity: 1.2 }), 'lake-lights');
  ctx.lakePolygon = pts;
  ctx.inLake = (x, z) => pointInPolygon(x, z, pts);
}
