import * as THREE from 'three';
import { patchGeo, box, cyl, merge, stdMat } from './geo.js';
import { instancedChunks } from './instancing.js';
import { rng } from '../util/math.js';

// Returns the [a,b] intervals along a road's long axis where other roads cross it (junctions).
function junctionIntervals(road, roads) {
  const out = [];
  for (const o of roads) {
    if (o === road) continue;
    const ix0 = Math.max(road.x, o.x), ix1 = Math.min(road.x + road.w, o.x + o.w);
    const iz0 = Math.max(road.y, o.y), iz1 = Math.min(road.y + road.h, o.y + o.h);
    if (ix1 - ix0 <= 0.5 || iz1 - iz0 <= 0.5) continue;
    out.push(road.horizontal ? [ix0 - 1, ix1 + 1] : [iz0 - 1, iz1 + 1]);
  }
  return out;
}
function subtract(len, intervals) {
  const segs = []; let cur = 0;
  for (const [a, b] of intervals.sort((p, q) => p[0] - q[0])) { if (a > cur) segs.push([cur, Math.min(a, len)]); cur = Math.max(cur, b); }
  if (cur < len) segs.push([cur, len]);
  return segs.filter(([a, b]) => b - a > 0.5);
}

export function buildRoads(ctx) {
  const { scene, world, T, colliders } = ctx;
  const roads = world.roads;
  const asphalt = [], concrete = [], marks = [], kerbs = [], medians = [], bumps = [], zebras = [];
  const lampItems = [];
  ctx.bumps = [];

  for (const r of roads) {
    const isSpine = r.kind === 'spine';
    const surf = r.kind === '25m' ? concrete : asphalt;
    surf.push(patchGeo(r.x, r.y, r.w, r.h, 4, 0.06));
    const len = r.horizontal ? r.w : r.h; const wid = r.horizontal ? r.h : r.w;
    const jx = junctionIntervals(r, roads);
    const segs = subtract(len, jx);
    const along = (t, off, y, gw, gl) => (r.horizontal ? patchGeo(r.x + t, r.y + off - gw / 2, gl, gw, 1, y) : patchGeo(r.x + off - gw / 2, r.y + t, gw, gl, 1, y));
    // Edge lines and kerbs along non-junction segments.
    for (const [a, b] of segs) {
      for (const side of [0.5, wid - 0.5]) marks.push(along(a, side, 0.09, 0.15, b - a));
      for (const side of [-0.15, wid + 0.15]) {
        const kg = r.horizontal ? box(b - a, 0.15, 0.3, 0xb9b7b0, { x: r.x + a + (b - a) / 2, z: r.y + side }) : box(0.3, 0.15, b - a, 0xb9b7b0, { x: r.x + side, z: r.y + a + (b - a) / 2 });
        kerbs.push(kg);
      }
      // Centre dashes on 15 m and wider (not the spine: it has a median).
      if (!isSpine && (r.kind === '15m' || r.kind === '20m' || r.kind === '25m')) {
        for (let t = a + 2; t < b - 3; t += 9) marks.push(along(t, wid / 2, 0.09, 0.15, 3));
      }
      // Lamp posts every 40 m on 20 m and wider, both sides, 1.2 m inside the kerb.
      if (r.kind === '20m' || r.kind === '25m' || isSpine) {
        for (let t = a + 12; t < b - 6; t += 40) for (const side of [1.2, wid - 1.2]) {
          const x = r.horizontal ? r.x + t : r.x + side, z = r.horizontal ? r.y + side : r.y + t;
          const rot = r.horizontal ? (side < wid / 2 ? Math.PI : 0) : (side < wid / 2 ? -Math.PI / 2 : Math.PI / 2);
          lampItems.push({ x, z, rot });
          colliders.add(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 'lamp');
        }
      }
    }
    if (isSpine) {
      // Two 11 m carriageways with dashed lines, an 8 m planted median with kerbs, U-turn gaps every 200 m.
      const cx = r.x + r.w / 2;
      for (const [a, b] of segs) for (let t = a + 2; t < b - 3; t += 9) { marks.push(along(t, 5.5, 0.09, 0.15, 3)); marks.push(along(t, wid - 5.5, 0.09, 0.15, 3)); }
      for (let z = r.y + 15; z < r.y + r.h - 15; z += 200) {
        const segLen = Math.min(190, r.y + r.h - 15 - z);
        if (segLen < 20) break;
        medians.push(patchGeo(cx - 4, z, 8, segLen, 4, 0.2));
        kerbs.push(box(0.3, 0.22, segLen, 0xb9b7b0, { x: cx - 4, z: z + segLen / 2 }));
        kerbs.push(box(0.3, 0.22, segLen, 0xb9b7b0, { x: cx + 4, z: z + segLen / 2 }));
        kerbs.push(box(8.3, 0.22, 0.3, 0xb9b7b0, { x: cx, z: z })); kerbs.push(box(8.3, 0.22, 0.3, 0xb9b7b0, { x: cx, z: z + segLen }));
        colliders.add(cx - 4.2, z, cx + 4.2, z + segLen, 'median');
        ctx.medianSegments = ctx.medianSegments || []; ctx.medianSegments.push({ x: cx, z0: z, z1: z + segLen });
      }
    }
  }
  // Zebra crossings and speed bumps within 60 m of school, temple and parks.
  const hot = [...world.parks, ...world.amenities.filter((a) => a.id === 'school' || a.id === 'temple')];
  for (const h of hot) {
    for (const r of roads) {
      if (r.kind === 'spine' || r.kind === '25m') continue;
      const dx = Math.max(r.x - (h.x + h.w), h.x - (r.x + r.w), 0), dz = Math.max(r.y - (h.y + h.h), h.y - (r.y + r.h), 0);
      if (dx > 60 || dz > 60) continue;
      const wid = r.horizontal ? r.h : r.w;
      const t = r.horizontal ? Math.min(Math.max(h.x + h.w / 2, r.x + 30), r.x + r.w - 30) - r.x : Math.min(Math.max(h.y + h.h / 2, r.y + 30), r.y + r.h - 30) - r.y;
      for (let s = 0.8; s < wid - 0.8; s += 1.2) zebras.push(r.horizontal ? patchGeo(r.x + t - 2, r.y + s, 4, 0.6, 1, 0.09) : patchGeo(r.x + s, r.y + t - 2, 0.6, 4, 1, 0.09));
      for (const off of [-14, 14]) {
        const bx = r.horizontal ? r.x + t + off : r.x + 0.5, bz = r.horizontal ? r.y + 0.5 : r.y + t + off;
        const bw = r.horizontal ? 3 : wid - 1, bh = r.horizontal ? wid - 1 : 3;
        bumps.push(patchGeo(bx, bz, bw, bh, 1, 0.12));
        ctx.bumps.push({ x: bx, z: bz, w: bw, h: bh });
      }
    }
  }

  const add = (list, mat, name, shadow) => { const g = merge(list); if (!g) return; const m = new THREE.Mesh(g, mat); m.name = name; m.receiveShadow = true; m.castShadow = !!shadow; scene.add(m); };
  add(asphalt, stdMat(T, T.asphalt), 'roads-asphalt');
  add(concrete, stdMat(T, T.concrete, { color: 0xc9c7bf }), 'roads-concrete');
  add(marks, new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.6, emissive: 0x222222 }), 'road-marks');
  add(zebras, new THREE.MeshStandardMaterial({ color: 0xf5f5ef, roughness: 0.6, emissive: 0x222222 }), 'zebras');
  add(bumps, new THREE.MeshStandardMaterial({ color: 0xd9b23a, roughness: 0.8 }), 'speed-bumps');
  add(kerbs, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 'kerbs');
  add(medians, stdMat(T, T.lawn), 'medians');

  // Lamp posts: pole + arm (one instanced geometry) and an emissive head (second instanced mesh, toggled at night).
  const pole = merge([cyl(0.09, 0.14, 8, 8, 0x5a5f66), box(1.6, 0.12, 0.12, 0x5a5f66, { x: 0.8, y: 7.9 })]);
  const head = box(0.7, 0.2, 0.3, 0xfff2cc, { x: 1.4, y: 7.85 });
  const poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xffe6a8, emissiveIntensity: 0, roughness: 0.4 });
  const density = ctx.qualityPreset.lamps;
  const r = rng(99);
  const items = lampItems.filter(() => r() < density);
  scene.add(instancedChunks(pole, poleMat, items, { name: 'lamp-poles', castShadow: false }));
  scene.add(instancedChunks(head, headMat, items, { name: 'lamp-heads' }));
  ctx.lampHeadMat = headMat;
  ctx.lampItems = items;
}
