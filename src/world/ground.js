import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { patchGeo, merge, stdMat } from './geo.js';

export function buildGround(ctx) {
  const { scene, world, T } = ctx;
  const S = CONFIG.world.size, O = CONFIG.world.outside;
  const base = new THREE.Mesh(patchGeo(-O, -O, S + 2 * O, S + 2 * O, 6, 0), stdMat(T, T.grass));
  base.receiveShadow = true; base.name = 'ground';
  scene.add(base);

  const groups = { soil: [], crop: [], lawn: [], paving: [], concrete: [], asphalt: [], sand: [] };
  const L = world.L;
  for (const f of L.farms) {
    groups.soil.push(patchGeo(f.x + 1, f.y + 1, f.w - 2, f.h - 2, 5, 0.02));
    if (f.crop) groups.crop.push(patchGeo(f.crop.x, f.crop.y, f.crop.w, f.crop.h, 6, 0.04));
    if (f.pad) groups.lawn.push(patchGeo(f.pad.x, f.pad.y, f.pad.w, f.pad.h, 4, 0.03));
  }
  for (const v of L.villas) groups.lawn.push(patchGeo(v.x + 0.3, v.y + 0.3, v.w - 0.6, v.h - 0.6, 4, 0.02));
  for (const t of L.townhouses) groups.lawn.push(patchGeo(t.x + 0.2, t.y + 0.2, t.w - 0.4, t.h - 0.4, 4, 0.02));
  for (const c of L.commercial) groups.paving.push(patchGeo(c.x, c.y, c.w, c.h, 4, 0.02));
  for (const p of L.parks) groups.lawn.push(patchGeo(p.x, p.y, p.w, p.h, 4, 0.02));
  for (const a of L.amenities) {
    if (a.id === 'temple') { groups.lawn.push(patchGeo(a.x, a.y, a.w, a.h, 4, 0.02)); }
    else if (a.id === 'school') { groups.paving.push(patchGeo(a.x, a.y, a.w * 0.55, a.h, 4, 0.02)); groups.lawn.push(patchGeo(a.x + a.w * 0.55, a.y, a.w * 0.45, a.h, 4, 0.02)); }
    else if (a.id === 'stadium') groups.lawn.push(patchGeo(a.x, a.y, a.w, a.h, 4, 0.02));
    else if (a.id === 'agro') groups.concrete.push(patchGeo(a.x, a.y, a.w, a.h, 5, 0.02));
    else if (a.id === 'parking') groups.asphalt.push(patchGeo(a.x, a.y, a.w, a.h, 4, 0.02));
    else if (a.id === 'fire-station' || a.id === 'wtp') groups.concrete.push(patchGeo(a.x, a.y, a.w, a.h, 5, 0.02));
  }
  // Lake shore: sand ring 6 m outside the water polygon.
  const lk = L.lake.bbox; groups.sand.push(patchGeo(lk.x - 8, lk.y - 8, lk.w + 16, lk.h + 16, 6, 0.03));

  const mats = { soil: T.soil, crop: T.crop, lawn: T.lawn, paving: T.paving, concrete: T.concrete, asphalt: T.asphalt, sand: T.sand };
  for (const k of Object.keys(groups)) {
    const g = merge(groups[k]); if (!g) continue;
    const m = new THREE.Mesh(g, stdMat(T, mats[k])); m.receiveShadow = true; m.name = `patch-${k}`; scene.add(m);
  }
}
