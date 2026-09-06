import * as THREE from 'three';
import { patchGeo, box, cyl, ico, merge, stdMat } from './geo.js';

function ellipseBand(cx, cz, rx0, rz0, rx1, rz1, y0, y1, color, seg = 64) {
  const pos = [], col = [], idx = []; const c = new THREE.Color(color);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pos.push(cx + Math.cos(a) * rx0, y0, cz + Math.sin(a) * rz0); pos.push(cx + Math.cos(a) * rx1, y1, cz + Math.sin(a) * rz1);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const uv = new Float32Array((seg + 1) * 4); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}

export function buildAmenities(ctx) {
  const { scene, world, T, colliders } = ctx;
  const A = Object.fromEntries(world.amenities.map((a) => [a.id, a]));
  const plaster = [], stone = [], sand = [], metal = [], dark = [], lawnPaths = [], track = [];
  const glow = []; // warm-white temple lighting: cove strips, uplight bars and spire glows (emissive at night)
  const glass = [];
  const solid = (x0, z0, x1, z1, tag, ref) => colliders.add(x0, z0, x1, z1, tag || 'amenity', ref);
  const plotOf = (id) => world.byId.get(id);

  const ring = (list, cx, cz, hw, y, col = 0xffe6c0, t = 0.16) => { list.push(box(hw * 2 + 0.6, 0.12, t, col, { x: cx, z: cz - hw - 0.15, y })); list.push(box(hw * 2 + 0.6, 0.12, t, col, { x: cx, z: cz + hw + 0.15, y })); list.push(box(t, 0.12, hw * 2 + 0.6, col, { x: cx - hw - 0.15, z: cz, y })); list.push(box(t, 0.12, hw * 2 + 0.6, col, { x: cx + hw + 0.15, z: cz, y })); };
  // Temple: stepped plinth with balustrades, a pillared mandapa hall and a seven-tier gopuram with
  // miniature shrines, kudu arches, corner finials, a barrel-vault crown and gold kalasha spires.
  { const a = A.temple; const cx = a.x + a.w / 2, cz = a.y + a.h / 2;
    const SAND = 0xd9c09a, SAND2 = 0xc9a875, CORN = 0xb99a6a, NICHE = 0x6b5236, GOLD = 0xc9a227, ROOF = 0xe6d5b3;
    lawnPaths.push(patchGeo(cx - 4, a.y, 8, a.h, 3, 0.05)); lawnPaths.push(patchGeo(a.x, cz - 4, a.w, 8, 3, 0.05));
    lawnPaths.push(patchGeo(cx - 36, cz - 36, 72, 72, 3, 0.05));
    // Plinth: three steps and a balustrade with gaps at the four paths.
    for (let i = 0; i < 3; i++) { const w = 70 - i * 4; sand.push(box(w, 0.5, w, i === 2 ? SAND : SAND2, { x: cx, z: cz, y: 0.25 + i * 0.5 })); ring(glow, cx, cz, w / 2, 0.45 + i * 0.5); }
    for (const [sx, sz, w, d] of [[0, -30.6, 62, 0.4], [0, 30.6, 62, 0.4], [-30.6, 0, 0.4, 62], [30.6, 0, 0.4, 62]]) {
      if (w > d) { sand.push(box(26, 0.9, d, CORN, { x: cx - 18, z: cz + sz, y: 1.95 })); sand.push(box(26, 0.9, d, CORN, { x: cx + 18, z: cz + sz, y: 1.95 })); }
      else { sand.push(box(w, 0.9, 26, CORN, { x: cx + sx, z: cz - 18, y: 1.95 })); sand.push(box(w, 0.9, 26, CORN, { x: cx + sx, z: cz + 18, y: 1.95 })); }
    }
    for (const [sx, sz] of [[-31, -31], [31, -31], [-31, 31], [31, 31], [-5, -31], [5, -31], [-5, 31], [5, 31], [-31, -5], [-31, 5], [31, -5], [31, 5]]) sand.push(box(1.2, 2.2, 1.2, SAND2, { x: cx + sx, z: cz + sz, y: 2.6 }));
    // Mandapa hall (south of the tower): 5 x 5 fluted columns, bracket capitals, roof slab with cornice and kudu parapet.
    const mz = cz + 18, base = 1.5;
    sand.push(box(32, 0.6, 32, SAND2, { x: cx, z: mz, y: base + 0.3 }));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const x = cx - 12 + i * 6, z = mz - 12 + j * 6;
      sand.push(box(1.3, 0.5, 1.3, CORN, { x, z, y: base + 0.85 })); sand.push(cyl(0.55, 0.62, 5.6, 12, SAND, { x, z, y: base + 1.1 + 2.8 }));
      glow.push(box(1.5, 0.08, 1.5, 0xffe6c0, { x, z, y: base + 1.12 })); // uplight ring at every column foot
      sand.push(box(1.5, 0.45, 1.5, CORN, { x, z, y: base + 6.9 + 0.22 })); sand.push(box(2.1, 0.3, 2.1, SAND2, { x, z, y: base + 7.35 + 0.15 }));
    }
    sand.push(box(33, 0.9, 33, SAND, { x: cx, z: mz, y: base + 7.5 + 0.45 })); sand.push(box(34.4, 0.45, 34.4, CORN, { x: cx, z: mz, y: base + 8.4 + 0.22 }));
    ring(glow, cx, mz, 16.6, base + 7.45); ring(glow, cx, mz, 17.3, base + 8.8);
    for (let t = -15; t <= 15; t += 3) { for (const [x, z] of [[cx + t, mz - 16.6], [cx + t, mz + 16.6], [cx - 16.6, mz + t], [cx + 16.6, mz + t]]) { const k = cyl(0.55, 0.55, 0.9, 10, ROOF, { x, z, y: base + 8.65 + 0.45 }); k.rotateZ(0); sand.push(k); } }
    sand.push(box(34, 0.7, 0.4, ROOF, { x: cx, z: mz - 16.8, y: base + 9 })); sand.push(box(34, 0.7, 0.4, ROOF, { x: cx, z: mz + 16.8, y: base + 9 })); sand.push(box(0.4, 0.7, 34, ROOF, { x: cx - 16.8, z: mz, y: base + 9 })); sand.push(box(0.4, 0.7, 34, ROOF, { x: cx + 16.8, z: mz, y: base + 9 }));
    // Gopuram tower.
    const tz = cz - 8; let y = base;
    sand.push(box(31, 0.8, 31, SAND2, { x: cx, z: tz, y: y + 0.4 })); ring(glow, cx, tz, 15.5, y + 0.75); y += 0.8;
    sand.push(box(30, 9, 30, SAND, { x: cx, z: tz, y: y + 4.5 }));
    for (let t = -13.5; t <= 13.5; t += 3) for (const [x, z, w, d] of [[cx + t, tz - 15.05, 0.7, 0.5], [cx + t, tz + 15.05, 0.7, 0.5], [cx - 15.05, tz + t, 0.5, 0.7], [cx + 15.05, tz + t, 0.5, 0.7]]) { sand.push(box(w, 9, d, SAND2, { x, z, y: y + 4.5 })); }
    for (let t = -12; t <= 12; t += 3) for (const [x, z, w, d] of [[cx + t, tz - 14.9, 1.4, 0.4], [cx + t, tz + 14.9, 1.4, 0.4], [cx - 14.9, tz + t, 0.4, 1.4], [cx + 14.9, tz + t, 0.4, 1.4]]) { dark.push(box(w, 3.2, d, NICHE, { x, z, y: y + 3.2 })); dark.push(box(w, 3.2, d, NICHE, { x, z, y: y + 7 })); }
    dark.push(box(3, 5.5, 0.6, NICHE, { x: cx, z: tz + 15.1, y: y + 2.75 })); // main entrance
    sand.push(box(31.4, 0.6, 31.4, CORN, { x: cx, z: tz, y: y + 9.3 })); ring(glow, cx, tz, 15.7, y + 9.0); y += 9.6;
    const tiers = 7;
    for (let i = 0; i < tiers; i++) {
      const w = 26 - i * 3.1, h = 4.0; const col = new THREE.Color(SAND).lerp(new THREE.Color(SAND2), i / tiers).getHex();
      sand.push(box(w + 1.4, 0.5, w + 1.4, CORN, { x: cx, z: tz, y: y + 0.25 }));
      sand.push(box(w, h - 0.9, w, col, { x: cx, z: tz, y: y + 0.5 + (h - 0.9) / 2 }));
      ring(glow, cx, tz, w / 2 + 0.7, y + 0.52); // warm-white cove on every tier
      // Miniature shrines along each edge and kudu arches on the cornice.
      const n = Math.max(2, Math.floor(w / 2.8));
      for (let k = 0; k < n; k++) { const t = -w / 2 + 1.2 + (k * (w - 2.4)) / (n - 1);
        for (const [x, z, rw, rd] of [[cx + t, tz - w / 2 - 0.35, 1.3, 0.9], [cx + t, tz + w / 2 + 0.35, 1.3, 0.9], [cx - w / 2 - 0.35, tz + t, 0.9, 1.3], [cx + w / 2 + 0.35, tz + t, 0.9, 1.3]]) {
          sand.push(box(rw, 1.6, rd, ROOF, { x, z, y: y + 0.5 + 0.8 })); dark.push(box(rw * 0.5, 0.9, rd * 0.5, NICHE, { x, z, y: y + 0.5 + 0.7 }));
          const kd = cyl(0.5, 0.5, 0.5, 10, ROOF, { x, z, y: y + 0.5 + 1.75 }); if (rw > rd) kd.rotateX(0); sand.push(kd);
        } }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sand.push(cyl(0, 0.7, 1.6, 8, GOLD, { x: cx + sx * (w / 2 + 0.4), z: tz + sz * (w / 2 + 0.4), y: y + h - 0.2 }));
      y += h;
    }
    // Barrel-vault crown and kalasha spires.
    const cw = 26 - tiers * 3.1 + 2;
    const vault = cyl(2.6, 2.6, cw, 16, ROOF, { y: 0 }); vault.rotateZ(Math.PI / 2); vault.translate(cx, y + 0.9, tz); sand.push(vault);
    sand.push(box(cw + 0.6, 0.9, 5.4, CORN, { x: cx, z: tz, y: y + 0.45 }));
    for (let i = -2; i <= 2; i++) { const x = cx + i * (cw / 5); sand.push(cyl(0.35, 0.55, 1.4, 10, GOLD, { x, z: tz, y: y + 3.5 + 0.7 })); glow.push(ico(0.62, 1, 0xffd88a, { x, y: y + 5.3, z: tz })); glow.push(cyl(0, 0.32, 1.25, 8, 0xffd88a, { x, z: tz, y: y + 6.4 })); }
    ring(glow, cx, tz, cw / 2 + 0.3, y + 0.9);
    // Dwarf columns at the plinth corners, lamp bowls on the entrance path.
    for (const [sx, sz] of [[-33, -33], [33, -33], [-33, 33], [33, 33]]) sand.push(cyl(0.45, 0.55, 4, 10, SAND2, { x: cx + sx, z: cz + sz, y: 2.5 + 2 }));
    solid(cx - 35, cz - 35, cx + 35, cz + 35, 'amenity', plotOf('temple'));
  }
  // School: U-shaped two-storey block around a courtyard, playfield east, boundary wall.
  { const a = A.school; const p = plotOf('school');
    const bx = a.x + 12, bz = a.y + 12;
    const blocks = [[bx, bz, 130, 14], [bx, bz, 14, 150], [bx, bz + 136, 130, 14]];
    for (const [x, z, w, d] of blocks) {
      plaster.push(box(w, 8, d, 0xf4ead8, { x: x + w / 2, z: z + d / 2, y: 4.2 })); plaster.push(box(w + 0.6, 0.35, d + 0.6, 0xe0d6c4, { x: x + w / 2, z: z + d / 2, y: 4.4 }));
      plaster.push(box(w + 0.6, 0.4, d + 0.6, 0xe0d6c4, { x: x + w / 2, z: z + d / 2, y: 8.4 }));
      const along = w > d;
      for (let t = 4; t < (along ? w : d) - 3; t += 5) for (const h of [2.2, 6.2]) {
        if (along) { glass.push(box(2.6, 1.8, 0.1, 0x223447, { x: x + t, z: z + d + 0.05, y: h })); glass.push(box(2.6, 1.8, 0.1, 0x223447, { x: x + t, z: z - 0.05, y: h })); }
        else { glass.push(box(0.1, 1.8, 2.6, 0x223447, { x: x + w + 0.05, z: z + t, y: h })); glass.push(box(0.1, 1.8, 2.6, 0x223447, { x: x - 0.05, z: z + t, y: h })); }
      }
      solid(x, z, x + w, z + d, 'amenity', p);
    }
    for (let x = bx + 20; x < bx + 130; x += 6) plaster.push(cyl(0.3, 0.3, 4, 8, 0xf4ead8, { x, z: bz + 16, y: 2 }));
    plaster.push(box(114, 0.3, 4, 0xe0d6c4, { x: bx + 75, z: bz + 16, y: 4.1 }));
    plaster.push(box(a.w, 1.2, 0.3, 0xe0d6c4, { x: a.x + a.w / 2, z: a.y, y: 0.6 })); plaster.push(box(a.w, 1.2, 0.3, 0xe0d6c4, { x: a.x + a.w / 2, z: a.y + a.h, y: 0.6 }));
    plaster.push(box(0.3, 1.2, a.h, 0xe0d6c4, { x: a.x + a.w, z: a.y + a.h / 2, y: 0.6 }));
    // Playfield lines
    const fx = a.x + a.w * 0.6, fz = a.y + 30; track.push(patchGeo(fx, fz, 90, 0.4, 1, 0.05)); track.push(patchGeo(fx, fz + 120, 90, 0.4, 1, 0.05)); track.push(patchGeo(fx, fz, 0.4, 120, 1, 0.05)); track.push(patchGeo(fx + 90, fz, 0.4, 120, 1, 0.05));
    // Flag pole
    metal.push(cyl(0.1, 0.12, 14, 8, 0xdddddd, { x: bx + 75, z: bz + 40, y: 7 }));
  }
  // Stadium: twelve stepped seat rows in two tiers, a walkway, back wall, cantilevered roof canopy,
  // four floodlight masts with lamp arrays, eight-lane track, marked pitch with goals, corner entrance gates.
  { const a = A.stadium; const p = plotOf('stadium'); const cx = a.x + a.w / 2, cz = a.y + a.h / 2;
    // The bowl (track + 12 seat rows + walkway + back wall ~ 18 m) must stay inside the 200 x 210 m lot with a 6 m margin.
    const rx = a.w / 2 - 24, rz = a.h / 2 - 24;
    track.push(patchGeo(a.x + 6, a.y + 6, a.w - 12, a.h - 12, 4, 0.04));
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1, 48), stdMat(T, T.lawn)); inner.scale.set(rx - 11, rz - 11, 1); inner.rotation.x = -Math.PI / 2; inner.position.set(cx, 0.06, cz); inner.receiveShadow = true; scene.add(inner);
    const bandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    const addBand = (r0, r1, y0, y1, col, seg = 72) => { const m = new THREE.Mesh(ellipseBand(cx, cz, rx + r0, rz + r0, rx + r1, rz + r1, y0, y1, col, seg), bandMat); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
    // Lane lines (8 lanes) and a start line.
    for (let i = 0; i <= 8; i++) addBand(-10.4 + i * 1.2, -10.3 + i * 1.2, 0.055, 0.055, 0xf4f4ee, 96);
    // Seat rows: tier 1 (6 steps), walkway, tier 2 (6 steps).
    let r = 0, y = 0.3;
    addBand(-0.4, 0, 0, y, 0x9aa3ad);
    const seatCols = [0x2c5f9e, 0xd9dde2, 0x2c5f9e, 0xc9a227];
    for (let i = 0; i < 12; i++) {
      if (i === 6) { addBand(r, r + 3, y, y, 0x8f979f); r += 3; }
      addBand(r, r + 1.15, y, y, seatCols[i % seatCols.length]); r += 1.15;
      addBand(r, r, y, y + 0.55, 0x7d858e); y += 0.55;
    }
    addBand(r, r + 1.2, y, y, 0x8f979f); r += 1.2;
    addBand(r, r + 0.5, y, y + 2.6, 0x8f979f); addBand(r + 0.5, r + 0.5, 0, y + 2.6, 0xd9d5cc); // back wall (light concrete outside)
    const yTop = y + 2.6;
    // Roof canopy: sloped band from the back wall out over the seats, with a fascia and support columns.
    addBand(r + 1.2, 2.5, yTop + 3.2, yTop + 1.4, 0xe9ecef);
    addBand(2.5, 2.5, yTop + 1.4, yTop + 0.7, 0xc9a227);
    addBand(r + 0.9, r + 1.2, yTop, yTop + 3.4, 0x5d6775);
    for (let i = 0; i < 24; i++) { const ang = (i / 24) * Math.PI * 2; const x = cx + Math.cos(ang) * (rx + r + 1.0), z = cz + Math.sin(ang) * (rz + r + 1.0); metal.push(cyl(0.3, 0.35, yTop + 3.2, 8, 0x8b949e, { x, z, y: (yTop + 3.2) / 2 })); }
    for (let i = 0; i < 16; i++) { const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2; const xs = [], zs = []; for (const ang of [a0, (a0 + a1) / 2, a1]) for (const rr of [-0.4, r + 1.4]) { xs.push(cx + Math.cos(ang) * (rx + rr)); zs.push(cz + Math.sin(ang) * (rz + rr)); } solid(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), 'amenity', p); }
    // Pitch markings: centre circle, halfway line, penalty boxes, goals.
    const pitchW = (rx - 14) * 2, pitchH = (rz - 16) * 2;
    track.push(patchGeo(cx - pitchW / 2, cz - pitchH / 2, pitchW, 0.15, 1, 0.065)); track.push(patchGeo(cx - pitchW / 2, cz + pitchH / 2, pitchW, 0.15, 1, 0.065));
    track.push(patchGeo(cx - pitchW / 2, cz - pitchH / 2, 0.15, pitchH, 1, 0.065)); track.push(patchGeo(cx + pitchW / 2, cz - pitchH / 2, 0.15, pitchH, 1, 0.065)); track.push(patchGeo(cx - 0.075, cz - pitchH / 2, 0.15, pitchH, 1, 0.065));
    for (const s of [-1, 1]) { const bx = s < 0 ? cx - pitchW / 2 : cx + pitchW / 2 - 16.5; track.push(patchGeo(bx, cz - 20, 16.5, 0.15, 1, 0.065)); track.push(patchGeo(bx, cz + 20, 16.5, 0.15, 1, 0.065)); track.push(patchGeo(s < 0 ? bx + 16.5 : bx, cz - 20, 0.15, 40, 1, 0.065));
      const gx = s < 0 ? cx - pitchW / 2 : cx + pitchW / 2; metal.push(cyl(0.08, 0.08, 2.44, 6, 0xf4f4f4, { x: gx, z: cz - 3.66, y: 1.22 })); metal.push(cyl(0.08, 0.08, 2.44, 6, 0xf4f4f4, { x: gx, z: cz + 3.66, y: 1.22 })); metal.push(box(0.16, 0.16, 7.32, 0xf4f4f4, { x: gx, z: cz, y: 2.44 })); solid(gx - 0.3, cz - 3.8, gx + 0.3, cz + 3.8, 'amenity', p); }
    const circle = new THREE.Mesh(new THREE.RingGeometry(9.0, 9.15, 48), new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.8 })); circle.rotation.x = -Math.PI / 2; circle.position.set(cx, 0.066, cz); scene.add(circle);
    // Floodlight masts with 4 x 4 lamp arrays (share the street-lamp emissive so they light up at night).
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = cx + sx * (rx + 30), z = cz + sz * (rz + 22);
      metal.push(cyl(0.5, 0.9, 40, 8, 0xbfc4cc, { x, z, y: 20 })); metal.push(box(1.6, 1.6, 1.6, 0x8b949e, { x, z, y: 40.2 }));
      const yaw = Math.atan2(cx - x, cz - z);
      const frame = box(7, 4.2, 0.5, 0x3a4048, { y: 42.5 }); frame.rotateY(yaw); frame.translate(x, 0, z); dark.push(frame);
      const lamps = new THREE.Group(); lamps.position.set(x, 42.5, z); lamps.rotation.y = yaw;
      const lampGeo = new THREE.BoxGeometry(1.3, 0.8, 0.25);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const m = new THREE.Mesh(lampGeo, ctx.lampHeadMat || new THREE.MeshStandardMaterial({ color: 0xfff6dd })); m.position.set(-2.4 + i * 1.6, -1.5 + j * 1.0, 0.35); lamps.add(m); }
      scene.add(lamps);
      solid(x - 1, z - 1, x + 1, z + 1, 'amenity', p);
    }
    // Corner entrance gates with stairs.
    // Entrance gates sit in the four corners of the 200 x 210 m lot (outside the stand ellipse, inside the boundary).
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = cx + sx * (a.w / 2 - 9), z = cz + sz * (a.h / 2 - 9);
      plaster.push(box(10, 7, 6, 0xf1eee8, { x, z, y: 3.5 })); dark.push(box(4, 4, 0.4, 0x3a4048, { x, z: z + sz * 3.1, y: 2 })); plaster.push(box(10.6, 0.5, 6.6, 0xc9a227, { x, z, y: 7.2 }));
      for (let s = 0; s < 4; s++) plaster.push(box(6, 0.25, 1, 0xd9d5cc, { x, z: z + sz * (3.6 + s), y: 0.125 + (3 - s) * 0.25 }));
      solid(x - 5, z - 3, x + 5, z + 3, 'amenity', p);
    }
  }
  // Agro plant: sheds, silos, fence.
  { const a = A.agro; const p = plotOf('agro');
    for (let i = 0; i < 5; i++) { const x = a.x + 60 + i * 170, z = a.y + 15, w = 110, d = 34; metal.push(box(w, 11, d, 0xd9dde3, { x: x + w / 2, z: z + d / 2, y: 5.5 })); metal.push(box(w + 1, 1.2, d + 1, 0x8e969f, { x: x + w / 2, z: z + d / 2, y: 11.3 })); dark.push(box(8, 7, 0.3, 0x3a4048, { x: x + w / 2, z: z + d + 0.1, y: 3.5 })); solid(x, z, x + w, z + d, 'amenity', p); }
    for (let i = 0; i < 8; i++) { const x = a.x + 90 + i * 24, z = a.y + 75; metal.push(cyl(5, 5, 20, 20, 0xcfd6dd, { x, z, y: 10 })); metal.push(cyl(0.5, 5.2, 3.5, 20, 0xaab2bb, { x, z, y: 21.7 })); solid(x - 5.2, z - 5.2, x + 5.2, z + 5.2, 'amenity', p); }
    metal.push(box(a.w, 1.8, 0.15, 0x8e969f, { x: a.x + a.w / 2, z: a.y + 1, y: 0.9 })); metal.push(box(a.w, 1.8, 0.15, 0x8e969f, { x: a.x + a.w / 2, z: a.y + a.h - 1, y: 0.9 }));
    metal.push(cyl(0.3, 0.4, 30, 8, 0xd8dce2, { x: a.x + 40, z: a.y + 50, y: 15 }));
  }
  // Parking: bay markings.
  { const a = A.parking; for (let z = a.y + 10; z < a.y + a.h - 10; z += 6) { track.push(patchGeo(a.x + 8, z, 40, 0.3, 1, 0.05)); track.push(patchGeo(a.x + a.w - 48, z, 40, 0.3, 1, 0.05)); } track.push(patchGeo(a.x + 8, a.y + 10, 0.3, a.h - 20, 1, 0.05)); track.push(patchGeo(a.x + a.w - 8, a.y + 10, 0.3, a.h - 20, 1, 0.05)); }
  // Fire station: red-and-white with three roller doors and a drill tower.
  { const a = A.fire; const f = A['fire-station']; const p = plotOf('fire-station'); const x = f.x + 20, z = f.y + 12, w = 60, d = 30;
    plaster.push(box(w, 8, d, 0xf1eee8, { x: x + w / 2, z: z + d / 2, y: 4 })); plaster.push(box(w + 0.4, 2.2, d + 0.4, 0xc0392b, { x: x + w / 2, z: z + d / 2, y: 7 }));
    for (let i = 0; i < 3; i++) dark.push(box(9, 5.5, 0.4, 0x4b5058, { x: x + 10 + i * 18, z: z + d + 0.1, y: 2.75 }));
    plaster.push(box(8, 20, 8, 0xc0392b, { x: x + w + 8, z: z + 8, y: 10 }));
    solid(x, z, x + w, z + d, 'amenity', p); solid(x + w + 4, z + 4, x + w + 12, z + 12, 'amenity', p);
  }
  // Water treatment: four round tanks, control building and a water tower landmark.
  { const a = A.wtp; const p = plotOf('wtp');
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const x = a.x + 50 + i * 70, z = a.y + 55 + j * 70; metal.push(cyl(22, 22, 5, 32, 0xb8c2cc, { x, z, y: 2.5 })); const wg = new THREE.CircleGeometry(21, 32); wg.rotateX(-Math.PI / 2); wg.translate(x, 5.05, z); metal.push(wg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(wg.attributes.position.count * 3).fill(0.3), 3)) && wg); solid(x - 22, z - 22, x + 22, z + 22, 'amenity', p); }
    plaster.push(box(30, 5, 16, 0xf1eee8, { x: a.x + 30, z: a.y + a.h - 20, y: 2.5 })); solid(a.x + 15, a.y + a.h - 28, a.x + 45, a.y + a.h - 12, 'amenity', p);
    const tx = a.x + a.w - 25, tz = a.y + 25; metal.push(cyl(1.2, 1.6, 34, 10, 0xcfd6dd, { x: tx, z: tz, y: 17 })); metal.push(cyl(9, 7, 10, 20, 0xe4e8ec, { x: tx, z: tz, y: 39 })); metal.push(cyl(0, 9, 3, 20, 0xc9a227, { x: tx, z: tz, y: 45.5 })); solid(tx - 2, tz - 2, tx + 2, tz + 2, 'amenity', p);
  }
  // Parks: pavilions and paths.
  for (const pk of world.parks) {
    const p = plotOf(pk.id);
    lawnPaths.push(patchGeo(pk.x, pk.y + pk.h / 2 - 2, pk.w, 4, 3, 0.05));
    for (let i = 0; i < 4; i++) {
      const x = pk.x + pk.w * (0.2 + i * 0.2), z = pk.y + pk.h / 2;
      lawnPaths.push(patchGeo(x - 2, pk.y, 4, pk.h, 3, 0.05));
      const px = x, pz = z + (i % 2 ? 28 : -28);
      for (const sx of [-3, 3]) for (const sz of [-3, 3]) stone.push(cyl(0.3, 0.3, 4, 8, 0xf2ede4, { x: px + sx, z: pz + sz, y: 2 }));
      stone.push(box(8.5, 0.4, 8.5, 0xc9a227, { x: px, z: pz, y: 4.2 })); stone.push(box(9, 0.15, 9, 0xe8e2d6, { x: px, z: pz, y: 0.08 }));
      solid(px - 3.5, pz - 3.5, px + 3.5, pz + 3.5, 'amenity', p);
    }
  }
  // Joggers' track: rectangular ring 10 m outside the lake water, 6 m wide.
  { const lk = world.lake.bbox; const o = 12, w = 6;
    track.push(patchGeo(lk.x - o - w, lk.y - o - w, lk.w + 2 * (o + w), w, 3, 0.05)); track.push(patchGeo(lk.x - o - w, lk.y + lk.h + o, lk.w + 2 * (o + w), w, 3, 0.05));
    track.push(patchGeo(lk.x - o - w, lk.y - o, w, lk.h + 2 * o, 3, 0.05)); track.push(patchGeo(lk.x + lk.w + o, lk.y - o, w, lk.h + 2 * o, 3, 0.05));
  }

  const add = (list, mat, name) => { const g = merge(list); if (!g) return; const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; scene.add(m); };
  add(plaster, stdMat(T, T.plaster, { vertexColors: true }), 'amenity-plaster');
  add(stone, stdMat(T, T.stone, { vertexColors: true }), 'amenity-stone');
  const templeMat = stdMat(T, T.plaster, { vertexColors: true, roughness: 0.9, emissive: 0x7a4c18, emissiveIntensity: 0 }); ctx.templeMat = templeMat;
  add(sand, templeMat, 'temple-sandstone');
  ctx.templeLightMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xffd9a8, emissiveIntensity: 0 });
  add(glow, ctx.templeLightMat, 'temple-lights');
  add(metal, stdMat(T, T.metal, { vertexColors: true, metalness: 0.3, roughness: 0.6 }), 'amenity-metal');
  add(dark, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'amenity-dark');
  add(lawnPaths, stdMat(T, T.paving), 'amenity-paths');
  add(track, stdMat(T, T.track), 'tracks');
  const gm = new THREE.Mesh(merge(glass), ctx.glassMat); gm.name = 'amenity-glass'; scene.add(gm);
}
