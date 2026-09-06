// Trees from the Kenney nature kit (baked, instanced, LOD to procedural beyond ctx.lodDistance),
// farm hedges, and crop shrubs with drive-over flattening.
import * as THREE from 'three';
import { box, cyl, ico, merge } from './geo.js';
import { instancedChunks } from './instancing.js';
import { rng } from '../util/math.js';
import { junctionIntervals } from './roads.js';

// Procedural low-detail stand-ins used beyond the LOD distance (and as fallback if a model failed).
function loBroadleaf() { return merge([cyl(0.22, 0.34, 4.2, 5, 0x5b3f26, { y: 2.1 }), ico(3.0, 0, 0x3f7a2f, { y: 6.4, sy: 0.9, jitter: 0.2 })]); }
function loPalm() { const L = [cyl(0.22, 0.32, 9.5, 5, 0x8a6d4a, { y: 4.75 })]; for (let i = 0; i < 5; i++) { const f = box(4.2, 0.12, 0.9, 0x5aa544); f.translate(2.0, 0, 0); f.rotateZ(-0.35); f.rotateY((i / 5) * Math.PI * 2); f.translate(0, 9.6, 0); L.push(f); } return merge(L); }

const SPECIES = [
  { key: 'tree_default', height: 9, lo: 'broad', tint: [0.9, 1.1] },
  { key: 'tree_oak', height: 11, lo: 'broad', tint: [0.85, 1.05] },
  { key: 'tree_detailed', height: 12, lo: 'broad', tint: [0.9, 1.1] },
  { key: 'tree_fat', height: 9, lo: 'broad', tint: [0.95, 1.15] },
  { key: 'tree_tall', height: 13, lo: 'broad', tint: [0.85, 1.0] },
  { key: 'tree_palmDetailedTall', height: 12, lo: 'palm', tint: [0.95, 1.1] },
  { key: 'tree_palmBend', height: 9, lo: 'palm', tint: [0.95, 1.1] },
];
const BROAD = [0, 1, 2, 3, 4], PALMS = [5, 6];

export function buildVegetation(ctx) {
  const { scene, world, colliders, models } = ctx;
  const L = world.L;
  const density = ctx.qualityPreset.treeDensity;
  const r = rng(4242);
  const items = SPECIES.map(() => []);
  const addTree = (x, z, species, solid = true, scale) => {
    if (r() > density) return;
    const sp = SPECIES[species];
    const s = scale || 0.85 + r() * 0.35;
    const t = sp.tint[0] + r() * (sp.tint[1] - sp.tint[0]);
    items[species].push({ x, z, rot: r() * Math.PI * 2, sx: s, sy: s * (0.95 + r() * 0.1), sz: s, color: new THREE.Color(t, t, t) });
    if (solid) colliders.add(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 'tree');
  };
  const pick = (set) => set[Math.floor(r() * set.length)];

  // Street trees in the 3 m grass verge of 25 m roads and the spine, every 15 m, skipping junctions.
  for (const rd of world.roads) {
    if (!(rd.kind === '25m' || rd.kind === 'spine')) continue;
    const len = rd.horizontal ? rd.w : rd.h, wid = rd.horizontal ? rd.h : rd.w;
    const jx = junctionIntervals(rd, world.roads);
    for (let t = 10; t < len - 8; t += 15) {
      if (jx.some(([a, b]) => t > a - 6 && t < b + 6)) continue;
      for (const side of [1.5, wid - 1.5]) {
        const x = rd.horizontal ? rd.x + t : rd.x + side, z = rd.horizontal ? rd.y + side : rd.y + t;
        addTree(x, z, rd.kind === 'spine' ? pick(PALMS) : pick(BROAD), true, 0.7 + r() * 0.2);
      }
    }
  }
  // Spine median palms.
  for (const seg of ctx.medianSegments || []) for (let z = seg.z0 + 8; z < seg.z1 - 6; z += 14) addTree(seg.x, z, pick(PALMS), false, 0.75 + r() * 0.15);
  // Parks: dense, avoiding paths.
  for (const pk of L.parks) for (let i = 0; i < 150; i++) { const x = pk.x + 4 + r() * (pk.w - 8), z = pk.y + 4 + r() * (pk.h - 8); if (Math.abs(z - (pk.y + pk.h / 2)) < 4) continue; let onPath = false; for (let k = 0; k < 4; k++) if (Math.abs(x - (pk.x + pk.w * (0.2 + k * 0.2))) < 3) onPath = true; if (onPath) continue; addTree(x, z, pick(BROAD)); }
  // Lake ring outside the track, temple lawns.
  { const lk = L.lake.bbox; const o = 24; for (let x = lk.x - o; x <= lk.x + lk.w + o; x += 16) { addTree(x, lk.y - o, pick(PALMS)); addTree(x, lk.y + lk.h + o, pick(PALMS)); } for (let z = lk.y - o + 16; z < lk.y + lk.h + o; z += 16) { addTree(lk.x - o, z, pick(PALMS)); addTree(lk.x + lk.w + o, z, pick(PALMS)); } }
  { const t = L.amenities.find((a) => a.id === 'temple'); for (let i = 0; i < 28; i++) { const x = t.x + 8 + r() * (t.w - 16), z = t.y + 8 + r() * (t.h - 16); if (Math.abs(x - t.x - t.w / 2) < 48 && Math.abs(z - t.y - t.h / 2) < 48) continue; if (Math.abs(x - t.x - t.w / 2) < 6 || Math.abs(z - t.y - t.h / 2) < 6) continue; addTree(x, z, i % 3 ? pick(BROAD) : pick(PALMS)); } }
  // Stadium concourse ring and school boundary trees.
  { const st = L.amenities.find((q) => q.id === 'stadium'); const cx = st.x + st.w / 2, cz = st.y + st.h / 2; for (let i = 0; i < 24; i++) { const ang = (i / 24) * Math.PI * 2; if (Math.abs(Math.sin(ang)) < 0.12 || Math.abs(Math.cos(ang)) < 0.12) continue; addTree(cx + Math.cos(ang) * 95, cz + Math.sin(ang) * 100, pick(PALMS), true, 0.8); }
    const sc = L.amenities.find((q) => q.id === 'school'); for (let x = sc.x + 8; x < sc.x + sc.w - 4; x += 14) { addTree(x, sc.y + 4, pick(BROAD), true, 0.75); addTree(x, sc.y + sc.h - 4, pick(BROAD), true, 0.75); } for (let z = sc.y + 16; z < sc.y + sc.h - 8; z += 14) { addTree(sc.x + sc.w - 4, z, pick(BROAD), true, 0.75); if (Math.abs(z - (sc.y + sc.h / 2)) > 10) addTree(sc.x + 4, z, pick(BROAD), true, 0.7); } }
  // Farm plots: 6 to 10 along the hedges, away from the pad.
  for (const f of L.farms) {
    const n = 6 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const edge = Math.floor(r() * 4); let x, z;
      if (edge === 0) { x = f.x + 4 + r() * (f.w - 8); z = f.y + 3.5; } else if (edge === 1) { x = f.x + 4 + r() * (f.w - 8); z = f.y + f.h - 3.5; } else if (edge === 2) { x = f.x + 3.5; z = f.y + 4 + r() * (f.h - 8); } else { x = f.x + f.w - 3.5; z = f.y + 4 + r() * (f.h - 8); }
      if (f.pad && x > f.pad.x - 2 && x < f.pad.x + f.pad.w + 2 && z > f.pad.y - 2 && z < f.pad.y + f.pad.h + 2) continue;
      addTree(x, z, pick(BROAD), true, 0.7 + r() * 0.3);
    }
  }
  // Footpath trees: one small flowering tree at the front-left corner of every villa plot (never in front of a gate).
  for (const p of world.plots) { if (p.type !== 'villa') continue; const z = p.facing === 'S' ? p.y + p.h + 1.0 : p.y - 1.0; addTree(p.x + 1.5, z, 3, true, 0.5 + r() * 0.15); }
  // Villa gardens: one tree behind each house.
  for (const p of world.plots) { if (p.type === 'villa') { const x = p.x + 3 + r() * (p.w - 6), z = p.facing === 'S' ? p.y + 2.5 : p.y + p.h - 2.5; addTree(x, z, pick(BROAD), false, 0.55 + r() * 0.25); } }

  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const loGeos = { broad: loBroadleaf(), palm: loPalm() };
  ctx.lod = ctx.lod || [];
  SPECIES.forEach((sp, i) => {
    if (!items[i].length) return;
    const m = models && models[sp.key];
    const lo = instancedChunks(loGeos[sp.lo], treeMat, items[i].map((it) => ({ ...it, sy: it.sy * (sp.height / (sp.lo === 'palm' ? 10 : 8.5)) })), { name: `trees-lo-${sp.key}`, chunk: 300 });
    scene.add(lo);
    if (m) {
      const hi = instancedChunks(m.geo, treeMat, items[i], { name: `trees-${sp.key}`, chunk: 300, castShadow: true });
      scene.add(hi);
      ctx.lod.push({ hi, lo });
    }
  });
  ctx.treeCount = items.reduce((a, l) => a + l.length, 0);

  // Hedges: four edges per farm, 1.2 m high, gap on the pad side facing the road.
  const hedgeGeo = box(1, 1.2, 0.8, 0x2f6b2a);
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
  const shrubGeo = (models && models.plant_bushDetailed) ? models.plant_bushDetailed.geo : ico(0.55, 0, 0x4f9a3b, { y: 0.45, sy: 0.9, jitter: 0.3 });
  const shrubs = [];
  const cropCell = new Map(); const CELL = 12;
  for (const f of L.farms) {
    const c = f.crop; if (!c) continue;
    for (let z = c.y + 1.5; z < c.y + c.h - 1; z += 3) for (let x = c.x + 1.5; x < c.x + c.w - 1; x += 2.6) {
      if (r() > density + 0.15) continue;
      const s = 0.8 + r() * 0.4; const t = 0.9 + r() * 0.2;
      shrubs.push({ x: x + (r() - 0.5) * 0.6, z: z + (r() - 0.5) * 0.6, rot: r() * 6.28, sx: s, sy: s, sz: s, color: new THREE.Color(t, t, t) });
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

// Per-frame LOD: chunks nearer than lodDistance show the model, farther ones the stand-in.
export function updateLOD(ctx, camPos) {
  const d = ctx.lodDistance; const d2 = d * d;
  for (const { hi, lo } of ctx.lod || []) {
    const hc = hi.children, lc = lo.children;
    for (let i = 0; i < hc.length; i++) {
      const bs = hc[i].geometry.boundingSphere; // chunks are at identity, but the shared geometry sphere is per model; use instance bounds instead
      const c = hc[i].boundingSphere || hc[i].computeBoundingSphere() || hc[i].boundingSphere;
      const dx = c.center.x - camPos.x, dz = c.center.z - camPos.z; const dist2 = dx * dx + dz * dz;
      const near = dist2 < (d + c.radius) * (d + c.radius);
      hc[i].visible = near; lc[i].visible = !near;
    }
  }
}
