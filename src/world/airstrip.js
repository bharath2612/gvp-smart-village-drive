// GVP Airstrip outside the south wall: runway 09/27, taxiway, apron, hangar with a second aircraft, office, fuel
// bowser, windsock, PAPI, edge and threshold lights, fence, car park and the approach road from the (now open) gate.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { patchGeo, box, cyl, merge, stdMat } from './geo.js';
import { textBoard } from './campus.js';
import { PlaneVisual } from '../plane/visual.js';

function colour(geo, hex) { const c = new THREE.Color(hex); const arr = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return geo; }
function flatText(w, h, text, fg = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w); const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = `bold ${Math.round(c.height * 0.9)}px Inter, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m;
}

export function buildAirstrip(ctx) {
  const { scene, T, colliders } = ctx;
  const S = CONFIG.world.size;
  const RZ = S + 180, RX0 = 800, RX1 = 1400, RW = 23;              // runway centreline and extent
  const AX = 1480, AZ = RZ, AW = 60, AD = 40;                        // apron centre and size
  const HX = 1480, HZ = 3128, HW = 24, HD = 20;                      // hangar
  const paved = [], pools = [];
  const A = { threshold: { x: RX0 + 15, z: RZ, yaw: Math.PI / 2 }, threshold27: { x: RX1 - 15, z: RZ, yaw: -Math.PI / 2 }, apron: { x: AX, z: AZ + 8, yaw: Math.PI }, park: { x: 1522, z: 3166, yaw: 0 }, hangarPrompt: { x: AX, z: HZ + HD / 2 + 14 }, runway: { x0: RX0, x1: RX1, z: RZ, w: RW }, paved, pools };
  ctx.airstrip = A;

  // Surfaces: runway, taxiway, apron, hangar floor, approach road, car park.
  const asphalt = [patchGeo(RX0, RZ - RW / 2, RX1 - RX0, RW, 4, 0.03), patchGeo(RX1 - 2, RZ - 6, AX - AW / 2 - RX1 + 2, 12, 4, 0.03), patchGeo(1494, S + 1, 12, AZ - AD / 2 - S - 1 + 0.5, 4, 0.03)];
  const concrete = [patchGeo(AX - AW / 2, AZ - AD / 2, AW, AD, 5, 0.035), patchGeo(HX - HW / 2, HZ - HD / 2, HW, HD + 2, 5, 0.035), patchGeo(1512, 3158, 22, 14, 4, 0.03)];
  paved.push({ x: RX0, y: RZ - RW / 2, w: RX1 - RX0, h: RW }, { x: RX1 - 2, y: RZ - 6, w: AX - AW / 2 - RX1 + 2, h: 12 }, { x: 1494, y: S, w: 12, h: AZ - AD / 2 - S + 1 }, { x: AX - AW / 2, y: AZ - AD / 2, w: AW, h: AD }, { x: HX - HW / 2, y: HZ - HD / 2, w: HW, h: HD + 2 }, { x: 1512, y: 3158, w: 22, h: 14 });
  const asph = new THREE.Mesh(merge(asphalt), stdMat(T, T.asphalt)); asph.receiveShadow = true; asph.name = 'airstrip-asphalt'; scene.add(asph);
  const conc = new THREE.Mesh(merge(concrete), stdMat(T, T.concrete)); conc.receiveShadow = true; conc.name = 'airstrip-concrete'; scene.add(conc);
  // Markings: threshold piano keys, centreline dashes, edge lines, apron parking box, road centreline.
  const white = [], yellow = [];
  for (const [x0, dir] of [[RX0 + 6, 1], [RX1 - 6, -1]]) for (let i = 0; i < 8; i++) { const zz = RZ - RW / 2 + 1.5 + i * 2.8; white.push(patchGeo(dir > 0 ? x0 : x0 - 24, zz, 24, 1.5, 4, 0.05)); }
  for (let x = RX0 + 90; x < RX1 - 90; x += 50) white.push(patchGeo(x, RZ - 0.45, 30, 0.9, 4, 0.05));
  white.push(patchGeo(RX0 + 2, RZ - RW / 2 + 0.2, RX1 - RX0 - 4, 0.6, 4, 0.05)); white.push(patchGeo(RX0 + 2, RZ + RW / 2 - 0.8, RX1 - RX0 - 4, 0.6, 4, 0.05));
  yellow.push(patchGeo(RX1 - 2, RZ - 0.25, AX - AW / 2 - RX1 + 4, 0.5, 4, 0.05)); yellow.push(patchGeo(1499.75, S + 1, 0.5, AZ - AD / 2 - S - 1, 4, 0.05));
  for (let i = 0; i < 3; i++) yellow.push(patchGeo(AX - 24 + i * 16, AZ - 12, 0.4, 24, 4, 0.05));
  for (const [list, hex] of [[white, 0xf2f2ee], [yellow, 0xe8c547]]) { const m = new THREE.Mesh(merge(list), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9 })); m.receiveShadow = true; scene.add(m); }
  const n09 = flatText(12, 8, '09'); n09.position.set(RX0 + 52, 0.06, RZ); n09.rotation.z = -Math.PI / 2; scene.add(n09);
  const n27 = flatText(12, 8, '27'); n27.position.set(RX1 - 52, 0.06, RZ); n27.rotation.z = Math.PI / 2; scene.add(n27);
  const pk = flatText(6, 2, 'P', '#c9a227'); pk.position.set(A.park.x, 0.05, A.park.z); scene.add(pk);

  // Lights: runway edge (white, amber for the last 200 m), threshold bars (green towards the approach, red behind), PAPI, apron floods.
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x8b949e, roughness: 0.7 }));
  const headGeo = new THREE.BoxGeometry(0.3, 0.26, 0.3); const amberMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffa030, emissiveIntensity: 1.2 }); const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x40ff70, emissive: 0x20ff50, emissiveIntensity: 1.6 }), redMat = new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xff2020, emissiveIntensity: 1.6 });
  const edge = new THREE.Group(); edge.name = 'runway-lights';
  const lamp = (x, z, mat) => { const s = stub.clone(); s.position.set(x, 0.25, z); edge.add(s); const h = new THREE.Mesh(headGeo, mat); h.position.set(x, 0.6, z); edge.add(h); };
  for (let x = RX0; x <= RX1; x += 60) for (const side of [-1, 1]) { const amber = x < RX0 + 200 || x > RX1 - 200; lamp(x, RZ + side * (RW / 2 + 1.5), amber ? amberMat : whiteMat); pools.push({ x, z: RZ + side * (RW / 2 + 1.5), sx: 8, sz: 8 }); }
  for (let i = -5; i <= 5; i++) { lamp(RX0 - 3, RZ + i * 2.2, greenMat); lamp(RX0 - 1, RZ + i * 2.2, redMat); lamp(RX1 + 3, RZ + i * 2.2, greenMat); lamp(RX1 + 1, RZ + i * 2.2, redMat); }
  for (let i = 0; i < 4; i++) { const px = RX0 + 90 + i * 3, pz = RZ - RW / 2 - 9; edge.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x2a2f36 })).translateX(px).translateY(0.5).translateZ(pz)); const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.1), i < 2 ? whiteMat : redMat); h.position.set(px, 0.55, pz + 0.32); edge.add(h); }
  scene.add(edge);
  // Apron flood masts (share the street lamp head so they switch with the preset) and pools.
  const mastGeo = merge([cyl(0.12, 0.18, 12, 8, 0x8b949e, { y: 6 }), box(1.6, 0.5, 0.5, 0x3a4048, { y: 12.1 })]);
  const masts = new THREE.Mesh(mastGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
  const mastPos = [[AX - AW / 2 + 2, AZ + AD / 2 - 2], [AX + AW / 2 - 2, AZ + AD / 2 - 2], [AX - AW / 2 + 2, AZ - AD / 2 + 2], [AX + AW / 2 - 2, AZ - AD / 2 + 2]];
  for (const [x, z] of mastPos) { const m = masts.clone(); m.position.set(x, 0, z); m.castShadow = true; scene.add(m); if (ctx.lampHeadMat) { const h = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 0.42), ctx.lampHeadMat); h.position.set(x, 11.85, z); scene.add(h); } pools.push({ x, z, sx: 40, sz: 40 }); colliders.add(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 'lamp', null, 13); }

  // Hangar: arched roof, back wall, front with the door opening, sliding door leaves parked at the sides.
  const hMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide });
  const arch = new THREE.CylinderGeometry(HW / 2, HW / 2, HD, 24, 1, true, -Math.PI / 2, Math.PI); arch.rotateX(-Math.PI / 2); colour(arch, 0xd5dae0); arch.translate(HX, 0, HZ);
  const back = new THREE.CircleGeometry(HW / 2, 24, 0, Math.PI); colour(back, 0xc9cfd6); back.translate(HX, 0, HZ - HD / 2);
  const frontShape = new THREE.Shape(); frontShape.absarc(0, 0, HW / 2, 0, Math.PI, false); frontShape.lineTo(-HW / 2, 0);
  const hole = new THREE.Path(); hole.moveTo(-9.2, 0); hole.lineTo(9.2, 0); hole.lineTo(9.2, 6.6); hole.lineTo(-9.2, 6.6); hole.lineTo(-9.2, 0); frontShape.holes.push(hole);
  const front = new THREE.ShapeGeometry(frontShape, 24); colour(front, 0xc9cfd6); front.translate(HX, 0, HZ + HD / 2);
  const hangar = new THREE.Mesh(merge([arch, back, front]), hMat); hangar.castShadow = true; hangar.receiveShadow = true; hangar.name = 'hangar'; scene.add(hangar);
  const doors = new THREE.Mesh(merge([box(3, 6.5, 0.3, 0x1e4fa3, { x: HX - 10.6, y: 3.25, z: HZ + HD / 2 + 0.3 }), box(3, 6.5, 0.3, 0x1e4fa3, { x: HX + 10.6, y: 3.25, z: HZ + HD / 2 + 0.3 }), box(HW + 0.4, 0.4, 0.5, 0xc9a227, { x: HX, y: 6.85, z: HZ + HD / 2 + 0.2 }),
    box(3, 1.1, 1.8, 0x3a4048, { x: HX - 8, y: 0.55, z: HZ - 6 }), box(1.2, 1.4, 0.8, 0xb8302a, { x: HX + 9.5, y: 0.7, z: HZ - 4 }), box(0.9, 0.9, 0.9, 0x8b949e, { x: HX - 9.5, y: 0.45, z: HZ + 2 })]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
  doors.castShadow = true; scene.add(doors);
  const sign = textBoard(10, 1.4, ['GVP AIR · CHARTER'], '#0a0f1c', '#ffd35a', 'bold 72px Georgia, serif'); sign.position.set(HX, 8.6, HZ + HD / 2 + 0.36); scene.add(sign);
  colliders.add(HX - HW / 2 - 0.3, HZ - HD / 2, HX - HW / 2 + 2.5, HZ + HD / 2, 'amenity', null, 12); colliders.add(HX + HW / 2 - 2.5, HZ - HD / 2, HX + HW / 2 + 0.3, HZ + HD / 2, 'amenity', null, 12);
  colliders.add(HX - HW / 2, HZ - HD / 2 - 0.3, HX + HW / 2, HZ - HD / 2 + 0.3, 'amenity', null, 12);
  colliders.add(HX - 12.2, HZ + HD / 2, HX - 9.2, HZ + HD / 2 + 0.6, 'amenity', null, 7); colliders.add(HX + 9.2, HZ + HD / 2, HX + 12.2, HZ + HD / 2 + 0.6, 'amenity', null, 7);
  colliders.add(HX - 9.6, HZ - 7, HX - 6.4, HZ - 5, 'amenity', null, 1.2); colliders.add(HX + 8.8, HZ - 4.5, HX + 10.2, HZ - 3.5, 'amenity', null, 1.5);
  pools.push({ x: HX - 5, z: HZ, sx: 22, sz: 22 }, { x: HX + 5, z: HZ, sx: 22, sz: 22 }, { x: HX, z: HZ + HD / 2 + 4, sx: 26, sz: 14 });
  // Second aircraft in the hangar (red livery), nose to the door.
  const parked = PlaneVisual.parked(scene, ctx, HX - 1, HZ - 1, Math.PI, { main: 0xf4f4f0, accent: 0xb8302a, stripe: 0x2a2f36 }, 'VT-SVD');
  ctx.animate = ctx.animate || []; ctx.animate.push((dt, t) => { parked.beaconMat.emissiveIntensity = 0.2; });
  colliders.add(HX - 6.6, HZ - 5.2, HX + 4.6, HZ + 3.2, 'car', null, 2.9);

  // Office cabin with windows and a sign; fuel bowser; windsock.
  const office = [box(10, 3.2, 6, 0xf1eee8, { x: 1517, y: 1.6, z: 3153 }), box(10.6, 0.3, 6.6, 0x8b949e, { x: 1517, y: 3.35, z: 3153 }), box(1.1, 2.2, 0.1, 0x2a2f36, { x: 1515, y: 1.1, z: 3156.05 })];
  const officeMesh = new THREE.Mesh(merge(office), stdMat(T, T.plaster, { vertexColors: true })); officeMesh.castShadow = true; officeMesh.receiveShadow = true; scene.add(officeMesh);
  const win = new THREE.Mesh(merge([box(2.4, 1.2, 0.08, 0x7fa5c4, { x: 1519.5, y: 1.9, z: 3156.05 }), box(2.4, 1.2, 0.08, 0x7fa5c4, { x: 1513.5, y: 1.9, z: 3156.05 }), box(0.08, 1.2, 4, 0x7fa5c4, { x: 1522.05, y: 1.9, z: 3153 })]), ctx.glassMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.4 })); scene.add(win);
  const osign = textBoard(6, 0.9, ['GVP AIRSTRIP'], '#0a0f1c', '#ffd35a', 'bold 64px Georgia, serif'); osign.position.set(1517, 2.7, 3156.1); scene.add(osign);
  colliders.add(1512, 3150, 1522, 3156, 'amenity', null, 3.6);
  const bowser = new THREE.Mesh(merge([box(2.2, 0.9, 5, 0x2a2f36, { x: 1455, y: 0.75, z: 3196 }), cyl(0.9, 0.9, 3.4, 12, 0xd8dde2, { x: 1455, y: 1.7, z: 3196.6 }).rotateX(0), box(2.0, 1.4, 1.5, 0xc9a227, { x: 1455, y: 1.7, z: 3193.9 })]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }));
  bowser.castShadow = true; scene.add(bowser); colliders.add(1453.8, 3193, 1456.2, 3199, 'car', null, 2.6);
  { const cy2 = new THREE.CylinderGeometry(0.9, 0.9, 3.4, 12); cy2.rotateX(Math.PI / 2); cy2.translate(1455, 1.7, 3196.6); const m = new THREE.Mesh(cy2, new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.4, metalness: 0.5 })); m.castShadow = true; scene.add(m); }
  const sockPole = new THREE.Mesh(cyl(0.06, 0.08, 6, 8, 0xdddddd, { x: 1420, y: 3, z: 3212 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 })); scene.add(sockPole); colliders.add(1419.7, 3211.7, 1420.3, 3212.3, 'sign', null, 6.5);
  const sock = new THREE.Group(); sock.position.set(1420, 6, 3212);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 1.8, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xff7a1a, side: THREE.DoubleSide, roughness: 0.9 })); cone.rotation.z = Math.PI / 2; cone.position.x = 0.9; sock.add(cone);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.5, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9 })); stripe.rotation.z = Math.PI / 2; stripe.position.x = 0.9; sock.add(stripe);
  scene.add(sock); ctx.animate.push((dt, t) => { sock.rotation.y = 1.2 + Math.sin(t * 0.4) * 0.5; sock.rotation.z = -0.25 + Math.sin(t * 1.7) * 0.08; });

  // Fence: posts every 5 m with two rails, an opening on the approach road.
  const fx0 = 770, fx1 = 1545, fz0 = 3090, fz1 = 3265; const parts = [];
  const seg = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); const n = Math.round(len / 5); for (let i = 0; i <= n; i++) { const t = i / n; parts.push(cyl(0.05, 0.06, 1.5, 5, 0xb0b6be, { x: x0 + (x1 - x0) * t, y: 0.75, z: z0 + (z1 - z0) * t })); } const rot = Math.atan2(-(z1 - z0), x1 - x0); for (const y of [0.6, 1.3]) { const b = box(len, 0.06, 0.06, 0xb0b6be, { y: 0 }); b.rotateY(rot); b.translate((x0 + x1) / 2, y, (z0 + z1) / 2); parts.push(b); } };
  seg(fx0, fz0, 1490, fz0); seg(1510, fz0, fx1, fz0); seg(fx0, fz1, fx1, fz1); seg(fx0, fz0, fx0, fz1); seg(fx1, fz0, fx1, fz1);
  const fence = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 })); fence.name = 'airstrip-fence'; scene.add(fence);
  colliders.add(fx0 - 0.2, fz0 - 0.2, 1490, fz0 + 0.2, 'sign', null, 1.5); colliders.add(1510, fz0 - 0.2, fx1 + 0.2, fz0 + 0.2, 'sign', null, 1.5); colliders.add(fx0 - 0.2, fz1 - 0.2, fx1 + 0.2, fz1 + 0.2, 'sign', null, 1.5);
  colliders.add(fx0 - 0.2, fz0, fx0 + 0.2, fz1, 'sign', null, 1.5); colliders.add(fx1 - 0.2, fz0, fx1 + 0.2, fz1, 'sign', null, 1.5);
  // Direction sign at the gate.
  const gs = textBoard(4, 1, ['GVP AIRSTRIP  →'], '#1e4fa3', '#ffffff', 'bold 60px Inter, sans-serif'); gs.position.set(1509, 2.6, S + 30); gs.rotation.y = Math.PI; scene.add(gs);
  const gpost = new THREE.Mesh(cyl(0.05, 0.06, 2.2, 6, 0x8b949e, { x: 1509, y: 1.1, z: S + 30 }), new THREE.MeshStandardMaterial({ vertexColors: true })); scene.add(gpost);
}
