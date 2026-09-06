// Night lighting that costs nothing per light: warm additive "pools" on the ground under every street lamp,
// bollard, garden light and stadium floodlight, plus garden bollards per plot. Opacity follows the preset.
import * as THREE from 'three';
import { cyl, box, merge } from './geo.js';
import { instancedChunks } from './instancing.js';
import { hashStr } from '../util/math.js';

function poolTexture(inner = 'rgba(255,214,140,1)', outer = 'rgba(255,190,110,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64); grad.addColorStop(0, inner); grad.addColorStop(0.45, 'rgba(255,205,130,0.45)'); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function poolMaterial(ctx, tex, maxOpacity, color = 0xffffff) {
  const m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  m.userData.maxOpacity = maxOpacity; m.visible = false;
  (ctx.poolMats = ctx.poolMats || []).push(m); return m;
}

export function buildLights(ctx) {
  const { scene, world, colliders } = ctx;
  const disc = new THREE.PlaneGeometry(2, 2); disc.rotateX(-Math.PI / 2); disc.translate(0, 0.14, 0);
  const warm = poolTexture(), lawn = poolTexture('rgba(220,255,170,0.9)', 'rgba(160,230,120,0)');
  const streetMat = poolMaterial(ctx, warm, 0.7), gardenMat = poolMaterial(ctx, lawn, 0.32), facadeMat = poolMaterial(ctx, warm, 0.45), stadiumMat = poolMaterial(ctx, warm, 0.55, 0xdfe8ff);

  // Street lamps and bollards (collected by roads.js).
  const street = (ctx.lightPoints || []).map((p) => ({ x: p.x, z: p.z, sx: p.r, sy: 1, sz: p.r }));
  scene.add(instancedChunks(disc, streetMat, street, { name: 'light-pools-street', chunk: 400 }));

  // Garden lights: bollards at the lawn corners of every villa, town house and farm pad, with a soft lawn pool.
  const gb = merge([cyl(0.06, 0.07, 0.55, 6, 0x3a3f46, { y: 0.275 }), box(0.2, 0.05, 0.2, 0x3a3f46, { y: 0.58 })]);
  const gbCap = cyl(0.07, 0.07, 0.1, 6, 0xfff2cc, { y: 0.52 });
  const gardenPosts = [], gardenPools = [], facadePools = [];
  const r = (id, k) => (hashStr(id + k) % 1000) / 1000;
  for (const p of world.plots) {
    if (p.type === 'villa') {
      const front = p.facing === 'S' ? p.y + p.h : p.y;
      for (const [x, z] of [[p.x + 1.2, p.y + 1.2], [p.x + p.w - 1.2, p.y + 1.2], [p.x + 1.2, p.y + p.h - 1.2], [p.x + p.w - 1.2, p.y + p.h - 1.2]]) gardenPosts.push({ x, z });
      // Two uplights either side of the gate on the front boundary.
      for (const dx of [-4.5, 4.5]) gardenPosts.push({ x: p.x + p.w / 2 + dx, z: front + (p.facing === 'S' ? -0.8 : 0.8) });
      gardenPools.push({ x: p.cx, z: p.cy, sx: 17, sy: 1, sz: 17 });
      // Warm facade wash in front of the verandah.
      const fz = p.facing === 'S' ? p.house.y + p.house.h + 2 : p.house.y - 2;
      facadePools.push({ x: p.house.x + p.house.w / 2, z: fz, sx: 12, sy: 1, sz: 6 });
    } else if (p.type === 'townhouse') {
      const front = p.facing === 'S' ? p.y + p.h - 1 : p.y + 1;
      gardenPosts.push({ x: p.x + 1, z: front }); gardenPosts.push({ x: p.x + p.w - 1, z: front });
      gardenPools.push({ x: p.cx, z: front + (p.facing === 'S' ? -2 : 2), sx: 9, sy: 1, sz: 6 });
    } else if (p.type === 'farm' && p.pad) {
      const q = p.pad;
      for (const [x, z] of [[q.x + 1, q.y + 1], [q.x + q.w - 1, q.y + 1], [q.x + 1, q.y + q.h - 1], [q.x + q.w - 1, q.y + q.h - 1], [q.x + q.w / 2, q.y + 1], [q.x + q.w / 2, q.y + q.h - 1]]) gardenPosts.push({ x, z });
      gardenPools.push({ x: q.x + q.w / 2, z: q.y + q.h / 2, sx: q.w * 0.75, sy: 1, sz: q.h * 0.75 });
      if (p.pool) facadePools.push({ x: p.pool.x + p.pool.w / 2, z: p.pool.y + p.pool.h / 2, sx: p.pool.w + 4, sy: 1, sz: p.pool.h + 4 });
    } else if (p.type === 'commercial') {
      const fx = p.facing === 'E' ? p.x + p.w - 3 : p.x + 3;
      facadePools.push({ x: fx, z: p.cy, sx: 8, sy: 1, sz: 22 });
    }
  }
  const postMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 });
  scene.add(instancedChunks(gb, postMat, gardenPosts, { name: 'garden-lights', chunk: 300 }));
  scene.add(instancedChunks(gbCap, ctx.lampHeadMat || postMat, gardenPosts, { name: 'garden-light-caps', chunk: 300 }));
  scene.add(instancedChunks(disc, gardenMat, gardenPools, { name: 'light-pools-garden', chunk: 400 }));
  scene.add(instancedChunks(disc, facadeMat, facadePools, { name: "light-pools-facade", chunk: 400 }));

  // Parks and temple: bollards along the paths.
  const parkPosts = [];
  for (const pk of world.parks) for (let x = pk.x + 8; x < pk.x + pk.w - 4; x += 16) { parkPosts.push({ x, z: pk.y + pk.h / 2 - 3 }); parkPosts.push({ x: x + 8, z: pk.y + pk.h / 2 + 3 }); }
  const temple = world.amenities.find((a) => a.id === 'temple');
  if (temple) { const cx = temple.x + temple.w / 2, cz = temple.y + temple.h / 2; for (let t = -90; t <= 90; t += 12) { if (Math.abs(t) < 40) continue; parkPosts.push({ x: cx + t, z: cz - 5.5 }); parkPosts.push({ x: cx + t, z: cz + 5.5 }); parkPosts.push({ x: cx - 5.5, z: cz + t }); parkPosts.push({ x: cx + 5.5, z: cz + t }); } }
  scene.add(instancedChunks(gb, postMat, parkPosts, { name: 'park-lights', chunk: 400 }));
  scene.add(instancedChunks(gbCap, ctx.lampHeadMat || postMat, parkPosts, { name: 'park-light-caps', chunk: 400 }));
  scene.add(instancedChunks(disc, streetMat, parkPosts.map((p) => ({ ...p, sx: 5, sy: 1, sz: 5 })), { name: 'light-pools-park', chunk: 400 }));

  // Stadium floodlight pools over the pitch and stands.
  const st = world.amenities.find((a) => a.id === 'stadium');
  if (st) { const cx = st.x + st.w / 2, cz = st.y + st.h / 2; const items = [{ x: cx, z: cz, sx: 190, sy: 1, sz: 200 }]; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) items.push({ x: cx + sx * 60, z: cz + sz * 55, sx: 90, sy: 1, sz: 90 }); scene.add(instancedChunks(disc, stadiumMat, items, { name: 'light-pools-stadium', chunk: 1000 })); }
  // Temple: uplight pools at the tower corners and mandapa, plus soft warm light beams rising up the gopuram.
  if (temple) {
    const cx = temple.x + temple.w / 2, cz = temple.y + temple.h / 2, tz = cz - 8, mz = cz + 18;
    const tp = [{ x: cx, z: tz, sx: 46, sy: 1, sz: 46 }, { x: cx, z: mz, sx: 44, sy: 1, sz: 44 }];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tp.push({ x: cx + sx * 17, z: tz + sz * 17, sx: 18, sy: 1, sz: 18 });
    const templePoolMat = poolMaterial(ctx, warm, 0.9, 0xfff1d6);
    scene.add(instancedChunks(disc, templePoolMat, tp, { name: 'light-pools-temple', chunk: 1000 }));
    const bc = document.createElement('canvas'); bc.width = 32; bc.height = 256; const bg = bc.getContext('2d');
    const grad = bg.createLinearGradient(0, 256, 0, 0); grad.addColorStop(0, 'rgba(255,225,170,0.9)'); grad.addColorStop(0.35, 'rgba(255,210,150,0.35)'); grad.addColorStop(1, 'rgba(255,200,140,0)');
    bg.fillStyle = grad; bg.fillRect(0, 0, 32, 256);
    const side = bg.createLinearGradient(0, 0, 32, 0); side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
    bg.globalCompositeOperation = 'destination-out'; bg.fillStyle = side; bg.fillRect(0, 0, 32, 256);
    const beamTex = new THREE.CanvasTexture(bc); beamTex.colorSpace = THREE.SRGBColorSpace;
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    beamMat.userData.maxOpacity = 0.55; beamMat.visible = false; ctx.poolMats.push(beamMat);
    const beamGeo = new THREE.PlaneGeometry(4.5, 38); beamGeo.translate(0, 19 + 1.5, 0);
    const beams = new THREE.Group();
    const spots = [[-15.5, -15.5], [15.5, -15.5], [-15.5, 15.5], [15.5, 15.5], [0, -16.2], [0, 16.2], [-16.2, 0], [16.2, 0]];
    for (const [dx, dz] of spots) for (const rot of [0, Math.PI / 2]) { const m = new THREE.Mesh(beamGeo, beamMat); m.position.set(cx + dx, 0, tz + dz); m.rotation.y = rot; beams.add(m); }
    beams.name = 'temple-beams'; scene.add(beams);
  }
  // Gate house and temple plinth wash.
  const gate = [{ x: 1500, z: 2985, sx: 40, sy: 1, sz: 24 }];
  if (temple) gate.push({ x: temple.x + temple.w / 2, z: temple.y + temple.h / 2, sx: 80, sy: 1, sz: 80 });
  scene.add(instancedChunks(disc, streetMat, gate, { name: 'light-pools-landmarks', chunk: 1000 }));
  ctx.lightCounts = { street: street.length, garden: gardenPosts.length, park: parkPosts.length };
}
