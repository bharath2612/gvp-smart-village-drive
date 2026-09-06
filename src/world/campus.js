// Cricket stadium and school campus: detailed, drivable, lit for evening and night.
import * as THREE from 'three';
import { patchGeo, box, cyl, merge, stdMat } from './geo.js';
import { instancedChunks } from './instancing.js';

// Sloped or vertical band between two ellipses over an angle range.
function band(cx, cz, rx0, rz0, rx1, rz1, y0, y1, color, a0, a1, seg = 24) {
  const pos = [], col = [], idx = []; const c = new THREE.Color(color);
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pos.push(cx + Math.cos(a) * rx0, y0, cz + Math.sin(a) * rz0); pos.push(cx + Math.cos(a) * rx1, y1, cz + Math.sin(a) * rz1);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((seg + 1) * 4), 2)); return g;
}
export function textBoard(w, h, lines, bg = '#101418', fg = '#ffd35a', font = 'bold 64px Inter, sans-serif') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  // Shrink the font until the longest line fits inside 92 % of the board.
  const size = parseInt(font.match(/(\d+)px/)[1], 10); let fs = size;
  const widest = () => Math.max(...lines.map((t) => g.measureText(t).width));
  while (widest() > c.width * 0.92 && fs > 12) { fs -= 2; g.font = font.replace(/\d+px/, `${fs}px`); }
  lines.forEach((t, i) => g.fillText(t, c.width / 2, (c.height * (i + 1)) / (lines.length + 1)));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.6 }));
}

export function buildStadium(ctx) {
  const { scene, world, T, colliders } = ctx;
  const a = world.amenities.find((q) => q.id === 'stadium'); const p = world.byId.get('stadium');
  const cx = a.x + a.w / 2, cz = a.y + a.h / 2;
  const solid = (x0, z0, x1, z1, top) => colliders.add(x0, z0, x1, z1, 'amenity', p, top);
  const stone = [], metal = [], dark = [], paving = [], lawnPaths = [], glow = [], white = [];
  const bandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const addBand = (r0, r1, y0, y1, colr, a0, a1, seg) => { const m = new THREE.Mesh(band(cx, cz, RX + r0, RZ + r0, RX + r1, RZ + r1, y0, y1, colr, a0, a1, seg), bandMat); m.castShadow = true; m.receiveShadow = true; scene.add(m); };

  // Geometry budget: outfield ellipse RX x RZ, apron to +4, stands to +22, roof to +24, floodlights at +32, fence at the lot edge.
  const RX = 60, RZ = 66;
  // Concourse paving over the whole lot, outfield lawn ellipse on top.
  paving.push(patchGeo(a.x, a.y, a.w, a.h, 4, 0.05));
  const outfield = new THREE.Mesh(new THREE.CircleGeometry(1, 64), stdMat(T, T.lawn)); outfield.scale.set(RX, RZ, 1); outfield.rotation.x = -Math.PI / 2; outfield.position.set(cx, 0.07, cz); outfield.receiveShadow = true; scene.add(outfield);
  // Boundary rope (white ring) and the 30-yard circle.
  addBand(-3.2, -2.6, 0.085, 0.085, 0xf6f6f0, 0, Math.PI * 2, 96);
  addBand(-33, -32.7, 0.08, 0.08, 0xe8e8e0, 0, Math.PI * 2, 96);
  // Pitch: 20.12 x 3.05 m strip, creases, stumps.
  paving.push(patchGeo(cx - 1.53, cz - 10.06, 3.05, 20.12, 2, 0.09));
  for (const zz of [-10.06, -8.84, 8.84, 10.06]) white.push(box(3.66, 0.02, 0.08, 0xffffff, { x: cx, z: cz + zz, y: 0.1 }));
  for (const zz of [-10.06, 10.06]) for (const dx of [-0.11, 0, 0.11]) white.push(cyl(0.02, 0.02, 0.72, 5, 0xf0e0c0, { x: cx + dx, z: cz + zz, y: 0.46 }));
  // Apron (concrete walkway round the field) and the low picket fence with an advertising band.
  addBand(0, 4, 0.06, 0.06, 0xc9c5bb, 0, Math.PI * 2, 96);
  addBand(4, 4, 0, 1.0, 0x1e4fa3, 0, Math.PI * 2, 96);
  glow.push(...[]);
  // Stands in sectors with tunnels at E (main), N, W and the pavilion at S.
  // North tunnel is offset 22 m west of the pitch axis so it does not open onto the sightscreen.
  const NX = -22, nAng = Math.atan2(-(RZ + 14), NX);
  // The tunnel is a straight strip while the stand gap is radial: size the gap so the strip (x = NX +/- 5) clears the
  // stands at both the inner (RX + 4) and outer (RX + 24) radii.
  const gapAt = (x, r) => Math.atan2(-(RZ + r) * 1, x);
  const nGap = [Math.min(gapAt(NX - 5.5, 4), gapAt(NX - 5.5, 24)), Math.max(gapAt(NX + 5.5, 4), gapAt(NX + 5.5, 24))];
  const gaps = [[-0.075, 0.075], nGap, [Math.PI - 0.075, Math.PI + 0.075], [Math.PI / 2 - 0.19, Math.PI / 2 + 0.19]];
  // Sectors are the arcs between gaps. Normalise each gap's start to [0, 2pi) and keep its width, so a gap that
  // straddles angle 0 (the east tunnel) does not wrap into a sector spanning the whole circle.
  const sectors = []; { const TWO = Math.PI * 2; const edges = gaps.map(([s, e]) => { const st = ((s % TWO) + TWO) % TWO; return [st, st + (e - s)]; }).sort((u, v) => u[0] - v[0]);
    for (let i = 0; i < edges.length; i++) { const s = edges[i][1], e = i === edges.length - 1 ? edges[0][0] + TWO : edges[i + 1][0]; if (e > s + 0.01) sectors.push([s, e]); } }
  const seatCols = [0x2c5f9e, 0xd9dde2, 0xc9a227, 0x2c5f9e];
  let tierTop = 0;
  sectors.forEach(([s0, s1], si) => {
    const n = Math.max(6, Math.round(((s1 - s0) * 80) / 8));
    // Divide each sector into seat blocks of alternating colours.
    const blocks = Math.max(1, Math.round((s1 - s0) / 0.35));
    for (let b = 0; b < blocks; b++) {
      const b0 = s0 + ((s1 - s0) * b) / blocks, b1 = s0 + ((s1 - s0) * (b + 1)) / blocks; const colr = seatCols[(si + b) % seatCols.length];
      let r = 4, y = 1.0;
      addBand(r, r + 0.8, y, y, 0x8f979f, b0, b1, 4); r += 0.8;
      for (let i = 0; i < 14; i++) {
        if (i === 7) { addBand(r, r + 2.2, y, y, 0x8f979f, b0, b1, 4); r += 2.2; addBand(r, r, y, y + 0.9, 0x6d7889, b0, b1, 4); y += 0.9; }
        addBand(r, r + 0.9, y, y, colr, b0, b1, 4); r += 0.9;
        addBand(r, r, y, y + 0.5, 0x7d858e, b0, b1, 4); y += 0.5;
      }
      addBand(r, r + 1.2, y, y, 0x8f979f, b0, b1, 4); r += 1.2; tierTop = y;
      addBand(r, r + 0.6, y, y + 3.2, 0x5d6775, b0, b1, 4); addBand(r + 0.6, r + 0.6, 0, y + 3.2, 0xd9d5cc, b0, b1, 6);
      // Cove light strips along the walkway and the top edge of the stands.
      const m1 = new THREE.Mesh(band(cx, cz, RX + 12.3, RZ + 12.3, RX + 12.5, RZ + 12.5, 5.5, 5.5, 0xffe6c0, b0, b1, 4), null); glow.push(m1.geometry);
      const m2 = new THREE.Mesh(band(cx, cz, RX + r + 0.1, RZ + r + 0.1, RX + r + 0.3, RZ + r + 0.3, y + 3.25, y + 3.25, 0xffe6c0, b0, b1, 4), null); glow.push(m2.geometry);
    }
    // Colliders: a few AABBs along the sector, spanning the stands' radial range.
    const parts = Math.max(3, Math.round((s1 - s0) / 0.2));
    for (let i = 0; i < parts; i++) { const a0 = s0 + ((s1 - s0) * i) / parts, a1 = s0 + ((s1 - s0) * (i + 1)) / parts; const xs = [], zs = []; for (const ang of [a0, (a0 + a1) / 2, a1]) for (const rr of [4, 24]) { xs.push(cx + Math.cos(ang) * (RX + rr)); zs.push(cz + Math.sin(ang) * (RZ + rr)); } solid(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), tierTop + 6); }
  });
  // Roof canopy over every stand sector (not the pavilion), columns every 12 degrees.
  const roofY = tierTop + 3.4;
  for (const [s0, s1] of sectors) {
    if (Math.abs(((s0 + s1) / 2) - Math.PI / 2) < 0.6 && s1 - s0 < 1) continue;
    addBand(24.4, 6, roofY + 3.4, roofY + 1.2, 0xe9ecef, s0, s1, 24);
    addBand(6, 6, roofY + 1.2, roofY + 0.4, 0xc9a227, s0, s1, 24);
    addBand(23.8, 24.4, roofY, roofY + 3.6, 0x5d6775, s0, s1, 24);
    for (let ang = s0 + 0.1; ang < s1 - 0.05; ang += 0.21) { const x = cx + Math.cos(ang) * (RX + 23.5), z = cz + Math.sin(ang) * (RZ + 23.5); metal.push(cyl(0.3, 0.36, roofY + 3.4, 8, 0x8b949e, { x, z, y: (roofY + 3.4) / 2 })); }
  }
  // Tunnels through the stands at E, N, W: concrete floor, side walls, cove-lit portal.
  for (const [ang, ox] of [[0, 0], [-Math.PI / 2, NX], [Math.PI, 0]]) {
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const px = (r) => cx + dx * (RX + r) + ox, pz = (r) => cz + dz * (RZ + r);
    const horizontal = Math.abs(dx) > 0.5; const len = 26, wid = 9;
    const x0 = Math.min(px(2), px(28)), z0 = Math.min(pz(2), pz(28));
    paving.push(horizontal ? patchGeo(x0, cz - wid / 2, len, wid, 3, 0.08) : patchGeo(cx + ox - wid / 2, z0, wid, len, 3, 0.08));
    for (const side of [-1, 1]) {
      const wx = horizontal ? (px(2) + px(28)) / 2 : cx + ox + side * (wid / 2 + 0.4), wz = horizontal ? cz + side * (wid / 2 + 0.4) : (pz(2) + pz(28)) / 2;
      stone.push(horizontal ? box(len, 6, 0.8, 0xd9d5cc, { x: wx, z: wz, y: 3 }) : box(0.8, 6, len, 0xd9d5cc, { x: wx, z: wz, y: 3 }));
      solid(wx - (horizontal ? len / 2 : 0.4), wz - (horizontal ? 0.4 : len / 2), wx + (horizontal ? len / 2 : 0.4), wz + (horizontal ? 0.4 : len / 2));
      glow.push(horizontal ? box(len, 0.1, 0.12, 0xffe6c0, { x: wx, z: wz - side * 0.46, y: 5.6 }) : box(0.12, 0.1, len, 0xffe6c0, { x: wx - side * 0.46, z: wz, y: 5.6 }));
    }
    // Portal lintel with a sign.
    const lx = horizontal ? px(27) : cx + ox, lz = horizontal ? cz : pz(27);
    stone.push(horizontal ? box(1.2, 1.4, wid + 1.6, 0xc9a227, { x: lx, z: lz, y: 6.6 }) : box(wid + 1.6, 1.4, 1.2, 0xc9a227, { x: lx, z: lz, y: 6.6 }));
    const sign = textBoard(8, 1.1, [ang === 0 ? 'MAIN ENTRANCE' : ang === Math.PI ? 'WEST GATE' : 'NORTH GATE'], '#0a0f1c', '#ffd35a', 'bold 90px Inter, sans-serif');
    sign.position.set(horizontal ? px(28.2) : cx + ox, 6.6, horizontal ? cz : pz(28.2)); sign.rotation.y = horizontal ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI); scene.add(sign);
  }
  // Pavilion at the south end: two storeys, ground-floor colonnade towards the field, members' balcony, hipped roof, clock board.
  { const pz0 = cz + RZ + 4, pw = 30, pd = 16, pcz = pz0 + pd / 2 + 2;
    stone.push(box(pw + 1, 0.5, pd + 1, 0xd8d0c0, { x: cx, z: pcz, y: 0.25 }));
    stone.push(box(pw, 4.2, pd - 4, 0xf3ede2, { x: cx, z: pcz + 2, y: 0.5 + 2.1 }));
    for (let i = 0; i <= 8; i++) { const x = cx - pw / 2 + 1 + (i * (pw - 2)) / 8; stone.push(cyl(0.3, 0.34, 4.2, 10, 0xf3ede2, { x, z: pz0 + 1.6, y: 0.5 + 2.1 })); }
    stone.push(box(pw + 0.6, 0.5, pd + 0.6, 0xe0d6c4, { x: cx, z: pcz, y: 4.95 }));
    stone.push(box(pw, 3.6, pd - 1, 0xf3ede2, { x: cx, z: pcz + 0.5, y: 5.2 + 1.8 }));
    for (let i = 0; i < 6; i++) { const x = cx - pw / 2 + 2.5 + i * 5; dark.push(box(3.2, 2.2, 0.12, 0x223447, { x, z: pz0 + 0.02, y: 7.2 })); dark.push(box(3.2, 2.2, 0.12, 0x223447, { x, z: pz0 + 0.02, y: 2.7 })); }
    stone.push(box(pw + 0.2, 0.9, 0.15, 0xc9a227, { x: cx, z: pz0 + 0.1, y: 5.65 })); // balcony rail
    stone.push(box(pw + 2, 0.6, pd + 2, 0xe0d6c4, { x: cx, z: pcz, y: 9.1 }));
    stone.push(box(pw - 4, 2.4, pd - 4, 0x8b5a3c, { x: cx, z: pcz, y: 10.6 })); stone.push(box(pw - 12, 1.6, pd - 9, 0x8b5a3c, { x: cx, z: pcz, y: 12.6 }));
    glow.push(box(pw - 0.5, 0.1, 0.12, 0xffe6c0, { x: cx, z: pz0 + 0.2, y: 4.85 })); glow.push(box(pw - 0.5, 0.1, 0.12, 0xffe6c0, { x: cx, z: pz0 + 0.2, y: 9.0 }));
    const clock = textBoard(6, 2.2, ['GVP PAVILION', 'EST. 2026'], '#0a0f1c', '#ffd35a', 'bold 80px Georgia, serif'); clock.position.set(cx, 11.4, pz0 - 0.2); clock.rotation.y = Math.PI; scene.add(clock);
    for (const sx of [-1, 1]) { metal.push(cyl(0.08, 0.1, 9, 6, 0xdddddd, { x: cx + sx * (pw / 2 + 1.5), z: pz0 + 2, y: 4.5 })); }
    solid(cx - pw / 2 - 0.5, pz0, cx + pw / 2 + 0.5, pcz + pd / 2 + 0.5);
  }
  // Sightscreens behind each end of the pitch, scoreboard at the north-east.
  for (const sz of [-1, 1]) { const z = cz + sz * (RZ - 4); white.push(box(9, 6, 0.3, 0xf7f7f2, { x: cx, z, y: 4 })); dark.push(box(9.4, 6.4, 0.2, 0x2a2f36, { x: cx, z: z + sz * 0.2, y: 4 })); for (const dx of [-3.5, 3.5]) metal.push(cyl(0.12, 0.14, 1.2, 6, 0x8b949e, { x: cx + dx, z, y: 0.6 })); solid(cx - 4.7, z - 0.4, cx + 4.7, z + 0.4); }
  { const ang = -Math.PI / 4; const x = cx + Math.cos(ang) * (RX + 20), z = cz + Math.sin(ang) * (RZ + 20);
    const board = textBoard(16, 7, ['GVP SMART VILLAGE CRICKET GROUND', 'GVP XI   187 / 4    32.4 OV', 'TARGET 248'], '#0b0f14', '#ffd35a', 'bold 58px "Courier New", monospace');
    board.position.set(x, tierTop + 8, z); board.lookAt(cx, tierTop + 8, cz); scene.add(board);
    for (const d of [-6, 6]) { const px2 = x + Math.cos(ang + Math.PI / 2) * d, pz2 = z + Math.sin(ang + Math.PI / 2) * d; metal.push(cyl(0.3, 0.35, tierTop + 12, 8, 0x8b949e, { x: px2, z: pz2, y: (tierTop + 12) / 2 })); } }
  // Six floodlight towers with lamp arrays (share the lamp emissive so they switch on at night).
  // Four corner towers plus two flanking the pavilion; none on the E/N/W tunnel axes.
  for (const ang of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4, Math.PI / 2 - 0.35, Math.PI / 2 + 0.35]) {
    const x = cx + Math.cos(ang) * (RX + 33), z = cz + Math.sin(ang) * (RZ + 33);
    metal.push(cyl(0.6, 1.1, 42, 8, 0xbfc4cc, { x, z, y: 21 })); metal.push(box(1.8, 1.8, 1.8, 0x8b949e, { x, z, y: 42.2 }));
    const yaw = Math.atan2(cx - x, cz - z); const frame = box(8, 4.6, 0.5, 0x3a4048, { y: 44.5 }); frame.rotateY(yaw); frame.translate(x, 0, z); dark.push(frame);
    const lamps = new THREE.Group(); lamps.position.set(x, 44.5, z); lamps.rotation.y = yaw; const lampGeo = new THREE.BoxGeometry(1.4, 0.85, 0.25);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { const m = new THREE.Mesh(lampGeo, ctx.lampHeadMat); m.position.set(-3.2 + c * 1.6, -1.6 + r * 1.05, 0.38); lamps.add(m); }
    scene.add(lamps); solid(x - 4.5, z - 4.5, x + 4.5, z + 4.5, 47);
  }
  // Perimeter fence with gates at the four sides (E gate is the vehicle entrance from the 25 m road).
  { const gw = 12; const seg = (x0, z0, x1, z1) => { const hz = Math.abs(x1 - x0) > Math.abs(z1 - z0); metal.push(hz ? box(Math.abs(x1 - x0), 2.2, 0.15, 0x3a4048, { x: (x0 + x1) / 2, z: z0, y: 1.1 }) : box(0.15, 2.2, Math.abs(z1 - z0), 0x3a4048, { x: x0, z: (z0 + z1) / 2, y: 1.1 })); solid(Math.min(x0, x1) - 0.2, Math.min(z0, z1) - 0.2, Math.max(x0, x1) + 0.2, Math.max(z0, z1) + 0.2); };
    const L = 1, R = a.x + a.w - 1, Tt = a.y + 1, B = a.y + a.h - 1, l = a.x + 1;
    const nx = cx + NX; seg(l, Tt, nx - gw / 2, Tt); seg(nx + gw / 2, Tt, R, Tt); seg(l, B, cx - gw / 2, B); seg(cx + gw / 2, B, R, B);
    seg(l, Tt, l, cz - gw / 2); seg(l, cz + gw / 2, l, B); seg(R, Tt, R, cz - gw / 2); seg(R, cz + gw / 2, R, B);
    for (const [gx, gz, hz] of [[nx, Tt, true], [cx, B, true], [l, cz, false], [R, cz, false]]) { for (const s of [-1, 1]) stone.push(box(1.2, 3.2, 1.2, 0xe4dccd, { x: gx + (hz ? s * (gw / 2 + 0.6) : 0), z: gz + (hz ? 0 : s * (gw / 2 + 0.6)), y: 1.6 })); }
    // Driveway from the east gate to the main tunnel.
    paving.push(patchGeo(cx + RX + 28, cz - 6, R - (cx + RX + 28) + 1, 12, 3, 0.075));
    paving.push(patchGeo(R, cz - 6, 4.6, 12, 3, 0.09)); // across the 25 m road's verge
    const gate = textBoard(10, 1.4, ['GVP CRICKET GROUND'], '#0a0f1c', '#ffd35a', 'bold 96px Georgia, serif'); gate.position.set(R - 0.3, 4.2, cz); gate.rotation.y = Math.PI / 2; scene.add(gate);
    stone.push(box(0.6, 0.8, gw + 2.4, 0xc9a227, { x: R, z: cz, y: 4.2 }));
  }
  // Trees round the concourse are planted by vegetation.js; bollards and pools by lights.js.
  const add = (list, mat, name) => { const g = merge(list); if (!g) return; const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; scene.add(m); };
  add(stone, stdMat(T, T.plaster, { vertexColors: true }), 'stadium-stone');
  add(metal, stdMat(T, T.metal, { vertexColors: true, metalness: 0.3, roughness: 0.6 }), 'stadium-metal');
  add(dark, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'stadium-dark');
  add(white, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 'stadium-white');
  add(paving, stdMat(T, T.paving), 'stadium-paving');
  add(glow, ctx.templeLightMat || new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffd9a8, emissiveIntensity: 1.2 }), 'stadium-lights');
  ctx.stadiumInfo = { cx, cz, RX, RZ };
}

export function buildSchool(ctx) {
  const { scene, world, T, colliders } = ctx;
  const a = world.amenities.find((q) => q.id === 'school'); const p = world.byId.get('school');
  const solid = (x0, z0, x1, z1, top) => colliders.add(x0, z0, x1, z1, 'amenity', p, top);
  const plaster = [], stone = [], dark = [], metal = [], paving = [], glass = [], glow = [], white = [];
  const cx = a.x + a.w / 2, cz = a.y + a.h / 2;
  // Campus wall with pillars; main gate on the west side facing the spine, with a driveway from the spine edge.
  { const wallH = 1.8, gw = 10; const seg = (x0, z0, x1, z1) => { const hz = Math.abs(x1 - x0) > Math.abs(z1 - z0); plaster.push(hz ? box(Math.abs(x1 - x0), wallH, 0.3, 0xe6dfd3, { x: (x0 + x1) / 2, z: z0, y: wallH / 2 }) : box(0.3, wallH, Math.abs(z1 - z0), 0xe6dfd3, { x: x0, z: (z0 + z1) / 2, y: wallH / 2 })); solid(Math.min(x0, x1) - 0.2, Math.min(z0, z1) - 0.2, Math.max(x0, x1) + 0.2, Math.max(z0, z1) + 0.2); };
    const l = a.x, r = a.x + a.w, t = a.y, b = a.y + a.h;
    seg(l, t, r, t); seg(l, b, r, b); seg(r, t, r, b); seg(l, t, l, cz - gw / 2); seg(l, cz + gw / 2, l, b);
    for (let x = l; x <= r; x += 12) { plaster.push(box(0.6, wallH + 0.5, 0.6, 0xd9d0c0, { x, z: t, y: (wallH + 0.5) / 2 })); plaster.push(box(0.6, wallH + 0.5, 0.6, 0xd9d0c0, { x, z: b, y: (wallH + 0.5) / 2 })); }
    for (let z = t; z <= b; z += 12) { plaster.push(box(0.6, wallH + 0.5, 0.6, 0xd9d0c0, { x: r, z, y: (wallH + 0.5) / 2 })); if (Math.abs(z - cz) > gw / 2 + 1) plaster.push(box(0.6, wallH + 0.5, 0.6, 0xd9d0c0, { x: l, z, y: (wallH + 0.5) / 2 })); }
    // Gate: two piers, an arch lintel with the school name, leaves open.
    for (const s of [-1, 1]) stone.push(box(1.6, 5.2, 1.6, 0xe4dccd, { x: l, z: cz + s * (gw / 2 + 0.8), y: 2.6 }));
    stone.push(box(1.8, 1.2, gw + 3.2, 0xe4dccd, { x: l, z: cz, y: 5.6 })); stone.push(box(2.2, 0.4, gw + 3.6, 0xc9a227, { x: l, z: cz, y: 6.4 }));
    const sign = textBoard(9, 1.1, ['GVP SMART VILLAGE SCHOOL'], '#0a0f1c', '#ffd35a', 'bold 88px Georgia, serif'); sign.position.set(l - 1.0, 5.6, cz); sign.rotation.y = -Math.PI / 2; scene.add(sign);
    // Driveway from the spine's east edge to the gate (8 m pavers) and the internal drive to the plaza.
    const spineEdge = 1514.9; paving.push(patchGeo(spineEdge - 3.2, cz - 4, l - spineEdge + 3.2, 8, 3, 0.09)); // starts inside the spine's verge
    paving.push(patchGeo(l, cz - 5, 40, 10, 3, 0.075));
    glow.push(box(0.12, 0.1, gw + 2, 0xffe6c0, { x: l + 0.9, z: cz, y: 5.0 }));
  }
  // Assembly plaza with a flagpole, benches and planters.
  const plazaX = a.x + 40, plazaW = 60, plazaD = 70;
  paving.push(patchGeo(plazaX, cz - plazaD / 2, plazaW, plazaD, 3, 0.075));
  // Flagpole off the driveway axis so the drive from the gate runs straight through the plaza.
  const fpx = plazaX + plazaW / 2, fpz = cz - 14;
  metal.push(cyl(0.08, 0.1, 14, 6, 0xdddddd, { x: fpx, z: fpz, y: 7 })); stone.push(cyl(1.4, 1.6, 0.6, 12, 0xd9d0c0, { x: fpx, z: fpz, y: 0.3 })); solid(fpx - 1.6, fpz - 1.6, fpx + 1.6, fpz + 1.6);
  white.push(box(1.2, 0.8, 1.2, 0xd0342c, { x: fpx, z: fpz, y: 13.6 }));
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const x = plazaX + 8 + i * 9, z = cz + s * (plazaD / 2 - 3); dark.push(box(1.8, 0.08, 0.5, 0x5a3a24, { x, z, y: 0.5 })); dark.push(box(1.8, 0.4, 0.08, 0x5a3a24, { x, z: z - s * 0.25, y: 0.75 })); for (const dx of [-0.7, 0.7]) dark.push(box(0.1, 0.5, 0.5, 0x3a3f46, { x: x + dx, z, y: 0.25 })); solid(x - 1, z - 0.4, x + 1, z + 0.4); }
  // Academic block: three storeys, colonnaded portico, open corridors with columns on every floor, chajja sunshades.
  const blk = (x, z, w, d, floors, portico) => {
    const F = 3.6; plaster.push(box(w + 1, 0.5, d + 1, 0xd9d0c0, { x, z, y: 0.25 }));
    for (let f = 0; f < floors; f++) {
      const y0 = 0.5 + f * F;
      plaster.push(box(w, F - 0.35, d - 3, 0xf3ede2, { x, z: z - 1.5, y: y0 + (F - 0.35) / 2 }));
      plaster.push(box(w + 0.6, 0.35, d + 0.6, 0xe0d6c4, { x, z, y: y0 + F - 0.175 })); // floor slab / cornice
      // Corridor colonnade on the front (south, +z) face and chajja sunshades over the windows.
      for (let cxx = x - w / 2 + 1.2; cxx <= x + w / 2 - 1; cxx += 3.6) plaster.push(box(0.4, F - 0.35, 0.4, 0xf3ede2, { x: cxx, z: z + d / 2 - 0.4, y: y0 + (F - 0.35) / 2 }));
      plaster.push(box(w, 0.9, 0.12, 0xe0d6c4, { x, z: z + d / 2 - 0.1, y: y0 + F - 0.8 })); // corridor parapet band
      for (let wx = x - w / 2 + 2.6; wx <= x + w / 2 - 2; wx += 4.4) { glass.push(box(2.4, 1.6, 0.1, 0x223447, { x: wx, z: z + d / 2 - 3 + 0.06, y: y0 + 1.9 })); plaster.push(box(2.9, 0.1, 0.7, 0xe0d6c4, { x: wx, z: z + d / 2 - 3 + 0.3, y: y0 + 2.85 })); glass.push(box(2.4, 1.6, 0.1, 0x223447, { x: wx, z: z - d / 2 - 0.06, y: y0 + 1.9 })); plaster.push(box(2.9, 0.1, 0.7, 0xe0d6c4, { x: wx, z: z - d / 2 - 0.3, y: y0 + 2.85 })); }
      glow.push(box(w - 0.6, 0.08, 0.1, 0xffe6c0, { x, z: z + d / 2 + 0.15, y: y0 + F - 0.4 }));
      glow.push(box(w - 0.6, 0.08, 0.1, 0xffe6c0, { x, z: z - d / 2 - 0.15, y: y0 + F - 0.4 }));
    }
    const top = 0.5 + floors * F; plaster.push(box(w + 0.4, 0.7, d + 0.4, 0xf3ede2, { x, z, y: top + 0.35 })); plaster.push(box(3.2, 2.6, 3, 0xf3ede2, { x: x - w / 2 + 3, z: z - d / 2 + 3, y: top + 1.3 }));
    if (portico) { const pw = 14, pdp = 6; plaster.push(box(pw, 0.5, pdp, 0xe0d6c4, { x, z: z + d / 2 + pdp / 2, y: F + 0.3 })); for (const px of [-5.5, -2, 2, 5.5]) plaster.push(cyl(0.35, 0.4, F - 0.2, 10, 0xf3ede2, { x: x + px, z: z + d / 2 + pdp - 1, y: 0.5 + (F - 0.2) / 2 })); plaster.push(box(pw + 0.4, 0.3, pdp + 0.4, 0xc9a227, { x, z: z + d / 2 + pdp / 2, y: F + 0.65 })); for (let s = 0; s < 3; s++) plaster.push(box(pw - 2, 0.16, 1, 0xd9d0c0, { x, z: z + d / 2 + pdp + 0.5 + s, y: 0.08 + (2 - s) * 0.16 })); glow.push(box(pw - 1, 0.08, 0.1, 0xffe6c0, { x, z: z + d / 2 + pdp + 0.2, y: F + 0.05 })); }
    solid(x - w / 2 - 0.5, z - d / 2 - 0.5, x + w / 2 + 0.5, z + d / 2 + 0.5);
  };
  blk(plazaX + plazaW / 2, cz - plazaD / 2 - 9, 90, 16, 3, true);       // main academic block north of the plaza, portico facing the plaza
  blk(plazaX + plazaW + 14, cz - 12, 14, 50, 2, false);                  // east wing (rotated by making it deep instead of wide)
  blk(plazaX + plazaW / 2, cz + plazaD / 2 + 9, 60, 14, 2, false);       // south wing (library / labs)
  // Multi-purpose hall east of the plaza with a curved (segmented) roof.
  { const hx = plazaX + plazaW + 60, hz = cz - 40, hw = 34, hd = 22;
    plaster.push(box(hw, 7, hd, 0xf3ede2, { x: hx, z: hz, y: 3.5 })); for (let i = 0; i < 9; i++) { const t = (i / 8) * Math.PI; metal.push(box(hw + 1, 0.4, hd / 8 + 0.3, 0x8e969f, { x: hx, z: hz - hd / 2 + (i * hd) / 8, y: 7 + Math.sin(t) * 3.5 })); }
    for (let wx = hx - hw / 2 + 3; wx < hx + hw / 2 - 2; wx += 4) { glass.push(box(2.2, 2.4, 0.1, 0x223447, { x: wx, z: hz + hd / 2 + 0.06, y: 4.2 })); glass.push(box(2.2, 2.4, 0.1, 0x223447, { x: wx, z: hz - hd / 2 - 0.06, y: 4.2 })); }
    dark.push(box(4, 3.4, 0.2, 0x4a2f1d, { x: hx, z: hz + hd / 2 + 0.1, y: 1.7 })); glow.push(box(hw - 1, 0.08, 0.1, 0xffe6c0, { x: hx, z: hz + hd / 2 + 0.2, y: 6.7 }));
    const sign = textBoard(8, 1.0, ['MULTIPURPOSE HALL'], '#0a0f1c', '#ffd35a', 'bold 88px Inter, sans-serif'); sign.position.set(hx, 5.6, hz + hd / 2 + 0.25); scene.add(sign);
    solid(hx - hw / 2 - 0.5, hz - hd / 2 - 0.5, hx + hw / 2 + 0.5, hz + hd / 2 + 0.5);
  }
  // Basketball court and football field on the east side.
  { const bx = plazaX + plazaW + 60, bz = cz + 30; paving.push(patchGeo(bx - 14, bz - 7.5, 28, 15, 2, 0.075));
    white.push(box(28, 0.02, 0.1, 0xf7f7f2, { x: bx, z: bz - 7.5, y: 0.09 })); white.push(box(28, 0.02, 0.1, 0xf7f7f2, { x: bx, z: bz + 7.5, y: 0.09 })); white.push(box(0.1, 0.02, 15, 0xf7f7f2, { x: bx - 14, z: bz, y: 0.09 })); white.push(box(0.1, 0.02, 15, 0xf7f7f2, { x: bx + 14, z: bz, y: 0.09 })); white.push(box(0.1, 0.02, 15, 0xf7f7f2, { x: bx, z: bz, y: 0.09 }));
    for (const s of [-1, 1]) { metal.push(cyl(0.08, 0.1, 3.5, 6, 0x8b949e, { x: bx + s * 13.4, z: bz, y: 1.75 })); white.push(box(0.1, 1.1, 1.8, 0xf7f7f2, { x: bx + s * 13.0, z: bz, y: 3.4 })); solid(bx + s * 13.4 - 0.3, bz - 0.3, bx + s * 13.4 + 0.3, bz + 0.3); }
    const fx = a.x + a.w - 52, fz = cz + 40, fw = 80, fd = 50;
    white.push(box(fw, 0.02, 0.15, 0xf7f7f2, { x: fx, z: fz - fd / 2, y: 0.085 })); white.push(box(fw, 0.02, 0.15, 0xf7f7f2, { x: fx, z: fz + fd / 2, y: 0.085 })); white.push(box(0.15, 0.02, fd, 0xf7f7f2, { x: fx - fw / 2, z: fz, y: 0.085 })); white.push(box(0.15, 0.02, fd, 0xf7f7f2, { x: fx + fw / 2, z: fz, y: 0.085 })); white.push(box(0.15, 0.02, fd, 0xf7f7f2, { x: fx, z: fz, y: 0.085 }));
    for (const s of [-1, 1]) { const gx = fx + s * fw / 2; metal.push(cyl(0.07, 0.07, 2.44, 6, 0xf4f4f4, { x: gx, z: fz - 3.66, y: 1.22 })); metal.push(cyl(0.07, 0.07, 2.44, 6, 0xf4f4f4, { x: gx, z: fz + 3.66, y: 1.22 })); metal.push(box(0.14, 0.14, 7.32, 0xf4f4f4, { x: gx, z: fz, y: 2.44 })); solid(gx - 0.3, fz - 3.8, gx + 0.3, fz + 3.8); }
  }
  // Covered walkway (pergola) from the gate drive to the portico, cycle stands, lamp posts along the drive.
  for (let x = plazaX + 4; x < plazaX + plazaW - 4; x += 6) { for (const s of [-1, 1]) metal.push(cyl(0.12, 0.14, 3.2, 6, 0x8b949e, { x, z: cz - plazaD / 2 + 4 + s * 1.5, y: 1.6 })); metal.push(box(0.2, 0.15, 3.6, 0x8b949e, { x, z: cz - plazaD / 2 + 4, y: 3.25 })); }
  metal.push(box(plazaW - 8, 0.12, 4, 0xc9c5bb, { x: plazaX + plazaW / 2, z: cz - plazaD / 2 + 4, y: 3.4 }));
  for (let i = 0; i < 8; i++) metal.push(box(0.08, 0.7, 2.2, 0x8b949e, { x: plazaX + 4 + i * 0.8, z: cz + plazaD / 2 - 8, y: 0.5 }));

  const add = (list, mat, name) => { const g = merge(list); if (!g) return; const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; scene.add(m); };
  add(plaster, stdMat(T, T.plaster, { vertexColors: true }), 'school-plaster');
  add(stone, stdMat(T, T.plaster, { vertexColors: true, roughness: 0.9 }), 'school-stone');
  add(dark, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'school-dark');
  add(metal, stdMat(T, T.metal, { vertexColors: true, metalness: 0.3, roughness: 0.6 }), 'school-metal');
  add(white, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 'school-white');
  add(paving, stdMat(T, T.pavers), 'school-paving');
  const gm = new THREE.Mesh(merge(glass), ctx.glassMat); gm.name = 'school-glass'; scene.add(gm);
  add(glow, ctx.templeLightMat, 'school-lights');
  ctx.schoolInfo = { plazaX, plazaW, plazaD, cz, gateX: a.x, driveZ: cz };
}
