// Collision-only surface map. Uses the rendered paving and kerb geometry, never lot bounds.
// Boolean operations are cached per 64 m tile; the 120 Hz loop only clips small rings
// against the oriented car footprint. Area coverage catches thin islands and holes too.
import * as THREE from 'three';
import clipping from 'polygon-clipping';
const CELL = 64, EPS = 1e-5;
function clip(ring, axis, limit, greater) {
  const out = []; if (!ring.length) return out;
  let a = ring[ring.length - 1], da = (a[axis] - limit) * (greater ? 1 : -1);
  for (const b of ring) {
    const db = (b[axis] - limit) * (greater ? 1 : -1);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    if (db >= 0) out.push(b); a = b; da = db;
  }
  return out;
}
function rectClip(ring, x0, z0, x1, z1) {
  return clip(clip(clip(clip(ring, 0, x0, true), 0, x1, false), 1, z0, true), 1, z1, false);
}
function area(ring) { let sum = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return Math.abs(sum) / 2; }
function union(list) { return list.length ? clipping.union(...list) : []; }
export class RoadBoundary {
  constructor(colliders) { this.colliders = colliders; this.cells = new Map(); this.cache = new Map(); this.seeds = []; }
  add(ring, layer = 'access') {
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    for (let gx = Math.floor(Math.min(...xs) / CELL); gx <= Math.floor(Math.max(...xs) / CELL); gx++) for (let gz = Math.floor(Math.min(...zs) / CELL); gz <= Math.floor(Math.max(...zs) / CELL); gz++) {
      const r = rectClip(ring, gx * CELL, gz * CELL, (gx + 1) * CELL, (gz + 1) * CELL);
      if (r.length < 3 || area(r) < EPS) continue;
      const key = `${gx},${gz}`; let cell = this.cells.get(key); if (!cell) this.cells.set(key, cell = { road: [], blocked: [], access: [], forbidden: [] });
      cell[layer].push([ring]); this.cache.delete(key);
    }
  }
  mesh(mesh, layer) {
    const g = mesh.geometry, p = g.attributes.position, ix = g.index, n = ix?.count ?? p.count;
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i += 3) {
      const ring = []; for (let j = 0; j < 3; j++) { v.fromBufferAttribute(p, ix ? ix.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld); ring.push([v.x, v.z]); }
      if (area(ring) > EPS) this.add(ring, layer);
    }
  }
  region(gx, gz) {
    const key = `${gx},${gz}`; if (this.cache.has(key)) return this.cache.get(key);
    const c = this.cells.get(key); if (!c) return [];
    let roads = union(c.road); if (roads.length && c.blocked.length) roads = clipping.difference(roads, union(c.blocked));
    let result = union([...(roads.length ? [roads] : []), ...c.access]);
    if (result.length && c.forbidden.length) result = clipping.difference(result, union(c.forbidden));
    if (result.length) result = clipping.intersection(result, [[[gx * CELL, gz * CELL], [(gx + 1) * CELL, gz * CELL], [(gx + 1) * CELL, (gz + 1) * CELL], [gx * CELL, (gz + 1) * CELL]]]);
    this.cache.set(key, result); return result;
  }
  fits(x, z, yaw, halfL, halfW) {
    // Small tyre/body clearance keeps the visual mesh away from raised kerbs.
    const l = halfL + .08, w = halfW + .08, s = Math.sin(yaw), c = Math.cos(yaw);
    const ex = Math.abs(s) * l + Math.abs(c) * w, ez = Math.abs(c) * l + Math.abs(s) * w;
    let covered = 0;
    for (let gx = Math.floor((x - ex) / CELL); gx <= Math.floor((x + ex) / CELL); gx++) for (let gz = Math.floor((z - ez) / CELL); gz <= Math.floor((z + ez) / CELL); gz++) {
      for (const poly of this.region(gx, gz)) for (let i = 0; i < poly.length; i++) {
        const local = poly[i].map(([px, pz]) => [(px - x) * c + (pz - z) * s, (px - x) * s - (pz - z) * c]);
        covered += (i ? -1 : 1) * area(rectClip(local, -w, -l, w, l));
      }
    }
    return covered >= 4 * l * w - 1e-4;
  }
  clear(x, z, yaw, halfL, halfW) {
    if (!this.fits(x, z, yaw, halfL, halfW)) return false;
    const s = Math.sin(yaw), c = Math.cos(yaw), l = halfL + .12, w = halfW + .12;
    const ex = Math.abs(s) * l + Math.abs(c) * w, ez = Math.abs(c) * l + Math.abs(s) * w;
    for (const q of this.colliders.near(x, z)) {
      if (q.dead) continue;
      const dx = (q.x0 + q.x1) / 2 - x, dz = (q.z0 + q.z1) / 2 - z, hx = (q.x1 - q.x0) / 2, hz = (q.z1 - q.z0) / 2;
      if (Math.abs(dx) < ex + hx && Math.abs(dz) < ez + hz && Math.abs(dx * c + dz * s) < w + hx * Math.abs(c) + hz * Math.abs(s) && Math.abs(dx * s - dz * c) < l + hx * Math.abs(s) + hz * Math.abs(c)) return false;
    }
    return true;
  }
  nearest(x, z, yaw, halfL, halfW) {
    if (this.clear(x, z, yaw, halfL, halfW)) return { x, z, yaw };
    // Road-aligned seeds avoid rotating a long car across a narrow lane. Search in
    // distance order; include lateral offsets so parked cars cannot trap recovery.
    const candidates = [];
    for (const seed of this.seeds) {
      const dx = seed.bx - seed.x, dz = seed.bz - seed.z, len = Math.hypot(dx, dz); if (!len) continue;
      const t = Math.max(0, Math.min(1, ((x - seed.x) * dx + (z - seed.z) * dz) / (len * len)));
      for (const along of [0, -6, 6, -12, 12, -24, 24]) for (const off of seed.offsets || [0]) {
        const tt = Math.max(0, Math.min(1, t + along / len));
        const px = seed.x + tt * dx - dz / len * off, pz = seed.z + tt * dz + dx / len * off;
        let heading = Math.atan2(dx, -dz); if (Math.cos(heading - yaw) < 0) heading += Math.PI;
        candidates.push({ x: px, z: pz, yaw: heading, d: (px - x) ** 2 + (pz - z) ** 2 });
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const p of candidates) if (this.clear(p.x, p.z, p.yaw, halfL, halfW)) return p;
    throw new Error('No clear drivable recovery position found');
  }
  constrain(car) {
    const from = { x: car.px, z: car.pz, yaw: car.pyaw }, to = { x: car.x, z: car.z, yaw: car.yaw };
    const distance = Math.hypot(to.x - from.x, to.z - from.z) + Math.abs(to.yaw - from.yaw) * Math.hypot(car.halfL, car.halfW);
    const steps = Math.max(1, Math.ceil(distance / .2)); let safe = from;
    const fits = p => this.fits(p.x, p.z, p.yaw, car.halfL, car.halfW);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, next = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, yaw: from.yaw + (to.yaw - from.yaw) * t };
      if (fits(next)) { safe = next; continue; }
      let lo = 0, hi = 1;
      for (let j = 0; j < 10; j++) { const f = (lo + hi) / 2; const p = { x: safe.x + (next.x - safe.x) * f, z: safe.z + (next.z - safe.z) * f, yaw: safe.yaw + (next.yaw - safe.yaw) * f }; if (fits(p)) lo = f; else hi = f; }
      safe = { x: safe.x + (next.x - safe.x) * lo, z: safe.z + (next.z - safe.z) * lo, yaw: safe.yaw + (next.yaw - safe.yaw) * lo };
      // Keep tangential movement on axis-aligned kerbs; angled boundaries safely
      // stop the car, and steering/reversing away remains available.
      const slideX = { ...safe, x: next.x }, slideZ = { ...safe, z: next.z };
      if (this.clear(slideX.x, slideX.z, slideX.yaw, car.halfL, car.halfW)) { safe = slideX; car.vz = 0; } else if (this.clear(slideZ.x, slideZ.z, slideZ.yaw, car.halfL, car.halfW)) { safe = slideZ; car.vx = 0; } else { car.vx = 0; car.vz = 0; }
      car.x = safe.x; car.z = safe.z; car.yaw = safe.yaw; car.stuck = 0; return;
    }
  }
}
export function buildRoadBoundary(ctx) {
  const boundary = new RoadBoundary(ctx.colliders); ctx.scene.updateMatrixWorld(true);
  ctx.scene.traverse(mesh => {
    if (!mesh.isMesh || mesh.isInstancedMesh) return;
    const n = mesh.name;
    if (/^roads-(asphalt|concrete|pavers)$/.test(n)) boundary.mesh(mesh, 'road');
    else if (['footpaths', 'verges', 'medians'].includes(n)) boundary.mesh(mesh, 'blocked');
    else if (/^airstrip-(asphalt|concrete)$/.test(n) || ['school-paving', 'stadium-paving', 'patch-asphalt', 'patch-concrete', 'patch-paving'].includes(n)) boundary.mesh(mesh, 'access');
  });
  // Read campus paving in its original double precision. Float32 render buffers
  // introduce hairline cracks where asphalt meets pavers at angled junctions.
  for (const tile of ctx.university.surfaceData.tiles) for (const key of ['asphalt', 'paving']) for (const poly of tile[key] || []) {
    const rings = poly.map(r => r.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z)));
    const points = rings.flat();
    for (const tri of THREE.ShapeUtils.triangulateShape(rings[0], rings.slice(1))) boundary.add(tri.map(i => [points[i].x, points[i].y]), 'access');
  }
  // A cricket field remains turf even though the stadium's base slab runs below it.
  const st = ctx.stadiumInfo;
  if (st) boundary.add(Array.from({ length: 96 }, (_, i) => [st.cx + st.RX * Math.cos(i * Math.PI / 48), st.cz + st.RZ * Math.sin(i * Math.PI / 48)]), 'forbidden');
  boundary.add(ctx.world.lake.points, 'forbidden');
  for (const r of ctx.world.roads) {
    const x = r.x + r.w / 2, z = r.y + r.h / 2;
    boundary.seeds.push({ x: r.horizontal ? r.x : x, z: r.horizontal ? z : r.y, bx: r.horizontal ? r.x + r.w : x, bz: r.horizontal ? z : r.y + r.h, offsets: r.kind === 'spine' ? [-7.5, 7.5] : [0, -2, 2] });
  }
  for (const r of ctx.university?.roads || []) for (let i = 1; i < r.points.length; i++) boundary.seeds.push({ x: r.points[i - 1].x, z: r.points[i - 1].z, bx: r.points[i].x, bz: r.points[i].z, offsets: [0, -3, 3] });
  ctx.roadBoundary = boundary; return boundary;
}
