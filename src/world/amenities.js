import * as THREE from 'three';
import { patchGeo, box, cyl, merge, stdMat } from './geo.js';

function ellipseBand(cx, cz, rx0, rz0, rx1, rz1, y0, y1, color, seg = 64) {
  const pos = [], col = [], idx = []; const c = new THREE.Color(color);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pos.push(cx + Math.cos(a) * rx0, y0, cz + Math.sin(a) * rz0); pos.push(cx + Math.cos(a) * rx1, y1, cz + Math.sin(a) * rz1);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const uv = new Float32Array((seg + 1) * 4); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}

export function buildAmenities(ctx) {
  const { scene, world, T, colliders } = ctx;
  const A = Object.fromEntries(world.amenities.map((a) => [a.id, a]));
  const plaster = [], stone = [], metal = [], dark = [], lawnPaths = [], track = [];
  const glass = [];
  const solid = (x0, z0, x1, z1, tag, ref) => colliders.add(x0, z0, x1, z1, tag || 'amenity', ref);
  const plotOf = (id) => world.byId.get(id);

  // Temple: plinth + stepped tower + four lawn quadrants with cross paths.
  { const a = A.temple; const cx = a.x + a.w / 2, cz = a.y + a.h / 2;
    lawnPaths.push(patchGeo(cx - 4, a.y, 8, a.h, 3, 0.05)); lawnPaths.push(patchGeo(a.x, cz - 4, a.w, 8, 3, 0.05));
    stone.push(box(64, 1.6, 64, 0xd9c8a5, { x: cx, z: cz, y: 0.8 })); stone.push(box(56, 1.4, 56, 0xe3d3b0, { x: cx, z: cz, y: 2.3 }));
    const tiers = [[30, 8], [24, 7], [18, 6.5], [13, 6], [9, 5.5], [5.5, 5]]; let y = 3;
    for (const [w, h] of tiers) { stone.push(box(w, h, w, 0xd6b98a, { x: cx, z: cz, y: y + h / 2 })); stone.push(box(w + 1.2, 0.5, w + 1.2, 0xb99a6a, { x: cx, z: cz, y: y + h - 0.25 })); y += h; }
    stone.push(cyl(0.6, 2.2, 4, 12, 0xc9a227, { x: cx, z: cz, y: y + 2 })); stone.push(cyl(0, 0.6, 3, 12, 0xc9a227, { x: cx, z: cz, y: y + 5.5 }));
    for (const s of [-1, 1]) { stone.push(box(30, 5, 12, 0xe3d3b0, { x: cx, z: cz + s * 24, y: 2.5 + 2.5 })); }
    for (let i = 0; i < 8; i++) stone.push(cyl(0.5, 0.5, 5, 8, 0xe3d3b0, { x: cx - 28 + i * 8, z: cz + 33, y: 3 + 2.5 }));
    for (let i = 0; i < 8; i++) stone.push(cyl(0.5, 0.5, 5, 8, 0xe3d3b0, { x: cx - 28 + i * 8, z: cz - 33, y: 3 + 2.5 }));
    solid(cx - 32, cz - 32, cx + 32, cz + 32, 'amenity', plotOf('temple'));
  }
  // School: U-shaped two-storey block around a courtyard, playfield east, boundary wall.
  { const a = A.school; const p = plotOf('school');
    const bx = a.x + 12, bz = a.y + 12;
    const blocks = [[bx, bz, 130, 14], [bx, bz, 14, 150], [bx, bz + 136, 130, 14]];
    for (const [x, z, w, d] of blocks) {
      plaster.push(box(w, 8, d, 0xf4ead8, { x: x + w / 2, z: z + d / 2, y: 4.2 })); plaster.push(box(w + 0.6, 0.35, d + 0.6, 0xe0d6c4, { x: x + w / 2, z: z + d / 2, y: 4.4 }));
      plaster.push(box(w + 0.6, 0.4, d + 0.6, 0xe0d6c4, { x: x + w / 2, z: z + d / 2, y: 8.4 }));
      const along = w > d;
      for (let t = 4; t < (along ? w : d) - 3; t += 5) for (const h of [2.2, 6.2]) {
        if (along) { glass.push(box(2.6, 1.8, 0.1, 0x223447, { x: x + t, z: z + d + 0.05, y: h })); glass.push(box(2.6, 1.8, 0.1, 0x223447, { x: x + t, z: z - 0.05, y: h })); }
        else { glass.push(box(0.1, 1.8, 2.6, 0x223447, { x: x + w + 0.05, z: z + t, y: h })); glass.push(box(0.1, 1.8, 2.6, 0x223447, { x: x - 0.05, z: z + t, y: h })); }
      }
      solid(x, z, x + w, z + d, 'amenity', p);
    }
    for (let x = bx + 20; x < bx + 130; x += 6) plaster.push(cyl(0.3, 0.3, 4, 8, 0xf4ead8, { x, z: bz + 16, y: 2 }));
    plaster.push(box(114, 0.3, 4, 0xe0d6c4, { x: bx + 75, z: bz + 16, y: 4.1 }));
    plaster.push(box(a.w, 1.2, 0.3, 0xe0d6c4, { x: a.x + a.w / 2, z: a.y, y: 0.6 })); plaster.push(box(a.w, 1.2, 0.3, 0xe0d6c4, { x: a.x + a.w / 2, z: a.y + a.h, y: 0.6 }));
    plaster.push(box(0.3, 1.2, a.h, 0xe0d6c4, { x: a.x + a.w, z: a.y + a.h / 2, y: 0.6 }));
    // Playfield lines
    const fx = a.x + a.w * 0.6, fz = a.y + 30; track.push(patchGeo(fx, fz, 90, 0.4, 1, 0.05)); track.push(patchGeo(fx, fz + 120, 90, 0.4, 1, 0.05)); track.push(patchGeo(fx, fz, 0.4, 120, 1, 0.05)); track.push(patchGeo(fx + 90, fz, 0.4, 120, 1, 0.05));
    // Flag pole
    metal.push(cyl(0.1, 0.12, 14, 8, 0xdddddd, { x: bx + 75, z: bz + 40, y: 7 }));
  }
  // Stadium: elliptical bowl of three stepped stand bands, a track, four floodlight masts.
  { const a = A.stadium; const p = plotOf('stadium'); const cx = a.x + a.w / 2, cz = a.y + a.h / 2;
    const rx = a.w / 2 - 6, rz = a.h / 2 - 6;
    track.push(patchGeo(a.x + 6, a.y + 6, a.w - 12, a.h - 12, 4, 0.04));
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1, 48), stdMat(T, T.lawn)); inner.scale.set(rx - 12, rz - 12, 1); inner.rotation.x = -Math.PI / 2; inner.position.set(cx, 0.06, cz); inner.receiveShadow = true; scene.add(inner);
    const bands = [[0, 1.2, 0xd8d3c8], [1.2, 3.4, 0x9aa7b8], [3.4, 6.4, 0x8b96a6], [6.4, 9.8, 0x7c8798]];
    let r0 = 0; const step = 9;
    for (const [y0, y1, col] of bands) { const m = new THREE.Mesh(ellipseBand(cx, cz, rx + r0, rz + r0, rx + r0 + step, rz + r0 + step, y0, y1, col), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); m.castShadow = true; m.receiveShadow = true; scene.add(m); r0 += step; }
    const back = new THREE.Mesh(ellipseBand(cx, cz, rx + r0, rz + r0, rx + r0 + 0.5, rz + r0 + 0.5, 0, 10.5, 0x6d7889), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); scene.add(back);
    for (let i = 0; i < 16; i++) { const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2; const xs = [], zs = []; for (const ang of [a0, (a0 + a1) / 2, a1]) for (const rr of [0, r0 + 0.5]) { xs.push(cx + Math.cos(ang) * (rx + rr)); zs.push(cz + Math.sin(ang) * (rz + rr)); } solid(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), 'amenity', p); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = cx + sx * (rx + 44), z = cz + sz * (rz + 30); metal.push(cyl(0.5, 0.9, 42, 8, 0xbfc4cc, { x, z, y: 21 })); dark.push(box(6, 3, 1, 0xfff3d0, { x, z, y: 42 })); solid(x - 1, z - 1, x + 1, z + 1, 'amenity', p); }
  }
  // Agro plant: sheds, silos, fence.
  { const a = A.agro; const p = plotOf('agro');
    for (let i = 0; i < 5; i++) { const x = a.x + 60 + i * 170, z = a.y + 15, w = 110, d = 34; metal.push(box(w, 11, d, 0xd9dde3, { x: x + w / 2, z: z + d / 2, y: 5.5 })); metal.push(box(w + 1, 1.2, d + 1, 0x8e969f, { x: x + w / 2, z: z + d / 2, y: 11.3 })); dark.push(box(8, 7, 0.3, 0x3a4048, { x: x + w / 2, z: z + d + 0.1, y: 3.5 })); solid(x, z, x + w, z + d, 'amenity', p); }
    for (let i = 0; i < 8; i++) { const x = a.x + 90 + i * 24, z = a.y + 75; metal.push(cyl(5, 5, 20, 20, 0xcfd6dd, { x, z, y: 10 })); metal.push(cyl(0.5, 5.2, 3.5, 20, 0xaab2bb, { x, z, y: 21.7 })); solid(x - 5.2, z - 5.2, x + 5.2, z + 5.2, 'amenity', p); }
    metal.push(box(a.w, 1.8, 0.15, 0x8e969f, { x: a.x + a.w / 2, z: a.y + 1, y: 0.9 })); metal.push(box(a.w, 1.8, 0.15, 0x8e969f, { x: a.x + a.w / 2, z: a.y + a.h - 1, y: 0.9 }));
    metal.push(cyl(0.3, 0.4, 30, 8, 0xd8dce2, { x: a.x + 40, z: a.y + 50, y: 15 }));
  }
  // Parking: bay markings.
  { const a = A.parking; for (let z = a.y + 10; z < a.y + a.h - 10; z += 6) { track.push(patchGeo(a.x + 8, z, 40, 0.3, 1, 0.05)); track.push(patchGeo(a.x + a.w - 48, z, 40, 0.3, 1, 0.05)); } track.push(patchGeo(a.x + 8, a.y + 10, 0.3, a.h - 20, 1, 0.05)); track.push(patchGeo(a.x + a.w - 8, a.y + 10, 0.3, a.h - 20, 1, 0.05)); }
  // Fire station: red-and-white with three roller doors and a drill tower.
  { const a = A.fire; const f = A['fire-station']; const p = plotOf('fire-station'); const x = f.x + 20, z = f.y + 12, w = 60, d = 30;
    plaster.push(box(w, 8, d, 0xf1eee8, { x: x + w / 2, z: z + d / 2, y: 4 })); plaster.push(box(w + 0.4, 2.2, d + 0.4, 0xc0392b, { x: x + w / 2, z: z + d / 2, y: 7 }));
    for (let i = 0; i < 3; i++) dark.push(box(9, 5.5, 0.4, 0x4b5058, { x: x + 10 + i * 18, z: z + d + 0.1, y: 2.75 }));
    plaster.push(box(8, 20, 8, 0xc0392b, { x: x + w + 8, z: z + 8, y: 10 }));
    solid(x, z, x + w, z + d, 'amenity', p); solid(x + w + 4, z + 4, x + w + 12, z + 12, 'amenity', p);
  }
  // Water treatment: four round tanks, control building and a water tower landmark.
  { const a = A.wtp; const p = plotOf('wtp');
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const x = a.x + 50 + i * 70, z = a.y + 55 + j * 70; metal.push(cyl(22, 22, 5, 32, 0xb8c2cc, { x, z, y: 2.5 })); const wg = new THREE.CircleGeometry(21, 32); wg.rotateX(-Math.PI / 2); wg.translate(x, 5.05, z); metal.push(wg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(wg.attributes.position.count * 3).fill(0.3), 3)) && wg); solid(x - 22, z - 22, x + 22, z + 22, 'amenity', p); }
    plaster.push(box(30, 5, 16, 0xf1eee8, { x: a.x + 30, z: a.y + a.h - 20, y: 2.5 })); solid(a.x + 15, a.y + a.h - 28, a.x + 45, a.y + a.h - 12, 'amenity', p);
    const tx = a.x + a.w - 25, tz = a.y + 25; metal.push(cyl(1.2, 1.6, 34, 10, 0xcfd6dd, { x: tx, z: tz, y: 17 })); metal.push(cyl(9, 7, 10, 20, 0xe4e8ec, { x: tx, z: tz, y: 39 })); metal.push(cyl(0, 9, 3, 20, 0xc9a227, { x: tx, z: tz, y: 45.5 })); solid(tx - 2, tz - 2, tx + 2, tz + 2, 'amenity', p);
  }
  // Parks: pavilions and paths.
  for (const pk of world.parks) {
    const p = plotOf(pk.id);
    lawnPaths.push(patchGeo(pk.x, pk.y + pk.h / 2 - 2, pk.w, 4, 3, 0.05));
    for (let i = 0; i < 4; i++) {
      const x = pk.x + pk.w * (0.2 + i * 0.2), z = pk.y + pk.h / 2;
      lawnPaths.push(patchGeo(x - 2, pk.y, 4, pk.h, 3, 0.05));
      const px = x, pz = z + (i % 2 ? 28 : -28);
      for (const sx of [-3, 3]) for (const sz of [-3, 3]) stone.push(cyl(0.3, 0.3, 4, 8, 0xf2ede4, { x: px + sx, z: pz + sz, y: 2 }));
      stone.push(box(8.5, 0.4, 8.5, 0xc9a227, { x: px, z: pz, y: 4.2 })); stone.push(box(9, 0.15, 9, 0xe8e2d6, { x: px, z: pz, y: 0.08 }));
      solid(px - 3.5, pz - 3.5, px + 3.5, pz + 3.5, 'amenity', p);
    }
  }
  // Joggers' track: rectangular ring 10 m outside the lake water, 6 m wide.
  { const lk = world.lake.bbox; const o = 12, w = 6;
    track.push(patchGeo(lk.x - o - w, lk.y - o - w, lk.w + 2 * (o + w), w, 3, 0.05)); track.push(patchGeo(lk.x - o - w, lk.y + lk.h + o, lk.w + 2 * (o + w), w, 3, 0.05));
    track.push(patchGeo(lk.x - o - w, lk.y - o, w, lk.h + 2 * o, 3, 0.05)); track.push(patchGeo(lk.x + lk.w + o, lk.y - o, w, lk.h + 2 * o, 3, 0.05));
  }

  const add = (list, mat, name) => { const g = merge(list); if (!g) return; const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; scene.add(m); };
  add(plaster, stdMat(T, T.plaster, { vertexColors: true }), 'amenity-plaster');
  add(stone, stdMat(T, T.stone, { vertexColors: true }), 'amenity-stone');
  add(metal, stdMat(T, T.metal, { vertexColors: true, metalness: 0.3, roughness: 0.6 }), 'amenity-metal');
  add(dark, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'amenity-dark');
  add(lawnPaths, stdMat(T, T.paving), 'amenity-paths');
  add(track, stdMat(T, T.track), 'tracks');
  const gm = new THREE.Mesh(merge(glass), ctx.glassMat); gm.name = 'amenity-glass'; scene.add(gm);
}
