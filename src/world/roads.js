import * as THREE from 'three';
import { patchGeo, box, cyl, merge, stdMat } from './geo.js';
import { instancedChunks } from './instancing.js';
import { rng } from '../util/math.js';

// Returns the [a,b] intervals along a road's long axis where other roads cross it (junctions).
export function junctionIntervals(road, roads, margin = () => 1) {
  const out = [];
  for (const o of roads) {
    if (o === road) continue;
    const m = margin(o);
    const ix0 = Math.max(road.x, o.x), ix1 = Math.min(road.x + road.w, o.x + o.w);
    const iz0 = Math.max(road.y, o.y), iz1 = Math.min(road.y + road.h, o.y + o.h);
    // Roads that merely touch (a 20 m road ending on the boundary road) still form a junction mouth.
    if (ix1 - ix0 < -0.5 || iz1 - iz0 < -0.5) continue;
    if (ix1 - ix0 <= 0.5 && iz1 - iz0 <= 0.5) continue; // corner touch only
    // Intervals are relative to the road's own start so they can be subtracted from [0, len].
    out.push(road.horizontal ? [ix0 - road.x - m, ix1 - road.x + m] : [iz0 - road.y - m, iz1 - road.y + m]);
  }
  return out;
}
function subtract(len, intervals) {
  const segs = []; let cur = 0;
  for (const [a, b] of intervals.sort((p, q) => p[0] - q[0])) { if (a > cur) segs.push([cur, Math.min(a, len)]); cur = Math.max(cur, b); }
  if (cur < len) segs.push([cur, len]);
  return segs.filter(([a, b]) => b - a > 0.5);
}

// Junction corners: the block corner is rounded with this kerb radius; the footpath / verge follows the arc.
const CORNER_R = 6;
const kerbOffset = (q) => (q.kind === '25m' || q.kind === 'spine' ? 3 : 2);

export function buildRoads(ctx) {
  const { scene, world, T, colliders } = ctx;
  const roads = world.roads;
  const asphalt = [], concrete = [], pavers = [], footpaths = [], marks = [], kerbs = [], medians = [], verges = [], zebras = [], stops = [], ramps = [];
  const bumpItems = [], signItems = [], bollardItems = [];
  ctx.lightPoints = [];
  const lampItems = [];
  ctx.bumps = [];

  for (const r of roads) {
    const isSpine = r.kind === 'spine';
    const residential = r.kind === '10m' || r.kind === '15m' || r.kind === '20m';
    const surf = r.kind === '25m' ? concrete : residential ? pavers : asphalt;
    surf.push(patchGeo(r.x, r.y, r.w, r.h, residential ? 3 : 4, 0.06));
    const len = r.horizontal ? r.w : r.h; const wid = r.horizontal ? r.h : r.w;
    const jx = junctionIntervals(r, roads);
    const segs = subtract(len, jx);
    // Footpath / verge strips end exactly where the corner fillet (radius CORNER_R) begins: R minus the crossing road's kerb offset.
    const stripSegs = subtract(len, junctionIntervals(r, roads, (o) => CORNER_R - kerbOffset(o)));
    const along = (t, off, y, gw, gl) => (r.horizontal ? patchGeo(r.x + t, r.y + off - gw / 2, gl, gw, 1, y) : patchGeo(r.x + off - gw / 2, r.y + t, gw, gl, 1, y));
    // 25 m roads and the spine get a 3 m planted verge along both edges (trees stand on grass, not asphalt);
    // residential streets get a 2 m cobbled footpath with bollard lights instead.
    const verge = (r.kind === '25m' || isSpine) ? 3 : 0;
    const path = residential ? 2 : 0;
    // Verge (major roads) and footpath (residential) strips with their kerbs and bollards.
    for (const [va, vb] of stripSegs) {
      if (vb - va < 4) continue;
      if (verge) {
        verges.push(along(va, verge / 2, 0.075, verge, vb - va)); verges.push(along(va, wid - verge / 2, 0.075, verge, vb - va));
        for (const side of [verge, wid - verge]) kerbs.push(r.horizontal ? box(vb - va, 0.12, 0.25, 0xb9b7b0, { x: r.x + va + (vb - va) / 2, z: r.y + side }) : box(0.25, 0.12, vb - va, 0xb9b7b0, { x: r.x + side, z: r.y + va + (vb - va) / 2 }));
      }
      if (path) {
        footpaths.push(along(va, path / 2, 0.11, path, vb - va)); footpaths.push(along(va, wid - path / 2, 0.11, path, vb - va));
        for (const side of [path, wid - path]) kerbs.push(r.horizontal ? box(vb - va, 0.14, 0.22, 0xc9c5bb, { x: r.x + va + (vb - va) / 2, z: r.y + side }) : box(0.22, 0.14, vb - va, 0xc9c5bb, { x: r.x + side, z: r.y + va + (vb - va) / 2 }));
        for (let t = va + 4; t < vb - 2; t += 12) for (const side of [0.6, wid - 0.6]) { const x = r.horizontal ? r.x + t : r.x + side, z = r.horizontal ? r.y + side : r.y + t; bollardItems.push({ x, z }); ctx.lightPoints.push({ x, z, r: 4.5, kind: 'bollard' }); }
      }
    }
    // Edge lines and kerbs along non-junction segments.
    for (const [a, b] of segs) {
      if (!residential) for (const side of [verge + 0.5, wid - verge - 0.5]) marks.push(along(a, side, 0.09, 0.15, b - a));
      for (const side of [-0.15, wid + 0.15]) {
        const kg = r.horizontal ? box(b - a, 0.15, 0.3, 0xb9b7b0, { x: r.x + a + (b - a) / 2, z: r.y + side }) : box(0.3, 0.15, b - a, 0xb9b7b0, { x: r.x + side, z: r.y + a + (b - a) / 2 });
        kerbs.push(kg);
      }
      // Centre dashes on 15 m and wider (not the spine: it has a median).
      if (!isSpine && (r.kind === '15m' || r.kind === '20m' || r.kind === '25m')) {
        for (let t = a + 2; t < b - 3; t += 9) marks.push(along(t, wid / 2, 0.09, 0.15, 3));
      }
      // Lamp posts on every street: both sides every 40 m on 20 m+, alternating sides every 30 m on 10 / 15 m.
      {
        const wide = r.kind === '20m' || r.kind === '25m' || isSpine;
        const step = wide ? 40 : 30; const inset = verge ? 1.5 : path ? 1.0 : 1.2;
        let k = 0;
        for (let t = a + 12; t < b - 6; t += step, k++) {
          const sides = wide ? [inset, wid - inset] : [k % 2 ? inset : wid - inset];
          for (const side of sides) {
            const x = r.horizontal ? r.x + t : r.x + side, z = r.horizontal ? r.y + side : r.y + t;
            const rot = r.horizontal ? (side < wid / 2 ? Math.PI : 0) : (side < wid / 2 ? -Math.PI / 2 : Math.PI / 2);
            lampItems.push({ x, z, rot, small: !wide });
            colliders.add(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 'lamp');
          }
        }
      }
    }
    if (isSpine) {
      // Two 11 m carriageways with dashed lines, an 8 m planted median with kerbs, U-turn gaps every 200 m.
      const cx = r.x + r.w / 2;
      for (const [a, b] of segs) for (let t = a + 2; t < b - 3; t += 9) { marks.push(along(t, 7.0, 0.09, 0.15, 3)); marks.push(along(t, wid - 7.0, 0.09, 0.15, 3)); }
      for (const [ma, mb] of subtract(len, junctionIntervals(r, roads, () => 4))) {
        const z = r.y + Math.max(ma, 15), segLen = r.y + Math.min(mb, len - 15) - z;
        if (segLen < 20) continue;
        medians.push(patchGeo(cx - 4, z, 8, segLen, 4, 0.2));
        kerbs.push(box(0.3, 0.22, segLen, 0xb9b7b0, { x: cx - 4, z: z + segLen / 2 }));
        kerbs.push(box(0.3, 0.22, segLen, 0xb9b7b0, { x: cx + 4, z: z + segLen / 2 }));
        kerbs.push(box(8.3, 0.22, 0.3, 0xb9b7b0, { x: cx, z: z })); kerbs.push(box(8.3, 0.22, 0.3, 0xb9b7b0, { x: cx, z: z + segLen }));
        colliders.add(cx - 4.2, z, cx + 4.2, z + segLen, 'median');
        ctx.medianSegments = ctx.medianSegments || []; ctx.medianSegments.push({ x: cx, z0: z, z1: z + segLen });
      }
    }
  }
  // Junction corners. In local corner coordinates (u along x, v along z, both pointing INTO the junction) the
  // horizontal road's kerb line is v = oA and the vertical road's kerb line is u = oB. The block corner is rounded
  // with an arc of radius R tangent to both kerb lines, centred at (oB - R, oA - R) inside the block, so the strips
  // sweep round the corner and the carriageway gains the fillet. The piece is split on its diagonal: the half next
  // to each road carries that road's material (cobbles for a footpath, grass for a verge), so a footpath flows into
  // a verge with no gap. Strips end exactly where the arc begins.
  {
    const R = CORNER_R;
    const arcStart = (sx, sz) => (sz > 0 ? (sx > 0 ? -Math.PI / 2 : Math.PI) : (sx > 0 ? 0 : Math.PI / 2));
    const listFor = (q) => (q.kind === '25m' || q.kind === 'spine' ? verges : footpaths);
    const yFor = (q) => (q.kind === '25m' || q.kind === 'spine' ? 0.075 : 0.115);
    const piece = (pts, sx, sz, px, pz, y, tile) => {
      const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(sx * u, -sz * v)));
      const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.translate(px, y, pz);
      const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
      return g;
    };
    const seen = new Set();
    for (const r of roads) {
      if (!r.horizontal) continue;
      for (const o of roads) {
        if (o.horizontal) continue;
        const hz = r, vt = o;
        const ix0 = Math.max(hz.x, vt.x), ix1 = Math.min(hz.x + hz.w, vt.x + vt.w), iz0 = Math.max(hz.y, vt.y), iz1 = Math.min(hz.y + hz.h, vt.y + vt.h);
        if (ix1 - ix0 < -0.5 || iz1 - iz0 < -0.5) continue;
        if (ix1 - ix0 <= 0.5 && iz1 - iz0 <= 0.5) continue;
        const oA = kerbOffset(hz), oB = kerbOffset(vt);
        const vcx = vt.x + vt.w / 2, hcz = hz.y + hz.h / 2;
        for (const [px, pz] of [[ix0, iz0], [ix1, iz0], [ix0, iz1], [ix1, iz1]]) {
          const key = `${px.toFixed(1)},${pz.toFixed(1)}`; if (seen.has(key)) continue; seen.add(key);
          const sx = px < vcx ? 1 : -1, sz = pz < hcz ? 1 : -1;
          const cu = oB - R, cv = oA - R;
          const arc = (t) => [cu + R * Math.cos(t), cv + R * Math.sin(t)];
          const half = Math.PI / 4, N = 8;
          // Half next to the vertical road's strip (from its kerb line up to the diagonal).
          const pB = []; for (let i = 0; i <= N; i++) pB.push(arc((i / N) * half)); pB.push([0, 0], [0, cv]);
          // Half next to the horizontal road's strip (from the diagonal round to its kerb line).
          const pA = []; for (let i = 0; i <= N; i++) pA.push(arc(half + (i / N) * half)); pA.push([cu, 0], [0, 0]);
          listFor(vt).push(piece(pB, sx, sz, px, pz, yFor(vt), listFor(vt) === verges ? 4 : 1));
          listFor(hz).push(piece(pA, sx, sz, px, pz, yFor(hz), listFor(hz) === verges ? 4 : 1));
          const kerb = new THREE.TorusGeometry(R, 0.11, 5, 16, Math.PI / 2); kerb.rotateZ(arcStart(sx, sz)); kerb.rotateX(-Math.PI / 2); kerb.translate(px + sx * cu, 0.1, pz + sz * cv);
          const col = new Float32Array(kerb.attributes.position.count * 3).fill(0.79); kerb.setAttribute('color', new THREE.BufferAttribute(col, 3)); kerbs.push(kerb);
        }
      }
    }
  }
  // Zebra crossings within 60 m of school, temple and parks: 0.5 m stripes, stop lines, tactile ramps,
  // a crossing sign on each side, and a rounded striped speed bump 14 m before the crossing each way.
  const hot = [...world.parks, ...world.amenities.filter((a) => a.id === 'school' || a.id === 'temple')];
  for (const h of hot) {
    for (const r of roads) {
      if (r.kind === 'spine' || r.kind === '25m') continue;
      const dx = Math.max(r.x - (h.x + h.w), h.x - (r.x + r.w), 0), dz = Math.max(r.y - (h.y + h.h), h.y - (r.y + r.h), 0);
      if (dx > 60 || dz > 60) continue;
      const wid = r.horizontal ? r.h : r.w;
      const t = r.horizontal ? Math.min(Math.max(h.x + h.w / 2, r.x + 30), r.x + r.w - 30) - r.x : Math.min(Math.max(h.y + h.h / 2, r.y + 30), r.y + r.h - 30) - r.y;
      const at = (tt, off, y, gw, gl) => (r.horizontal ? patchGeo(r.x + tt - gl / 2, r.y + off - gw / 2, gl, gw, 1, y) : patchGeo(r.x + off - gw / 2, r.y + tt - gl / 2, gw, gl, 1, y));
      for (let s = 0.9; s < wid - 0.8; s += 1.0) zebras.push(at(t, s, 0.1, 0.5, 4));
      for (const side of [-1, 1]) stops.push(at(t + side * 4.4, wid / 2, 0.1, wid - 1.2, 0.4));
      for (const off of [-0.9, wid + 0.9]) ramps.push(r.horizontal ? box(2.4, 0.06, 1.4, 0x9c9a94, { x: r.x + t, z: r.y + off, y: 0.03 }) : box(1.4, 0.06, 2.4, 0x9c9a94, { x: r.x + off, z: r.y + t, y: 0.03 }));
      for (const off of [-1.6, wid + 1.6]) { const x = r.horizontal ? r.x + t + (off < 0 ? -3.2 : 3.2) : r.x + off, z = r.horizontal ? r.y + off : r.y + t + (off < 0 ? -3.2 : 3.2); signItems.push({ x, z, rot: r.horizontal ? 0 : Math.PI / 2 }); }
      for (const off of [-14, 14]) {
        const bx = r.horizontal ? r.x + t + off : r.x + wid / 2, bz = r.horizontal ? r.y + wid / 2 : r.y + t + off;
        bumpItems.push({ x: bx, z: bz, rot: r.horizontal ? 0 : Math.PI / 2, sx: 1, sy: 1, sz: wid - 1.2 });
        ctx.bumps.push(r.horizontal ? { x: bx - 0.5, z: r.y + 0.6, w: 1, h: wid - 1.2 } : { x: r.x + 0.6, z: bz - 0.5, w: wid - 1.2, h: 1 });
      }
    }
  }

  const add = (list, mat, name, shadow) => { const g = merge(list); if (!g) return; const m = new THREE.Mesh(g, mat); m.name = name; m.receiveShadow = true; m.castShadow = !!shadow; scene.add(m); };
  add(asphalt, stdMat(T, T.asphalt), 'roads-asphalt');
  add(concrete, stdMat(T, T.concrete, { color: 0xc9c7bf }), 'roads-concrete');
  add(pavers, stdMat(T, T.pavers), 'roads-pavers');
  add(footpaths, stdMat(T, T.cobble), 'footpaths');
  add(marks, new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.6, emissive: 0x222222 }), 'road-marks');
  add(zebras, new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.55, emissive: 0x2a2a2a }), 'zebras');
  add(stops, new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.55, emissive: 0x2a2a2a }), 'stop-lines');
  add(ramps, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 'kerb-ramps');
  add(kerbs, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 'kerbs');
  add(medians, stdMat(T, T.lawn), 'medians');
  add(verges, stdMat(T, T.lawn), 'verges');
  // Rounded speed bumps with yellow/black stripes: half cylinder along z, flat side down, striped canvas texture.
  { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#1a1a1a' : '#e5b92e'; g.fillRect(0, i * 8, 8, 8); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 4); tex.magFilter = THREE.NearestFilter;
    const bg = new THREE.CylinderGeometry(0.11, 0.11, 1, 10, 1, false, -Math.PI / 2, Math.PI); // half cylinder, cap open side down
    bg.rotateX(Math.PI / 2); bg.computeBoundingBox(); if (bg.boundingBox.max.y < 0.05) bg.rotateZ(Math.PI); bg.computeBoundingBox(); bg.translate(0, -bg.boundingBox.min.y + 0.06, 0);
    scene.add(instancedChunks(bg, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), bumpItems, { name: 'speed-bumps', chunk: 600 })); }
  // Pedestrian-crossing signs: pole + yellow diamond with a black border and a walking-figure glyph.
  { const dia = (sz, col, y, zz) => { const d = box(sz, sz, 0.05, col, { y, z: zz }); return d; };
    const d1 = dia(0.78, 0x111111, 2.55, 0), d2 = dia(0.64, 0xf2c12e, 2.55, 0.01); d1.translate(0, -2.55, 0); d1.rotateZ(Math.PI / 4); d1.translate(0, 2.55, 0); d2.translate(0, -2.55, 0); d2.rotateZ(Math.PI / 4); d2.translate(0, 2.55, 0);
    const sg = merge([cyl(0.05, 0.06, 2.6, 8, 0x6a6f76, { y: 1.3 }), d1, d2, box(0.1, 0.32, 0.07, 0x111111, { y: 2.6, z: 0.02 }), box(0.28, 0.05, 0.07, 0x111111, { y: 2.42, z: 0.02 }), box(0.14, 0.14, 0.07, 0x111111, { y: 2.82, z: 0.02 })]);
    scene.add(instancedChunks(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), signItems, { name: 'crossing-signs', chunk: 600, castShadow: true }));
    for (const it of signItems) colliders.add(it.x - 0.15, it.z - 0.15, it.x + 0.15, it.z + 0.15, 'sign'); }

  // Lamp posts: pole + arm (one instanced geometry) and an emissive head (second instanced mesh, toggled at night).
  const pole = merge([cyl(0.09, 0.14, 8, 8, 0x5a5f66), box(1.6, 0.12, 0.12, 0x5a5f66, { x: 0.8, y: 7.9 })]);
  const head = box(0.7, 0.2, 0.3, 0xfff2cc, { x: 1.4, y: 7.85 });
  const poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xffe6a8, emissiveIntensity: 0, roughness: 0.4 });
  const density = ctx.qualityPreset.lamps;
  const r = rng(99);
  const items = lampItems.filter(() => r() < density);
  const tall = items.filter((i) => !i.small), small = items.filter((i) => i.small).map((i) => ({ ...i, sx: 0.8, sy: 0.72, sz: 0.8 }));
  scene.add(instancedChunks(pole, poleMat, tall, { name: 'lamp-poles', castShadow: false }));
  scene.add(instancedChunks(head, headMat, tall, { name: 'lamp-heads' }));
  scene.add(instancedChunks(pole, poleMat, small, { name: 'lamp-poles-small', castShadow: false }));
  scene.add(instancedChunks(head, headMat, small, { name: 'lamp-heads-small' }));
  for (const it of items) { const f = it.small ? 1.4 * 0.8 : 1.4; ctx.lightPoints.push({ x: it.x + Math.cos(it.rot) * f, z: it.z - Math.sin(it.rot) * f, r: it.small ? 9 : 13, kind: 'lamp' }); }
  ctx.lampHeadMat = headMat;
  ctx.lampItems = items;
  // Bollard lights: short posts with a warm emissive cap (shares the lamp emissive so they switch on together).
  const bollard = merge([cyl(0.09, 0.11, 0.85, 8, 0x3a3f46, { y: 0.425 }), box(0.3, 0.06, 0.3, 0x3a3f46, { y: 0.9 })]);
  const bollardCap = cyl(0.1, 0.1, 0.12, 8, 0xfff2cc, { y: 0.82 });
  scene.add(instancedChunks(bollard, poleMat, bollardItems, { name: 'bollards', chunk: 400 }));
  scene.add(instancedChunks(bollardCap, headMat, bollardItems, { name: 'bollard-caps', chunk: 400 }));
}
