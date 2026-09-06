// Far landscape seen from the air: a 14 km farmland plain with a ring of low hills 4-7 km out. No colliders.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rng } from '../util/math.js';

function farmlandTexture() {
  const S = 1024; const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const r = rng(99);
  g.fillStyle = '#55803a'; g.fillRect(0, 0, S, S);
  const palette = ['#5f8a3d', '#6f9a44', '#8aa04a', '#a89c4c', '#b8a45a', '#7c6a3e', '#5b7f3a', '#4f7a3c', '#98a352'];
  for (let i = 0; i < 260; i++) { const w = 40 + r() * 170, h = 40 + r() * 170; const x = r() * S, y = r() * S; g.fillStyle = palette[Math.floor(r() * palette.length)]; g.globalAlpha = 0.85; g.fillRect(x, y, w, h); g.globalAlpha = 1; g.strokeStyle = 'rgba(40,60,30,0.55)'; g.lineWidth = 2; g.strokeRect(x, y, w, h); }
  g.strokeStyle = 'rgba(210,205,190,0.7)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); const x = r() * S; g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 300, S); g.stroke(); const y = r() * S; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (r() - 0.5) * 300); g.stroke(); }
  for (let i = 0; i < 1800; i++) { g.fillStyle = 'rgba(30,60,25,0.5)'; g.fillRect(r() * S, r() * S, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

export function buildHorizon(ctx) {
  const { scene } = ctx;
  const S = CONFIG.world.size, P = CONFIG.world.plain; const cx = S / 2, cz = S / 2;
  const tex = farmlandTexture(); tex.repeat.set(P / 1400, P / 1400);
  const plain = new THREE.Mesh(new THREE.PlaneGeometry(P, P), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  plain.rotation.x = -Math.PI / 2; plain.position.set(cx, -0.25, cz); plain.name = 'plain'; scene.add(plain);
  // Hills: annulus 4.3-7 km from the centre with a smooth ridge profile.
  const ri = 4300, ro = 7000, NA = 220, NR = 9;
  const pos = [], col = [], idx = []; const lo = new THREE.Color(0x587a3a), hi = new THREE.Color(0x8c8060), c = new THREE.Color();
  for (let j = 0; j <= NR; j++) { const rr = ri + (ro - ri) * j / NR; const env = Math.sin(Math.PI * j / NR);
    for (let i = 0; i <= NA; i++) { const a = (i / NA) * Math.PI * 2; const n = 0.5 + 0.5 * (0.6 * Math.sin(3 * a + 1) + 0.3 * Math.sin(7 * a + 2) + 0.15 * Math.sin(13 * a + 0.5) + 0.1 * Math.sin(29 * a)); const h = env * (60 + 210 * n);
      pos.push(cx + Math.cos(a) * rr, h - 0.2, cz + Math.sin(a) * rr); c.copy(lo).lerp(hi, Math.min(1, h / 230)); col.push(c.r, c.g, c.b);
      if (j < NR && i < NA) { const k = j * (NA + 1) + i; idx.push(k, k + NA + 1, k + 1, k + 1, k + NA + 1, k + NA + 2); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const hills = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); hills.name = 'hills'; scene.add(hills);
}
