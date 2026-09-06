// Loads layout.json (single source of truth), validates counts, and derives everything the game needs:
// plot index, facing rules, road lookup, zone names. Colliders are registered by the world builders.
import { CONFIG } from '../config.js';
import { rectCenter, distToRect } from '../util/math.js';

export async function loadLayout() {
  const res = await fetch('/data/layout.json');
  if (!res.ok) throw new Error('layout.json missing');
  const L = await res.json();
  const exp = CONFIG.expectedCounts;
  const got = { farms: L.farms.length, villas: L.villas.length, townhouses: L.townhouses.length, commercial: L.commercial.length, parks: L.parks.length };
  const bad = Object.keys(exp).filter((k) => exp[k] !== got[k]);
  if (bad.length) throw new Error(`layout.json count mismatch: ${bad.map((k) => `${k} ${got[k]} (expected ${exp[k]})`).join(', ')}`);
  console.log('[layout] counts ok', got, 'generated', L.meta.generated);
  return derive(L);
}

// layout.json extracted the centre-column 10 m / 15 m roads as 900 m strips that start inside the neighbouring
// column, so they overlap the 25 m roads and each other. Clip every residential road at the major roads it
// crosses and drop segments that duplicate another road.
function cleanRoads(raw) {
  const all = raw.map((r) => ({ ...r, horizontal: r.w >= r.h }));
  const majors = all.filter((r) => r.kind === '25m' || r.kind === 'spine');
  const out = [];
  for (const r of all) {
    if (r.kind === '25m' || r.kind === 'spine') { out.push(r); continue; }
    let segs = [{ ...r }];
    for (const m of majors) {
      if (m.horizontal === r.horizontal) continue;
      const next = [];
      for (const sgm of segs) {
        if (r.horizontal) {
          const o0 = Math.max(sgm.x, m.x), o1 = Math.min(sgm.x + sgm.w, m.x + m.w);
          if (o1 - o0 <= 0.5 || sgm.y + sgm.h <= m.y || sgm.y >= m.y + m.h) { next.push(sgm); continue; }
          if (o0 - sgm.x > 20) next.push({ ...sgm, w: o0 - sgm.x });
          if (sgm.x + sgm.w - o1 > 20) next.push({ ...sgm, x: o1, w: sgm.x + sgm.w - o1 });
        } else {
          const o0 = Math.max(sgm.y, m.y), o1 = Math.min(sgm.y + sgm.h, m.y + m.h);
          if (o1 - o0 <= 0.5 || sgm.x + sgm.w <= m.x || sgm.x >= m.x + m.w) { next.push(sgm); continue; }
          if (o0 - sgm.y > 20) next.push({ ...sgm, h: o0 - sgm.y });
          if (sgm.y + sgm.h - o1 > 20) next.push({ ...sgm, y: o1, h: sgm.y + sgm.h - o1 });
        }
      }
      segs = next;
    }
    segs.forEach((sgm, i) => out.push({ ...sgm, id: segs.length > 1 ? `${r.id}-${i + 1}` : r.id }));
  }
  // Drop segments that duplicate an earlier one (same axis, overlapping by more than 5 m along it).
  const kept = [];
  for (const r of out) {
    const dup = kept.some((k) => k.horizontal === r.horizontal && k.kind !== '25m' && k.kind !== 'spine' && r.kind !== '25m' && r.kind !== 'spine' &&
      (r.horizontal ? Math.abs(k.y - r.y) < 3 && Math.min(k.x + k.w, r.x + r.w) - Math.max(k.x, r.x) > 5 : Math.abs(k.x - r.x) < 3 && Math.min(k.y + k.h, r.y + r.h) - Math.max(k.y, r.y) > 5));
    if (!dup) kept.push(r);
  }
  console.log(`[layout] roads: ${raw.length} raw -> ${out.length} segments after clipping at major roads -> ${kept.length} after dropping ${out.length - kept.length} duplicates`);
  return kept;
}

function derive(L) {
  const roads = cleanRoads(L.roads);
  const plots = [];
  const addPlot = (p) => { plots.push(p); return p; };

  // Facing: farms carry a measured facing; the rest face the nearest road of their own street type.
  const nearestRoad = (cx, cy, filter) => {
    let best = null, bd = Infinity;
    for (const r of roads) {
      if (filter && !filter(r)) continue;
      const d = distToRect(cx, cy, r);
      if (d < bd) { bd = d; best = r; }
    }
    return { road: best, dist: bd };
  };
  const facingToRoad = (rect, road) => {
    const c = rectCenter(rect);
    const rc = rectCenter(road);
    if (road.horizontal) return rc.y < c.y ? 'N' : 'S';
    return rc.x < c.x ? 'W' : 'E';
  };

  for (const f of L.farms) addPlot({ ...f, type: 'farm', kind: 'Farm plot', cx: f.x + f.w / 2, cy: f.y + f.h / 2, facing: f.facing || 'N' });
  for (const v of L.villas) {
    const c = rectCenter(v);
    const { road } = nearestRoad(c.x, c.y, (r) => r.kind === '20m' && r.horizontal);
    addPlot({ ...v, type: 'villa', kind: 'Premium villa', cx: c.x, cy: c.y, facing: road ? facingToRoad(v, road) : 'S', road });
  }
  for (const t of L.townhouses) {
    const c = rectCenter(t);
    const { road } = nearestRoad(c.x, c.y, (r) => r.kind === '10m' && r.horizontal);
    addPlot({ ...t, type: 'townhouse', kind: 'Town house', cx: c.x, cy: c.y, facing: road ? facingToRoad(t, road) : 'N', road });
  }
  for (const cm of L.commercial) {
    const c = rectCenter(cm);
    addPlot({ ...cm, type: 'commercial', kind: 'Commercial plot', cx: c.x, cy: c.y, facing: cm.side === 'W' ? 'E' : 'W' });
  }
  for (const p of L.parks) addPlot({ ...p, type: 'park', kind: 'Park', cx: p.x + p.w / 2, cy: p.y + p.h / 2 });
  for (const a of L.amenities) {
    if (a.id === 'lake-district' || a.id === 'track') continue;
    addPlot({ ...a, type: 'amenity', kind: a.name, cx: a.x + a.w / 2, cy: a.y + a.h / 2 });
  }
  addPlot({ id: 'lake', name: 'Lake', type: 'amenity', kind: 'Lake', x: L.lake.bbox.x, y: L.lake.bbox.y, w: L.lake.bbox.w, h: L.lake.bbox.h, areaHa: L.lake.areaHa, cx: L.lake.bbox.x + L.lake.bbox.w / 2, cy: L.lake.bbox.y + L.lake.bbox.h / 2 });

  // Neighbour maps for villa / townhouse pricing rules (corner = missing neighbour on a side along the row).
  const byId = new Map(plots.map((p) => [p.id, p]));
  const villaKey = new Map(L.villas.map((v) => [`${Math.round(v.x / 10)},${Math.round(v.y / 10)}`, v.id]));
  for (const v of L.villas) {
    const p = byId.get(v.id);
    const left = villaKey.has(`${Math.round((v.x - 30) / 10)},${Math.round(v.y / 10)}`);
    const right = villaKey.has(`${Math.round((v.x + 30) / 10)},${Math.round(v.y / 10)}`);
    p.corner = !(left && right);
    p.farmAdjacent = L.farms.some((f) => distToRect(p.cx, p.cy, f) < 70);
    p.linkedFarm = `farm-${v.n}`;
  }
  const thKey = new Map(L.townhouses.map((t) => [`${Math.round(t.x / 10)},${Math.round(t.y / 10)}`, t.id]));
  for (const t of L.townhouses) {
    const p = byId.get(t.id);
    const left = thKey.has(`${Math.round((t.x - 20) / 10)},${Math.round(t.y / 10)}`);
    const right = thKey.has(`${Math.round((t.x + 20) / 10)},${Math.round(t.y / 10)}`);
    p.corner = !(left && right);
  }
  for (const f of L.farms) { const p = byId.get(f.id); if (f.n <= 560) p.linkedVilla = `villa-${f.n}`; }

  // Plot spatial grid (100 m cells) for nearest-plot queries.
  const CELL = 100;
  const grid = new Map();
  for (const p of plots) {
    const x0 = Math.floor(p.x / CELL), x1 = Math.floor((p.x + p.w) / CELL), y0 = Math.floor(p.y / CELL), y1 = Math.floor((p.y + p.h) / CELL);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const k = gx * 1000 + gy; (grid.get(k) || grid.set(k, []).get(k)).push(p); }
  }
  const plotsNear = (x, y, radius) => {
    const out = [];
    const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL), y0 = Math.floor((y - radius) / CELL), y1 = Math.floor((y + radius) / CELL);
    const seen = new Set();
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const list = grid.get(gx * 1000 + gy); if (!list) continue;
      for (const p of list) { if (seen.has(p.id)) continue; seen.add(p.id); const d = distToRect(x, y, p); if (d <= radius) out.push({ plot: p, dist: d }); }
    }
    return out.sort((a, b) => a.dist - b.dist);
  };

  const zoneOf = (x, y) => {
    for (const p of L.parks) if (distToRect(x, y, p) === 0) return 'Parks';
    if (x < 937) return 'West farms';
    if (x > 2062) { if (y > 2035) return 'Lake district'; if (y > 1919) return 'Agro plant'; return 'East farms'; }
    if (y < 965) return 'North farms';
    if (y > 2020) { if (y < 2350 && x > 1560) return 'School & stadium'; return 'South farms'; }
    if (x >= 1420 && x <= 1580) return 'Commercial spine';
    if (y > 1780) return x < 1500 ? 'Town houses west' : 'Town houses east';
    return x < 1500 ? 'Centre-west villas' : 'Centre-east villas';
  };

  const onRoad = (x, y) => { for (const r of roads) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r; return null; };

  // Vehicle access points into fenced amenities: street trees, lamps and verge kerbs keep clear of these.
  const stadium = L.amenities.find((a) => a.id === 'stadium'), school = L.amenities.find((a) => a.id === 'school');
  const accessPoints = [];
  if (stadium) accessPoints.push({ x: stadium.x + stadium.w, z: stadium.y + stadium.h / 2, r: 9, name: 'stadium gate' });
  if (school) accessPoints.push({ x: 1514.9, z: school.y + school.h / 2, r: 8, name: 'school drive' });
  const nearAccess = (x, z) => accessPoints.some((a) => Math.hypot(a.x - x, a.z - z) < a.r);
  return { L, roads, plots, byId, plotsNear, zoneOf, onRoad, nearestRoad, lake: L.lake, parks: L.parks, amenities: L.amenities, site: L.site, accessPoints, nearAccess };
}

// Nearest road centreline point and heading (yaw, 0 = north/-Z, clockwise) for reset and teleport.
export function roadPlacement(world, x, y, prefer) {
  const { road } = world.nearestRoad(x, y);
  const r = road;
  let px, py, yaw;
  if (r.horizontal) {
    py = r.y + r.h / 2; px = Math.min(Math.max(x, r.x + 10), r.x + r.w - 10);
    if (r.kind === 'spine') py = r.y + r.h / 2; // spine is vertical, never here
    yaw = prefer !== undefined ? (Math.cos(prefer - Math.PI / 2) >= 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI / 2;
  } else {
    px = r.x + r.w / 2; py = Math.min(Math.max(y, r.y + 10), r.y + r.h - 10);
    if (r.kind === 'spine') px = x < r.x + r.w / 2 ? r.x + 7.5 : r.x + r.w - 7.5; // carriageway centre either side of the median (3 m verge + 8 m lane)
    yaw = prefer !== undefined ? (Math.cos(prefer) >= 0 ? 0 : Math.PI) : 0;
  }
  return { x: px, y: py, yaw, road: r };
}
