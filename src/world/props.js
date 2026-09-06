// Small props from the Kenney kits: parked cars, planters and flowers, shore rocks, temple columns.
import * as THREE from 'three';
import { instancedChunks } from './instancing.js';
import { recolor, recolorHue, hueOf } from './models.js';
import { rng, hashStr } from '../util/math.js';

const CAR_COLOURS = [0xd8dde2, 0x1e4fa3, 0xb8302a, 0x2f2f33, 0xe8e2d0, 0x6b7f8f];

export function buildProps(ctx) {
  const { scene, world, colliders, models } = ctx;
  if (!models) return;
  const r = rng(777);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
  const flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

  // Parked cars: 3 recoloured variants per model, placed on villa driveways, town house fronts and commercial forecourts.
  const carKeys = ['sedan', 'suv-luxury', 'hatchback-sports', 'van', 'sedan-sports', 'taxi'].filter((k) => models[k]);
  const variants = [];
  for (const k of carKeys) for (let v = 0; v < 3; v++) {
    const src = models[k]; const geo = src.geo.clone();
    if (src.dominant) { const h = hueOf(src.dominant); const to = CAR_COLOURS[(hashStr(k) + v * 2) % CAR_COLOURS.length]; if (h.s > 0.18) recolorHue(geo, h.h, to, 0.08); else recolor(geo, src.dominant, to, 0.1, 0.12); }
    variants.push({ geo, items: [], size: src.size });
  }
  const park = (x, z, rot) => { const v = variants[Math.floor(r() * variants.length)]; v.items.push({ x, z, rot }); const hw = 1.1, hl = 2.5; const c = Math.abs(Math.cos(rot)) > 0.5 ? [hw, hl] : [hl, hw]; colliders.add(x - c[0], z - c[1], x + c[0], z + c[1], 'car'); };
  for (const p of world.plots) {
    const h = hashStr(p.id + 'car') % 100;
    if (p.type === 'villa' && h < 22) { const x = p.house.x + p.house.w + 2.2 > p.x + p.w - 1.2 ? p.x + p.w - 2.2 : p.house.x + p.house.w + 2.2; const z = p.facing === 'S' ? p.house.y + p.house.h + 4.5 : p.house.y - 4.5; park(x, z, p.facing === 'S' ? 0 : Math.PI); }
    else if (p.type === 'townhouse' && h < 14) { const z = p.facing === 'S' ? p.y + p.h - 2.6 : p.y + 2.6; park(p.x + p.w - 3.2, z, p.facing === 'S' ? 0 : Math.PI); }
    else if (p.type === 'commercial' && h < 70) { const n = 1 + (h % 2); for (let i = 0; i < n; i++) { const z = p.y + 5 + i * 7 + r() * 3; const x = p.facing === 'E' ? p.x + p.w - 3.5 : p.x + 3.5; park(x, z, p.facing === 'E' ? Math.PI / 2 : -Math.PI / 2); } }
  }
  // Parking lot by the lake.
  const lot = world.amenities.find((a) => a.id === 'parking');
  if (lot) for (let z = lot.y + 13; z < lot.y + lot.h - 13; z += 6) { if (r() < 0.45) park(lot.x + 28, z, -Math.PI / 2); if (r() < 0.45) park(lot.x + lot.w - 28, z, Math.PI / 2); }
  let carCount = 0;
  for (const v of variants) { if (!v.items.length) continue; carCount += v.items.length; scene.add(instancedChunks(v.geo, mat, v.items, { name: 'parked-cars', chunk: 400, castShadow: true })); }
  ctx.parkedCars = carCount;

  // Planters with flowers along park paths, flower beds in parks and temple lawns.
  const pots = [], flowers = { flower_redA: [], flower_yellowA: [], flower_purpleA: [] };
  const fkeys = Object.keys(flowers).filter((k) => models[k]);
  for (const pk of world.parks) {
    for (let x = pk.x + 12; x < pk.x + pk.w - 10; x += 22) { pots.push({ x, z: pk.y + pk.h / 2 - 3.2, rot: 0 }); pots.push({ x: x + 11, z: pk.y + pk.h / 2 + 3.2, rot: 0 }); }
    for (let i = 0; i < 70; i++) { const k = fkeys[Math.floor(r() * fkeys.length)]; if (!k) break; const cx = pk.x + 15 + r() * (pk.w - 30), cz = pk.y + 6 + r() * (pk.h - 12); for (let j = 0; j < 6; j++) flowers[k].push({ x: cx + (r() - 0.5) * 4, z: cz + (r() - 0.5) * 4, rot: r() * 6.28, sx: 1.2, sy: 1.2, sz: 1.2 }); }
  }
  const temple = world.amenities.find((a) => a.id === 'temple');
  if (temple) { const cx = temple.x + temple.w / 2, cz = temple.y + temple.h / 2; for (let i = 0; i < 40; i++) { const k = fkeys[i % fkeys.length]; if (!k) break; const a = (i / 40) * Math.PI * 2; const rad = 52 + (i % 2) * 3; flowers[k].push({ x: cx + Math.cos(a) * rad, z: cz + Math.sin(a) * rad, rot: r() * 6.28, sx: 1.3, sy: 1.3, sz: 1.3 }); } }
  if (models.pot_large && pots.length) scene.add(instancedChunks(models.pot_large.geo, flat, pots, { name: 'planters', chunk: 400, castShadow: true }));
  for (const k of fkeys) if (flowers[k].length) scene.add(instancedChunks(models[k].geo, flat, flowers[k], { name: `flowers-${k}`, chunk: 300 }));

  // Rocks along the lake shore (solid), log stacks by a few farmhouses.
  const rocks = [];
  const lk = world.lake.bbox; const o = 6;
  for (let x = lk.x - o; x <= lk.x + lk.w + o; x += 22 + r() * 10) { rocks.push({ x, z: lk.y - o, rot: r() * 6.28, sx: 0.8 + r() * 0.6, sy: 0.8 + r() * 0.4, sz: 0.8 + r() * 0.6 }); rocks.push({ x, z: lk.y + lk.h + o, rot: r() * 6.28, sx: 0.8 + r() * 0.6, sy: 0.8 + r() * 0.4, sz: 0.8 + r() * 0.6 }); }
  for (let z = lk.y - o + 12; z < lk.y + lk.h + o; z += 22 + r() * 10) { rocks.push({ x: lk.x - o, z, rot: r() * 6.28, sx: 0.9, sy: 0.9, sz: 0.9 }); rocks.push({ x: lk.x + lk.w + o, z, rot: r() * 6.28, sx: 0.9, sy: 0.9, sz: 0.9 }); }
  for (const it of rocks) colliders.add(it.x - 1, it.z - 1, it.x + 1, it.z + 1, 'rock');
  if (models.rock_largeA) scene.add(instancedChunks(models.rock_largeA.geo, flat, rocks, { name: 'rocks', chunk: 400, castShadow: true }));
  const logs = [];
  for (const p of world.plots) if (p.type === 'farm' && hashStr(p.id + 'log') % 5 === 0 && p.pad) logs.push({ x: p.pad.x + 2, z: p.pad.y + p.pad.h - 3, rot: 0 });
  if (models.log_stack) scene.add(instancedChunks(models.log_stack.geo, flat, logs, { name: 'logs', chunk: 400 }));
}
