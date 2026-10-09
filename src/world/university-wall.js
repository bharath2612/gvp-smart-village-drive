import * as THREE from 'three';
import { box, merge } from './geo.js';
import surfaces from './generated/university-surfaces.json';
import { STONE, TRIM } from './university-buildings.js';

// The baked outer envelope encloses campus roads and footpaths. The south
// opening returns to the existing gate pillars.
export function buildCampusWall(ctx, plan, root, materials) {
  const wallHeight = 6.2, thickness = .55, gateHalf = plan.gate.width / 2 + 6.5;
  const pieces = [], caps = [];
  const points = surfaces.wallBoundary.map(([x, z]) => ({ x, z }));
  plan.wallBoundary=surfaces.wallBoundary;
  plan.wallSegments=[];
  const gateEnds=[];
  const addSegment = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < .001) return;
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
      if (Math.abs(mx - plan.gate.x) < gateHalf-.001 && mz >= plan.gate.z) continue;
      const ax = a.x + dx * t0, az = a.z + dz * t0;
      const bx = a.x + dx * t1, bz = a.z + dz * t1;
      const sx = (ax + bx) / 2, sz = (az + bz) / 2, sl = Math.hypot(bx - ax, bz - az);
      pieces.push(box(sl, wallHeight, thickness, STONE, { x: sx, y: wallHeight / 2, z: sz, rotY: -Math.atan2(bz - az, bx - ax) }));
      plan.wallSegments.push({ax,az,bx,bz});
      // Short collider tiles follow curved/diagonal walls without filling the
      // inside of their bounding boxes and blocking nearby roads.
      const steps=Math.ceil(sl/3);
      for(let j=0;j<steps;j++){
        const x0=ax+(bx-ax)*j/steps,z0=az+(bz-az)*j/steps;
        const x1=ax+(bx-ax)*(j+1)/steps,z1=az+(bz-az)*(j+1)/steps;
        ctx.colliders.add(Math.min(x0,x1)-.4,Math.min(z0,z1)-.4,Math.max(x0,x1)+.4,Math.max(z0,z1)+.4,'campus-wall',null,wallHeight);
      }
      for(const q of [{x:ax,z:az},{x:bx,z:bz}])if(Math.abs(Math.abs(q.x-plan.gate.x)-gateHalf)<.01&&q.z>plan.gate.z)gateEnds.push(q);
      for (let d = 18; d < sl - 4; d += 36) {
        const q = d / sl;
        caps.push(box(1.05, wallHeight + .45, 1.05, TRIM, { x: ax + (bx - ax) * q, y: (wallHeight + .45) / 2, z: az + (bz - az) * q, rotY: -Math.atan2(bz - az, bx - ax) }));
      }
    }
  };
  for (let i = 1; i < points.length; i++) addSegment(points[i - 1], points[i]);
  // Return the wall to the OUTER faces of the existing gate pillars.
  // These short wings close the perimeter without narrowing the road.
  for(const q of [...gateEnds]){
    const side=Math.sign(q.x-plan.gate.x);
    addSegment(q,{x:plan.gate.x+side*gateHalf,z:plan.gate.z});
  }
  const wall = new THREE.Group(); wall.name = 'university-perimeter-wall';
  const body = merge(pieces); if (body) { const m = new THREE.Mesh(body, materials.stone); m.castShadow = true; m.receiveShadow = true; wall.add(m); }
  const posts = merge(caps); if (posts) { const m = new THREE.Mesh(posts, materials.trim); m.castShadow = true; m.receiveShadow = true; wall.add(m); }
  root.add(wall);
}
