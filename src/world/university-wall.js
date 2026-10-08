import * as THREE from 'three';
import { box, merge } from './geo.js';
import { STONE, TRIM } from './university-buildings.js';

// A continuous estate wall follows the measured campus boundary. The south
// edge is split around the university gate rather than hidden behind it.
export function buildCampusWall(ctx, plan, root, materials) {
  const wallHeight = 6.2, thickness = .55, gateHalf = plan.gate.width / 2 + 8;
  const pieces = [], caps = [];
  const points = plan.boundary.map(([x, z]) => ({ x, z }));
  const addSegment = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 1) return;
    const ts = [0, 1];
    if (Math.abs(dx) > 1e-5) {
      for (const gx of [plan.gate.x - gateHalf, plan.gate.x + gateHalf]) {
        const t = (gx - a.x) / dx;
        if (t > .001 && t < .999) ts.push(t);
      }
    }
    ts.sort((x, y) => x - y);
    for (let i = 1; i < ts.length; i++) {
      const t0 = ts[i - 1], t1 = ts[i], tm = (t0 + t1) / 2;
      const mx = a.x + dx * tm, mz = a.z + dz * tm;
      // Only the south-edge crossing is a gate; other boundary sections keep
      // their wall even if they pass the same x coordinate farther north.
      if (Math.abs(mx - plan.gate.x) < gateHalf && mz > plan.gate.z - 55) continue;
      const ax = a.x + dx * t0, az = a.z + dz * t0;
      const bx = a.x + dx * t1, bz = a.z + dz * t1;
      const sx = (ax + bx) / 2, sz = (az + bz) / 2, sl = Math.hypot(bx - ax, bz - az);
      pieces.push(box(sl, wallHeight, thickness, STONE, { x: sx, y: wallHeight / 2, z: sz, rotY: -Math.atan2(bz - az, bx - ax) }));
      ctx.colliders.add(Math.min(ax, bx) - 1.1, Math.min(az, bz) - 1.1, Math.max(ax, bx) + 1.1, Math.max(az, bz) + 1.1, 'campus-wall', null, wallHeight);
      for (let d = 18; d < sl - 4; d += 36) {
        const q = d / sl;
        caps.push(box(1.05, wallHeight + .45, 1.05, TRIM, { x: ax + (bx - ax) * q, y: (wallHeight + .45) / 2, z: az + (bz - az) * q, rotY: -Math.atan2(bz - az, bx - ax) }));
      }
    }
  };
  for (let i = 1; i < points.length; i++) addSegment(points[i - 1], points[i]);
  const wall = new THREE.Group(); wall.name = 'university-perimeter-wall';
  const body = merge(pieces); if (body) { const m = new THREE.Mesh(body, materials.stone); m.castShadow = true; m.receiveShadow = true; wall.add(m); }
  const posts = merge(caps); if (posts) { const m = new THREE.Mesh(posts, materials.trim); m.castShadow = true; m.receiveShadow = true; wall.add(m); }
  // Gate-side piers align the perimeter wall with the existing entry arch.
  const z = plan.gate.z + 20;
  const gatePiers = [
    box(2.8, 7.2, 2.8, STONE, { x: plan.gate.x - gateHalf, y: 3.6, z }),
    box(2.8, 7.2, 2.8, STONE, { x: plan.gate.x + gateHalf, y: 3.6, z }),
    box(1.5, .35, 1.5, TRIM, { x: plan.gate.x - gateHalf, y: 7.35, z }),
    box(1.5, .35, 1.5, TRIM, { x: plan.gate.x + gateHalf, y: 7.35, z }),
  ];
  const gateMesh = merge(gatePiers); if (gateMesh) wall.add(new THREE.Mesh(gateMesh, materials.trim));
  ctx.colliders.add(plan.gate.x - gateHalf - 1.4, z - 1.4, plan.gate.x - gateHalf + 1.4, z + 1.4, 'campus-wall-gate', null, 8);
  ctx.colliders.add(plan.gate.x + gateHalf - 1.4, z - 1.4, plan.gate.x + gateHalf + 1.4, z + 1.4, 'campus-wall-gate', null, 8);
  root.add(wall);
}
