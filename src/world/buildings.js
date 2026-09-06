// Procedural colonial-inspired contemporary buildings. Each archetype = one merged body geometry
// (vertex colours, plaster texture) + one glass geometry, instanced in spatial chunks with per-plot tints.
import * as THREE from 'three';
import { box, cyl, merge, stdMat } from './geo.js';
import { instancedChunks } from './instancing.js';
import { hashStr } from '../util/math.js';

const C = { wall: 0xffffff, stone: 0xb7a689, teak: 0x4a2f1d, cornice: 0xe9e2d6, parapet: 0xf2ede4, glassRail: 0xa9d8e6, sign: 0xc9a227, dark: 0x2a2f36, roof: 0xd8d2c6 };
const TINTS = [0xf5f0e6, 0xe8dcc3, 0xf3ece2, 0xdfd6ca].map((c) => new THREE.Color(c));

function windows(list, glass, spec) {
  // spec: { z, y, xs[], w, h, shutters, dir } dir: 'front'(+z) 'back'(-z) 'left'(-x) 'right'(+x)
  for (const x of spec.xs) {
    if (spec.dir === 'front' || spec.dir === 'back') {
      const z = spec.z;
      glass.push(box(spec.w, spec.h, 0.1, 0x223447, { x, y: spec.y, z }));
      list.push(box(spec.w + 0.3, 0.12, 0.35, C.cornice, { x, y: spec.y + spec.h / 2 + 0.06, z })); // lintel
      list.push(box(spec.w + 0.3, 0.1, 0.3, C.stone, { x, y: spec.y - spec.h / 2 - 0.05, z })); // sill
      if (spec.shutters) for (const s of [-1, 1]) list.push(box(0.4, spec.h, 0.08, C.teak, { x: x + s * (spec.w / 2 + 0.22), y: spec.y, z }));
    } else {
      const zx = spec.z; // here spec.z is x plane, x iterates along z
      glass.push(box(0.1, spec.h, spec.w, 0x223447, { x: zx, y: spec.y, z: x }));
      list.push(box(0.35, 0.12, spec.w + 0.3, C.cornice, { x: zx, y: spec.y + spec.h / 2 + 0.06, z: x }));
      if (spec.shutters) for (const s of [-1, 1]) list.push(box(0.08, spec.h, 0.4, C.teak, { x: zx, y: spec.y, z: x + s * (spec.w / 2 + 0.22) }));
    }
  }
}
function colonnade(list, xs, z, h, y0 = 0.5, round = true) {
  for (const x of xs) {
    list.push(round ? cyl(0.22, 0.26, h, 10, C.parapet, { x, y: y0 + h / 2, z }) : box(0.45, h, 0.45, C.parapet, { x, y: y0 + h / 2, z }));
    list.push(box(0.6, 0.15, 0.6, C.stone, { x, y: y0 + 0.075, z }));
    list.push(box(0.6, 0.18, 0.6, C.cornice, { x, y: y0 + h - 0.09, z }));
  }
  // Shallow arch spandrels between columns: a drop beam segment reads as an arch from the road.
  for (let i = 0; i < xs.length - 1; i++) { const a = xs[i], b = xs[i + 1]; list.push(box(b - a - 0.5, 0.45, 0.32, C.parapet, { x: (a + b) / 2, y: y0 + h - 0.42, z })); }
}
function parapet(list, w, d, y, h = 0.7, t = 0.22, color = C.parapet) {
  list.push(box(w, h, t, color, { y: y + h / 2, z: d / 2 - t / 2 })); list.push(box(w, h, t, color, { y: y + h / 2, z: -d / 2 + t / 2 }));
  list.push(box(t, h, d, color, { x: w / 2 - t / 2, y: y + h / 2 })); list.push(box(t, h, d, color, { x: -w / 2 + t / 2, y: y + h / 2 }));
}
function glassRail(list, w, y, z, h = 1.0) { list.push(box(w, h, 0.06, C.glassRail, { y: y + h / 2, z })); list.push(box(w, 0.06, 0.08, C.dark, { y: y + h, z })); }

// Villa: 20 x 15 footprint, front on +Z. Three facade variants.
function villa(variant) {
  const L = [], G = [];
  const W = 20, D = 15, F = 3.8, H1 = 0.5 + F, H2 = H1 + 0.35 + 3.4;
  L.push(box(W + 0.6, 0.5, D + 0.6, C.stone, { y: 0.25 }));
  L.push(box(W, F, D, C.wall, { y: 0.5 + F / 2 }));
  L.push(box(W + 0.5, 0.35, D + 0.5, C.cornice, { y: H1 + 0.175 }));
  const setback = variant === 2 ? 2 : 3;
  L.push(box(W, 3.4, D - setback, C.wall, { y: H1 + 0.35 + 1.7, z: -setback / 2 }));
  L.push(box(W + 0.4, 0.3, D - setback + 0.4, C.cornice, { y: H2 + 0.15, z: -setback / 2 }));
  parapet(L, W + 0.4, D - setback + 0.4, H2 + 0.3, 0.6);
  L.push(box(3.2, 2.6, 2.6, C.wall, { x: -W / 2 + 2.2, y: H2 + 0.3 + 1.3, z: -D / 2 + setback / 2 + 2 }));
  // Verandah across the front with columns (round on variants 0/2, square on 1).
  const vz = D / 2 + 2.6;
  L.push(box(W + 0.4, 0.35, 2.9, C.cornice, { y: H1 + 0.175, z: D / 2 + 1.35 }));
  L.push(box(W + 0.4, 0.15, 2.9, C.stone, { y: 0.5 + 0.075, z: D / 2 + 1.35 }));
  const cols = variant === 1 ? [-9, -4.5, 0, 4.5, 9] : [-9, -6, -3, 0, 3, 6, 9];
  colonnade(L, cols, vz, F, 0.5, variant !== 1);
  glassRail(L, W - 0.2, H1 + 0.35, D / 2 + 2.7);
  glassRail(L, W - 0.2, H1 + 0.35, D / 2 - setback / 2 + 0.1);
  // Door and windows.
  L.push(box(1.6, 2.7, 0.15, C.teak, { y: 0.5 + 1.35, z: D / 2 + 0.05 }));
  L.push(box(2.0, 0.25, 0.3, C.cornice, { y: 0.5 + 2.85, z: D / 2 + 0.08 }));
  windows(L, G, { dir: 'front', z: D / 2 + 0.05, y: 0.5 + 1.9, xs: variant === 2 ? [-7.5, -4.2, 4.2, 7.5] : [-7, -3.5, 3.5, 7], w: 1.3, h: 2.4, shutters: true });
  windows(L, G, { dir: 'front', z: D / 2 - setback + 0.05, y: H1 + 0.35 + 1.7, xs: [-7, -3.5, 0, 3.5, 7], w: variant === 1 ? 2.2 : 1.3, h: 2.2, shutters: variant !== 1 });
  windows(L, G, { dir: 'back', z: -D / 2 - 0.05, y: 0.5 + 1.9, xs: [-6, -2, 2, 6], w: 1.3, h: 2.2, shutters: true });
  windows(L, G, { dir: 'back', z: -D / 2 - 0.05, y: H1 + 0.35 + 1.7, xs: [-6, -2, 2, 6], w: 1.3, h: 2.0, shutters: false });
  for (const s of [-1, 1]) {
    windows(L, G, { dir: 'side', z: s * (W / 2 + 0.05), y: 0.5 + 1.9, xs: [-4, 0, 4], w: 1.2, h: 2.2, shutters: true });
    windows(L, G, { dir: 'side', z: s * (W / 2 + 0.05), y: H1 + 0.35 + 1.7, xs: [-4.5, -1.5, 1.5], w: 1.2, h: 2.0, shutters: false });
  }
  // Driveway slab in front and a pergola on the pool side (variant 2).
  L.push(box(4.5, 0.08, 7, 0xcfc8bc, { x: W / 2 - 3, y: 0.04, z: D / 2 + 3.5 + 3.5 }));
  if (variant === 2) { for (const x of [W / 2 + 1, W / 2 + 4]) for (const z of [-4, 0, 4]) L.push(box(0.3, 3, 0.3, C.teak, { x, y: 1.5, z })); for (const z of [-4, -2, 0, 2, 4]) L.push(box(3.6, 0.15, 0.2, C.teak, { x: W / 2 + 2.5, y: 3.05, z })); }
  return { body: merge(L), glass: merge(G) };
}
// Farmhouse: 22 x 11, single storey + roof terrace, verandah on the front.
function farmhouse() {
  const L = [], G = [];
  const W = 22, D = 11, F = 4.0, H1 = 0.5 + F;
  L.push(box(W + 0.6, 0.5, D + 0.6, C.stone, { y: 0.25 }));
  L.push(box(W, F, D, C.wall, { y: 0.5 + F / 2 }));
  L.push(box(W + 0.5, 0.35, D + 0.5, C.cornice, { y: H1 + 0.175 }));
  parapet(L, W + 0.4, D + 0.4, H1 + 0.35, 0.9);
  L.push(box(3, 2.4, 2.6, C.wall, { x: -W / 2 + 2, y: H1 + 0.35 + 1.2, z: -D / 2 + 1.8 }));
  L.push(box(W + 0.4, 0.3, 3.0, C.cornice, { y: H1 + 0.15, z: D / 2 + 1.5 }));
  L.push(box(W + 0.4, 0.15, 3.0, C.stone, { y: 0.575, z: D / 2 + 1.5 }));
  colonnade(L, [-10, -6.7, -3.3, 0, 3.3, 6.7, 10], D / 2 + 2.7, F, 0.5, true);
  L.push(box(1.6, 2.7, 0.15, C.teak, { y: 1.85, z: D / 2 + 0.05 }));
  windows(L, G, { dir: 'front', z: D / 2 + 0.05, y: 2.4, xs: [-8, -4.5, 4.5, 8], w: 1.4, h: 2.4, shutters: true });
  windows(L, G, { dir: 'back', z: -D / 2 - 0.05, y: 2.4, xs: [-7, -3, 1, 5, 8], w: 1.2, h: 2.0, shutters: true });
  for (const s of [-1, 1]) windows(L, G, { dir: 'side', z: s * (W / 2 + 0.05), y: 2.4, xs: [-2.5, 2.5], w: 1.2, h: 2.0, shutters: true });
  // Pergola on the roof terrace.
  for (const x of [-6, 0, 6]) for (const z of [-3, 3]) L.push(box(0.25, 2.8, 0.25, C.teak, { x, y: H1 + 0.35 + 1.4, z }));
  for (const z of [-3, -1.5, 0, 1.5, 3]) L.push(box(12.5, 0.12, 0.18, C.teak, { y: H1 + 0.35 + 2.85, z }));
  return { body: merge(L), glass: merge(G) };
}
// Town house: 15 x 10, two storeys, shared side walls. Two variants (balcony / bay).
function townhouse(variant) {
  const L = [], G = [];
  const W = 15, D = 10, F = 3.3, H1 = 0.4 + F, H2 = H1 + 0.3 + 3.1;
  L.push(box(W + 0.2, 0.4, D + 0.4, C.stone, { y: 0.2 }));
  L.push(box(W, F, D, C.wall, { y: 0.4 + F / 2 }));
  L.push(box(W + 0.3, 0.3, D + 0.4, C.cornice, { y: H1 + 0.15 }));
  L.push(box(W, 3.1, D, C.wall, { y: H1 + 0.3 + 1.55 }));
  L.push(box(W + 0.3, 0.28, D + 0.4, C.cornice, { y: H2 + 0.14 }));
  parapet(L, W + 0.3, D + 0.4, H2 + 0.28, 0.6);
  L.push(box(2.6, 2.2, 2.4, C.wall, { x: W / 2 - 2.2, y: H2 + 0.28 + 1.1, z: -D / 2 + 1.8 }));
  // Front porch with two columns, first-floor balcony or bay.
  L.push(box(6, 0.3, 2.4, C.cornice, { x: -W / 2 + 4, y: H1 + 0.15, z: D / 2 + 1.2 }));
  colonnade(L, [-W / 2 + 1.4, -W / 2 + 6.6], D / 2 + 2.1, F, 0.4, variant === 0);
  L.push(box(1.3, 2.5, 0.15, C.teak, { x: -W / 2 + 4, y: 0.4 + 1.25, z: D / 2 + 0.05 }));
  windows(L, G, { dir: 'front', z: D / 2 + 0.05, y: 0.4 + 1.8, xs: [1.5, 4.5], w: 1.3, h: 2.2, shutters: true });
  if (variant === 0) { glassRail(L, 6, H1 + 0.3, D / 2 + 2.3); windows(L, G, { dir: 'front', z: D / 2 + 0.05, y: H1 + 0.3 + 1.6, xs: [-W / 2 + 2.5, -W / 2 + 5.5, 1.5, 4.5], w: 1.3, h: 2.0, shutters: true }); }
  else { L.push(box(5, 3.1, 1.2, C.wall, { x: 2.5, y: H1 + 0.3 + 1.55, z: D / 2 + 0.6 })); windows(L, G, { dir: 'front', z: D / 2 + 1.25, y: H1 + 0.3 + 1.6, xs: [1.2, 3.8], w: 1.6, h: 2.0, shutters: false }); windows(L, G, { dir: 'front', z: D / 2 + 0.05, y: H1 + 0.3 + 1.6, xs: [-W / 2 + 2.5, -W / 2 + 5.5], w: 1.3, h: 2.0, shutters: true }); }
  windows(L, G, { dir: 'back', z: -D / 2 - 0.05, y: 0.4 + 1.8, xs: [-4, 0, 4], w: 1.3, h: 2.0, shutters: false });
  windows(L, G, { dir: 'back', z: -D / 2 - 0.05, y: H1 + 0.3 + 1.6, xs: [-4, 0, 4], w: 1.3, h: 1.8, shutters: false });
  L.push(box(3, 0.06, 4.5, 0xcfc8bc, { x: W / 2 - 3, y: 0.03, z: D / 2 + 2.3 }));
  return { body: merge(L), glass: merge(G) };
}
// Commercial: 25 wide (front, +Z) x 40 deep, three storeys, arcaded ground floor and signage.
function commercial() {
  const L = [], G = [];
  const W = 25, D = 40, F = 4.2, H1 = 0.4 + F, H2 = H1 + 0.3 + 3.4, H3 = H2 + 0.3 + 3.4;
  L.push(box(W + 0.4, 0.4, D + 0.4, C.stone, { y: 0.2 }));
  L.push(box(W, F, D - 3, C.wall, { y: 0.4 + F / 2, z: -1.5 }));
  L.push(box(W + 0.4, 0.3, D + 0.4, C.cornice, { y: H1 + 0.15 }));
  L.push(box(W, 3.4, D, C.wall, { y: H1 + 0.3 + 1.7 }));
  L.push(box(W + 0.4, 0.3, D + 0.4, C.cornice, { y: H2 + 0.15 }));
  L.push(box(W, 3.4, D, C.wall, { y: H2 + 0.3 + 1.7 }));
  L.push(box(W + 0.5, 0.4, D + 0.5, C.cornice, { y: H3 + 0.2 }));
  parapet(L, W + 0.5, D + 0.5, H3 + 0.4, 0.9);
  L.push(box(4, 2.6, 4, C.wall, { x: -W / 2 + 3, y: H3 + 0.4 + 1.3, z: -D / 2 + 3 }));
  // Arcade along the front and both long sides.
  const xs = []; for (let x = -W / 2 + 1; x <= W / 2 - 1; x += 4.6) xs.push(x);
  colonnade(L, xs, D / 2 - 0.6, F, 0.4, false);
  const zs = []; for (let z = -D / 2 + 3; z <= D / 2 - 3; z += 4.6) zs.push(z);
  for (const s of [-1, 1]) for (const z of zs) { L.push(box(0.45, F, 0.45, C.parapet, { x: s * (W / 2 - 0.4), y: 0.4 + F / 2, z })); }
  // Shop fronts (glass) inside the arcade and a gold sign band.
  windows(L, G, { dir: 'front', z: D / 2 - 3 + 0.05, y: 0.4 + 1.8, xs: [-9, -4.5, 0, 4.5, 9], w: 3.6, h: 3.2, shutters: false });
  L.push(box(W - 1, 1.1, 0.25, C.sign, { y: H1 - 0.7, z: D / 2 + 0.05 }));
  for (const h of [H1 + 0.3 + 1.7, H2 + 0.3 + 1.7]) {
    windows(L, G, { dir: 'front', z: D / 2 + 0.05, y: h, xs: [-9, -4.5, 0, 4.5, 9], w: 2.6, h: 2.2, shutters: false });
    for (const s of [-1, 1]) windows(L, G, { dir: 'side', z: s * (W / 2 + 0.05), y: h, xs: [-16, -12, -8, -4, 0, 4, 8, 12, 16], w: 2.4, h: 2.2, shutters: false });
  }
  return { body: merge(L), glass: merge(G) };
}

const FACING_ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

export function buildBuildings(ctx) {
  const { scene, world, T, colliders } = ctx;
  const bodyMat = stdMat(T, T.plaster, { vertexColors: true, roughness: 0.8 });
  bodyMat.map.repeat.set(1, 1);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x6f93b3, roughness: 0.18, metalness: 0.35, emissive: 0xffc36b, emissiveIntensity: 0 });
  ctx.glassMat = glassMat;
  const arche = {
    villa: [villa(0), villa(1), villa(2)], farmhouse: [farmhouse()], townhouse: [townhouse(0), townhouse(1)], commercial: [commercial()],
  };
  const items = { villa: [[], [], []], farmhouse: [[]], townhouse: [[], []], commercial: [[]] };
  const tint = (id) => TINTS[hashStr(id) % TINTS.length];
  const variantOf = (id, n) => hashStr(id + 'v') % n;

  for (const p of world.plots) {
    if (p.type === 'villa' || p.type === 'townhouse' || p.type === 'farm') {
      const h = p.house; if (!h) continue;
      const cx = h.x + h.w / 2, cz = h.y + h.h / 2;
      const key = p.type === 'farm' ? 'farmhouse' : p.type;
      const v = variantOf(p.id, items[key].length);
      items[key][v].push({ x: cx, z: cz, rot: FACING_ROT[p.facing] || 0, color: tint(p.id) });
      // Colliders use the archetype footprint, oriented by facing (all N/S here so width stays along X).
      const fw = key === 'villa' ? 20.6 : key === 'townhouse' ? 15.2 : 22.6; const fd = key === 'villa' ? 15.6 : key === 'townhouse' ? 10.4 : 11.6;
      colliders.add(cx - fw / 2, cz - fd / 2, cx + fw / 2, cz + fd / 2, 'house', p);
      if (p.type === 'farm' && p.pool) { colliders.addRect(p.pool, 'pool', p); }
    } else if (p.type === 'commercial') {
      const cx = p.x + p.w / 2, cz = p.y + p.h / 2;
      items.commercial[0].push({ x: cx, z: cz, rot: FACING_ROT[p.facing], color: tint(p.id) });
      colliders.add(cx - 20.3, cz - 12.8, cx + 20.3, cz + 12.8, 'house', p);
    }
  }
  for (const key of Object.keys(arche)) arche[key].forEach((a, i) => {
    const list = items[key][i]; if (!list.length) return;
    scene.add(instancedChunks(a.body, bodyMat, list, { name: `${key}-${i}`, castShadow: true, receiveShadow: true }));
    if (a.glass) scene.add(instancedChunks(a.glass, glassMat, list, { name: `${key}-${i}-glass` }));
  });

  // Villa compound walls (0.6 m, with a 6 m gate on the facing side) and farm pools.
  const wallGeo = box(1, 0.6, 0.25, 0xe6dfd3);
  const wallItems = [];
  for (const p of world.plots) {
    if (p.type !== 'villa') continue;
    const { x, y, w, h } = p; const front = p.facing;
    const seg = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); wallItems.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, rot: Math.atan2(-(z1 - z0), x1 - x0), sx: len }); colliders.add(Math.min(x0, x1) - 0.15, Math.min(z0, z1) - 0.15, Math.max(x0, x1) + 0.15, Math.max(z0, z1) + 0.15, 'cwall', p); };
    const gx0 = x + w / 2 - 3, gx1 = x + w / 2 + 3;
    if (front === 'N') { seg(x, y, gx0, y); seg(gx1, y, x + w, y); } else seg(x, y, x + w, y);
    if (front === 'S') { seg(x, y + h, gx0, y + h); seg(gx1, y + h, x + w, y + h); } else seg(x, y + h, x + w, y + h);
    seg(x, y, x, y + h); seg(x + w, y, x + w, y + h);
  }
  scene.add(instancedChunks(wallGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), wallItems, { name: 'compound-walls' }));

  // Farm pools: coping rim + water.
  const rim = [], water = [];
  for (const p of world.plots) {
    if (p.type !== 'farm' || !p.pool) continue;
    const q = p.pool;
    rim.push(box(q.w + 1.2, 0.3, 0.6, 0xe8e2d6, { x: q.x + q.w / 2, z: q.y - 0.3, y: 0.15 })); rim.push(box(q.w + 1.2, 0.3, 0.6, 0xe8e2d6, { x: q.x + q.w / 2, z: q.y + q.h + 0.3, y: 0.15 }));
    rim.push(box(0.6, 0.3, q.h, 0xe8e2d6, { x: q.x - 0.3, z: q.y + q.h / 2, y: 0.15 })); rim.push(box(0.6, 0.3, q.h, 0xe8e2d6, { x: q.x + q.w + 0.3, z: q.y + q.h / 2, y: 0.15 }));
    const wg = new THREE.PlaneGeometry(q.w, q.h); wg.rotateX(-Math.PI / 2); wg.translate(q.x + q.w / 2, 0.12, q.y + q.h / 2); water.push(wg);
  }
  const rimMesh = new THREE.Mesh(merge(rim), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); rimMesh.name = 'pool-rims'; scene.add(rimMesh);
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x3aa7d6, roughness: 0.1, metalness: 0.2, normalMap: T.waterNormal, transparent: true, opacity: 0.9 });
  poolMat.normalScale.set(0.4, 0.4); poolMat.normalMap.repeat.set(0.15, 0.15);
  const poolMesh = new THREE.Mesh(merge(water), poolMat); poolMesh.name = 'pools'; scene.add(poolMesh);
  ctx.poolMat = poolMat;
}
