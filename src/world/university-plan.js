// Designed expansion, separate from the measured CAD layout. Coordinates are metres.
export const CAMPUS_BOUNDS = { minX: -720, minZ: -720, maxX: 3720, maxZ: 3720 };
export const CAMPUS_SPAWN = { x: 1370, z: 3490, yaw: Math.PI };
export function campusPoint(p, x, z) {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return { x: p.x + x * c + z * s, z: p.z - x * s + z * c };
}
export function projectPath(path, x, z) {
  let best = { dist: Infinity };
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1], b = path.points[i], dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / d2));
    const px = a.x + dx * t, pz = a.z + dz * t, dist = Math.hypot(x - px, z - pz);
    if (dist < best.dist) best = { x: px, z: pz, yaw: Math.atan2(dx, -dz), dist, segment: i - 1, t };
  }
  return best;
}
export function pathSamples(path, spacing) {
  const out = []; let walked = 0, next = 0;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1], b = path.points[i], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    while (next < walked + len - 0.001) { const t = (next - walked) / len; out.push({ x: a.x + dx * t, z: a.z + dz * t, nx: -dz / len, nz: dx / len, dx: dx / len, dz: dz / len, at: next }); next += spacing; }
    walked += len;
  }
  return out;
}
export function createCampusPlan() {
  const roads = [], precincts = [];
  const road = (id, points, width = 12, extra = {}) => { const p = { id, points: points.map(([x, z]) => ({ x, z })), width, kind: 'university', ...extra }; roads.push(p); return p; };
  const ring = []; const R = 120, lo = -420, hi = 3420;
  for (const [cx, cz, a0] of [[lo + R, lo + R, Math.PI], [hi - R, lo + R, 1.5 * Math.PI], [hi - R, hi - R, 0], [lo + R, hi - R, Math.PI / 2]]) {
    for (let i = 0; i <= 24; i++) { const a = a0 + i * Math.PI / 48; ring.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); }
  }
  ring.push(ring[0]);
  road('university-loop', ring, 18, { loop: true, name: 'University Loop' });
  road('university-entrance', [[2160, 3690], [2160, 3060]], 18);
  road('village-link', [[1500, 3060], [2160, 3060]], 12);
  // Existing airstrip access road meets this junction. No campus road crosses the runway or apron.
  road('gate-link', [[1500, 3003], [1500, 3090]], 12);
  const add = (name, x, z, rot, kind = 'college') => {
    const p = { id: `university-${precincts.length + 1}`, name, x, z, rot, kind };
    const front = campusPoint(p, 0, 14), end = campusPoint(p, 0, 190);
    p.road = road(`${p.id}-drive`, [[front.x, front.z], [end.x, end.z]], 12, { drive: true });
    p.entry = end; precincts.push(p); return p;
  };
  ['College of Sciences', 'College of Engineering', 'Great Library', 'Arts & Humanities', 'School of Architecture'].forEach((n, i) => add(n, 160 + i * 650, -230, Math.PI, i === 2 ? 'library' : 'college'));
  ['Founders College', 'Scholars Residence', 'Graduate College', 'West Commons'].forEach((n, i) => add(n, -230, 250 + i * 780, -Math.PI / 2, i === 1 || i === 2 ? 'residence' : 'college'));
  ['East Residence', 'Research Institute', 'School of Medicine', 'Sports Pavilion'].forEach((n, i) => add(n, 3230, 250 + i * 780, Math.PI / 2, i === 0 ? 'residence' : i === 3 ? 'hall' : 'college'));
  ['Agricultural College', 'Aviation Academy', 'Convocation Hall', 'Administration', 'Student Union'].forEach((n, i) => add(n, [130, 750, 1370, 1870, 2670][i], 3610, Math.PI, i === 2 || i === 4 ? 'hall' : 'college'));
  road('sports-drive', [[3420, 1950], [3497, 1950]], 12);
  const sports = { x: 3510, z: 1870, w: 100, h: 160 };
  const plan = { bounds: CAMPUS_BOUNDS, spawn: CAMPUS_SPAWN, roads, precincts, sports,
    // Physical airstrip + lateral approach corridor. Trees, buildings and lamp posts avoid it.
    airfield: { x0: 700, x1: 1580, z0: 3075, z1: 3285 },
    approach: { x0: -720, x1: 3720, z0: 3100, z1: 3260 },
  };
  return plan;
}
export function inAirfield(plan, x, z, margin = 0) {
  return [plan.airfield, plan.approach].some(r => x >= r.x0 - margin && x <= r.x1 + margin && z >= r.z0 - margin && z <= r.z1 + margin);
}
export function nearestCampusRoad(plan, x, z) {
  let best = null;
  for (const road of plan.roads) { const q = projectPath(road, x, z); const dist = Math.max(0, q.dist - road.width / 2); if (!best || dist < best.dist) best = { road, dist, projection: q }; }
  return best;
}
// Add navigation after the measured world has been built; never mutate CAD roads or plot counts.
export function registerCampus(world, plan) {
  world.campus = plan;
  const oldNearest = world.nearestRoad, oldOnRoad = world.onRoad, oldZone = world.zoneOf;
  world.nearestRoad = (x, z, filter) => {
    const village = oldNearest(x, z, filter); if (filter) return village;
    const campus = nearestCampusRoad(plan, x, z); return campus.dist < village.dist ? campus : village;
  };
  world.onRoad = (x, z) => { const v = oldOnRoad(x, z); if (v || (x >= 0 && x <= 3000 && z >= 0 && z <= 3000)) return v; const c = nearestCampusRoad(plan, x, z); return c.dist < 0.01 ? c.road : null; };
  world.zoneOf = (x, z) => {
    if (x >= 0 && z >= 0 && x <= 3000 && z <= 3000) return oldZone(x, z);
    if (x >= 770 && x <= 1545 && z >= 3090 && z <= 3265) return 'GVP Airstrip';
    const p = plan.precincts.find(p => Math.hypot(x - p.x, z - p.z) < 140);
    if (p) return p.name;
    return z < 0 ? 'University · North Quadrangles' : x < 0 ? 'University · West Colleges' : x > 3000 ? 'University · East Campus' : 'University · South Campus';
  };
}
