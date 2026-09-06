// Trees (3 species), farm hedges, crop shrubs with drive-over flattening.
import * as THREE from 'three';
import { box, cyl, ico, merge } from './geo.js';
import { instancedChunks } from './instancing.js';
import { rng } from '../util/math.js';

function broadleaf() {
  return merge([cyl(0.22, 0.34, 4.2, 7, 0x5b3f26, { y: 2.1 }), ico(3.2, 1, 0x3f7a2f, { y: 6.2, sy: 0.85, jitter: 0.25 }), ico(2.3, 1, 0x4c8c36, { y: 8.2, x: 0.8, sy: 0.9, jitter: 0.25 }), ico(2.0, 1, 0x38702c, { y: 7.4, x: -1.4, z: 0.8, jitter: 0.25 })]);
}
function palm() {
  const L = [cyl(0.22, 0.32, 9.5, 7, 0x8a6d4a, { y: 4.75 })];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const f = box(4.2, 0.12, 0.9, 0x6aa53a); f.translate(2.0, 0, 0); f.rotateZ(-0.35); f.rotateY(a); f.translate(0, 9.6, 0); L.push(f); }
  L.push(ico(0.7, 0, 0x5d8a2e, { y: 9.6 }));
  return merge(L);
}
function flowering() {
  return merge([cyl(0.18, 0.28, 3.2, 7, 0x6b4a2e, { y: 1.6 }), ico(2.6, 1, 0xc97ba8, { y: 4.9, sy: 0.8, jitter: 0.3 }), ico(1.8, 1, 0xd88fb7, { y: 6.1, x: 0.7, z: -0.5, jitter: 0.3 }), ico(1.5, 1, 0x4d8a3a, { y: 4.0, x: -1.2, z: 0.6, jitter: 0.2 })]);
}

export function buildVegetation(ctx) {
  const { scene, world, colliders } = ctx;
  const L = world.L;
  const density = ctx.qualityPreset.treeDensity;
  const r = rng(4242);
  const trees = [[], [], []];
  const addTree = (x, z, species, solid = true, scale) => {
    if (r() > density) return;
    const s = scale || 0.85 + r() * 0.4;
    trees[species].push({ x, z, rot: r() * Math.PI * 2, sx: s, sy: s, sz: s });
    if (solid) colliders.add(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 'tree');
  };
  // Street trees inside the 25 m and spine road rectangles (1.4 m in from the kerb), every 12 m, skipping junctions.
  for (const rd of world.roads) {
    if (!(rd.kind === '25m' || rd.kind === 'spine')) continue;
    const len = rd.horizontal ? rd.w : rd.h, wid = rd.horizontal ? rd.h : rd.w;
    for (let t = 8; t < len - 8; t += 12) {
      for (const side of [1.6, wid - 1.6]) {
        const x = rd.horizontal ? rd.x + t : rd.x + side, z = rd.horizontal ? rd.y + side : rd.y + t;
        if (world.roads.some((o) => o !== rd && x > o.x - 4 && x < o.x + o.w + 4 && z > o.y - 4 && z < o.y + o.h + 4)) continue;
        addTree(x, z, rd.kind === 'spine' ? 1 : 0);
      }
    }
  }
  // Spine median trees.
  for (const seg of ctx.medianSegments || []) for (let z = seg.z0 + 8; z < seg.z1 - 6; z += 14) addTree(seg.x, z, z % 28 < 14 ? 2 : 0, false, 0.8);
  // Parks: dense, avoiding paths.
  for (const pk of L.parks) for (let i = 0; i < 140; i++) { const x = pk.x + 4 + r() * (pk.w - 8), z = pk.y + 4 + r() * (pk.h - 8); if (Math.abs(z - (pk.y + pk.h / 2)) < 4) continue; addTree(x, z, i % 3); }
  // Lake ring outside the track, temple lawns.
  { const lk = L.lake.bbox; const o = 22; for (let x = lk.x - o; x <= lk.x + lk.w + o; x += 15) { addTree(x, lk.y - o, 1); addTree(x, lk.y + lk.h + o, 1); } for (let z = lk.y - o + 15; z < lk.y + lk.h + o; z += 15) { addTree(lk.x - o, z, 1); addTree(lk.x + lk.w + o, z, 1); } }
  { const t = L.amenities.find((a) => a.id === 'temple'); for (let i = 0; i < 24; i++) { const x = t.x + 8 + r() * (t.w - 16), z = t.y + 8 + r() * (t.h - 16); if (Math.abs(x - t.x - t.w / 2) < 36 && Math.abs(z - t.y - t.h / 2) < 36) continue; addTree(x, z, 2); } }
  // Farm plots: 6 to 10 along the hedges, away from the pad.
  for (const f of L.farms) {
    const n = 6 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const edge = Math.floor(r() * 4); let x, z;
      if (edge === 0) { x = f.x + 4 + r() * (f.w - 8); z = f.y + 3.5; } else if (edge === 1) { x = f.x + 4 + r() * (f.w - 8); z = f.y + f.h - 3.5; } else if (edge === 2) { x = f.x + 3.5; z = f.y + 4 + r() * (f.h - 8); } else { x = f.x + f.w - 3.5; z = f.y + 4 + r() * (f.h - 8); }
      if (f.pad && x > f.pad.x - 2 && x < f.pad.x + f.pad.w + 2 && z > f.pad.y - 2 && z < f.pad.y + f.pad.h + 2) continue;
      addTree(x, z, i % 2 ? 0 : 2, true, 0.7 + r() * 0.3);
    }
  }
  // Villa and town house gardens: one tree each behind the house.
  for (const p of world.plots) { if (p.type === 'villa') { const x = p.x + 3 + r() * (p.w - 6), z = p.facing === 'S' ? p.y + 2.5 : p.y + p.h - 2.5; addTree(x, z, 2, false, 0.6 + r() * 0.3); } }
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const geos = [broadleaf(), palm(), flowering()];
  geos.forEach((g, i) => scene.add(instancedChunks(g, treeMat, trees[i], { name: `trees-${i}`, castShadow: true })));
  ctx.treeCount = trees.reduce((a, l) => a + l.length, 0);

  // Hedges: four edges per farm, 1.2 m high, gap on the pad side facing the road.
  const hedgeGeo = box(1, 1.2, 0.8, 0x2f6b2a); hedgeGeo.translate(0, 0, 0);
  const hedges = [];
  ctx.hedgeGaps = new Map();
  for (const f of L.farms) {
    const gapX0 = f.pad ? f.pad.x + f.pad.w / 2 - 5 : f.x + f.w / 2 - 5, gapX1 = gapX0 + 10;
    const gapSide = f.facing === 'S' ? 'S' : 'N';
    ctx.hedgeGaps.set(f.id, { side: gapSide, x0: gapX0, x1: gapX1 });
    const seg = (x0, z0, x1, z1) => hedges.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, rot: Math.atan2(-(z1 - z0), x1 - x0), sx: Math.hypot(x1 - x0, z1 - z0), sy: 0.9 + r() * 0.3 });
    const inset = 0.6;
    if (gapSide === 'N') { seg(f.x + inset, f.y + inset, gapX0, f.y + inset); seg(gapX1, f.y + inset, f.x + f.w - inset, f.y + inset); } else seg(f.x + inset, f.y + inset, f.x + f.w - inset, f.y + inset);
    if (gapSide === 'S') { seg(f.x + inset, f.y + f.h - inset, gapX0, f.y + f.h - inset); seg(gapX1, f.y + f.h - inset, f.x + f.w - inset, f.y + f.h - inset); } else seg(f.x + inset, f.y + f.h - inset, f.x + f.w - inset, f.y + f.h - inset);
    seg(f.x + inset, f.y + inset, f.x + inset, f.y + f.h - inset); seg(f.x + f.w - inset, f.y + inset, f.x + f.w - inset, f.y + f.h - inset);
  }
  scene.add(instancedChunks(hedgeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), hedges, { name: 'hedges', chunk: 300 }));

  // Crop shrubs: rows 3 m apart, flattened when driven over, recovering over 10 s.
  const shrubGeo = ico(0.55, 0, 0x4f9a3b, { y: 0.45, sy: 0.9, jitter: 0.3 });
  const shrubs = [];
  const cropCell = new Map(); const CELL = 12;
  for (const f of L.farms) {
    const c = f.crop; if (!c) continue;
    for (let z = c.y + 1.5; z < c.y + c.h - 1; z += 3) for (let x = c.x + 1.5; x < c.x + c.w - 1; x += 2.6) {
      if (r() > density + 0.15) continue;
      const s = 0.8 + r() * 0.4;
      shrubs.push({ x: x + (r() - 0.5) * 0.6, z: z + (r() - 0.5) * 0.6, rot: r() * 6.28, sx: s, sy: s, sz: s });
    }
  }
  const shrubRoot = instancedChunks(shrubGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), shrubs, {
    name: 'crops', chunk: 300,
    onInstance: (mesh, i, it) => { const k = `${Math.floor(it.x / CELL)},${Math.floor(it.z / CELL)}`; (cropCell.get(k) || cropCell.set(k, []).get(k)).push({ mesh, i, x: it.x, z: it.z, s: it.sx, t: -1 }); },
  });
  scene.add(shrubRoot);
  ctx.shrubCount = shrubs.length;
  const flattened = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const setScaleY = (s, sy) => { s.mesh.getMatrixAt(s.i, m); m.decompose(p, q, sc); sc.y = s.s * sy; m.compose(p, q, sc); s.mesh.setMatrixAt(s.i, m); s.mesh.instanceMatrix.needsUpdate = true; };
  ctx.crops = {
    flattenAt(x, z, now) {
      const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL); let hit = false;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = cropCell.get(`${gx + i},${gz + j}`); if (!l) continue; for (const s of l) { if (Math.abs(s.x - x) < 1.6 && Math.abs(s.z - z) < 2.4) { if (s.t < 0) flattened.push(s); s.t = now; setScaleY(s, 0.18); hit = true; } } }
      return hit;
    },
    update(now) {
      for (let i = flattened.length - 1; i >= 0; i--) { const s = flattened[i]; const age = now - s.t; if (age > 10) { setScaleY(s, 1); s.t = -1; flattened.splice(i, 1); } else if (age > 2) setScaleY(s, 0.18 + 0.82 * ((age - 2) / 8)); }
    },
  };
}
