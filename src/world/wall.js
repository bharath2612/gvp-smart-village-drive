import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { box, merge, stdMat } from './geo.js';
import { instancedChunks } from './instancing.js';

export function buildWall(ctx) {
  const { scene, T, colliders } = ctx;
  const S = CONFIG.world.size, H = CONFIG.world.wallHeight, TH = CONFIG.world.wallThickness;
  const gx = CONFIG.world.gate.x, gateW = 14;
  const parts = [];
  // North, west, east walls full length; south wall in two pieces around the gate.
  parts.push(box(S + TH * 2, H, TH, 0xd8d3c8, { x: S / 2, z: -TH / 2 }));
  parts.push(box(TH, H, S, 0xd8d3c8, { x: -TH / 2, z: S / 2 }));
  parts.push(box(TH, H, S, 0xd8d3c8, { x: S + TH / 2, z: S / 2 }));
  parts.push(box(gx - gateW / 2, H, TH, 0xd8d3c8, { x: (gx - gateW / 2) / 2, z: S + TH / 2 }));
  parts.push(box(S - gx - gateW / 2, H, TH, 0xd8d3c8, { x: gx + gateW / 2 + (S - gx - gateW / 2) / 2, z: S + TH / 2 }));
  // Coping strip on top.
  parts.push(box(S + 1, 0.25, TH + 0.4, 0xbfb9ad, { x: S / 2, y: H + 0.12, z: -TH / 2 }));
  parts.push(box(S + 1, 0.25, TH + 0.4, 0xbfb9ad, { x: S / 2, y: H + 0.12, z: S + TH / 2 }));
  parts.push(box(TH + 0.4, 0.25, S + 1, 0xbfb9ad, { x: -TH / 2, y: H + 0.12, z: S / 2 }));
  parts.push(box(TH + 0.4, 0.25, S + 1, 0xbfb9ad, { x: S + TH / 2, y: H + 0.12, z: S / 2 }));
  const wall = new THREE.Mesh(merge(parts), stdMat(T, T.concrete, { vertexColors: true }));
  wall.castShadow = true; wall.receiveShadow = true; wall.name = 'wall'; scene.add(wall);

  // Pilasters every 10 m.
  const pil = box(0.9, H + 0.4, 0.9, 0xcfc9bd);
  const items = [];
  for (let t = 0; t <= S; t += 10) {
    items.push({ x: t, z: -TH / 2 }); items.push({ x: -TH / 2, z: t }); items.push({ x: S + TH / 2, z: t });
    if (Math.abs(t - gx) > gateW / 2 + 2) items.push({ x: t, z: S + TH / 2 });
  }
  scene.add(instancedChunks(pil, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), items, { name: 'pilasters', castShadow: true }));

  // Colliders: 2 m deep outward so a boosted car can never tunnel.
  colliders.add(-2, -2, S + 2, 0, 'wall'); colliders.add(-2, S, S + 2, S + 2, 'wall');
  colliders.add(-2, -2, 0, S + 2, 'wall'); colliders.add(S, -2, S + 2, S + 2, 'wall');

  // Gate house: two pillars, a lintel with the village name, closed steel gate leaves.
  const gate = [];
  for (const sx of [-1, 1]) gate.push(box(3, 9, 3, 0xe4dccd, { x: gx + sx * (gateW / 2 + 1.5), z: S }));
  gate.push(box(gateW + 6, 1.6, 3.2, 0xd6c9b0, { x: gx, y: 9.2, z: S }));
  gate.push(box(gateW + 6.4, 0.5, 3.6, 0xc9a227, { x: gx, y: 10.2, z: S }));
  for (const sx of [-1, 1]) gate.push(box(3.4, 0.4, 3.4, 0xc9a227, { x: gx + sx * (gateW / 2 + 1.5), y: 9.1, z: S }));
  const gateMesh = new THREE.Mesh(merge(gate), stdMat(T, T.plaster, { vertexColors: true }));
  gateMesh.castShadow = true; gateMesh.receiveShadow = true; scene.add(gateMesh);
  const leaves = new THREE.Mesh(merge([
    box(gateW / 2 - 0.3, 5.5, 0.15, 0x2c3238, { x: gx - gateW / 4, y: 3, z: S }),
    box(gateW / 2 - 0.3, 5.5, 0.15, 0x2c3238, { x: gx + gateW / 4, y: 3, z: S }),
    ...Array.from({ length: 12 }, (_, i) => box(0.12, 5.9, 0.3, 0x14181c, { x: gx - gateW / 2 + 0.6 + i * (gateW - 1.2) / 11, y: 3.1, z: S })),
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.7 }));
  leaves.castShadow = true; scene.add(leaves);
  colliders.add(gx - gateW / 2 - 3.2, S - 1.6, gx - gateW / 2, S + 2, 'gate');
  colliders.add(gx + gateW / 2, S - 1.6, gx + gateW / 2 + 3.2, S + 2, 'gate');
  colliders.add(gx - gateW / 2, S - 0.3, gx + gateW / 2, S + 2, 'gate');
  // Name board (canvas text) facing into the village.
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#0a0f1c'; g.fillRect(0, 0, 1024, 128); g.fillStyle = '#c9a227'; g.font = 'bold 72px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GVP SMART VILLAGE', 512, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshStandardMaterial({ map: tex, emissive: 0x111111 }));
  board.position.set(gx, 9.2, S - 1.65); board.rotation.y = Math.PI; scene.add(board);
  const board2 = board.clone(); board2.position.z = S + 1.65; board2.rotation.y = 0; scene.add(board2);
}
