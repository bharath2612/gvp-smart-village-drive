// Bare soil outside the university loop, extending to the distant dry hills. No colliders.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {patchGeo,stdMat} from './geo.js';

export function buildHorizon(ctx) {
  const { scene } = ctx;
  const S = CONFIG.world.size, P = CONFIG.world.plain; const cx = S / 2, cz = S / 2;
  const plain=new THREE.Mesh(patchGeo(cx-P/2,cz-P/2,P,P,18,-.015),stdMat(ctx.T,ctx.T.soil,{color:0xd5c8b8}));plain.name='plain';plain.receiveShadow=true;scene.add(plain);
  // Hills: annulus 4.3-7 km from the centre with a smooth ridge profile.
  const ri = 4300, ro = 7000, NA = 220, NR = 9;
  const pos = [], col = [], idx = []; const lo = new THREE.Color(0x927b5e), hi = new THREE.Color(0xb7a48b), c = new THREE.Color();
  for (let j = 0; j <= NR; j++) { const rr = ri + (ro - ri) * j / NR; const env = Math.sin(Math.PI * j / NR);
    for (let i = 0; i <= NA; i++) { const a = (i / NA) * Math.PI * 2; const n = 0.5 + 0.5 * (0.6 * Math.sin(3 * a + 1) + 0.3 * Math.sin(7 * a + 2) + 0.15 * Math.sin(13 * a + 0.5) + 0.1 * Math.sin(29 * a)); const h = env * (60 + 210 * n);
      pos.push(cx + Math.cos(a) * rr, h - 0.2, cz + Math.sin(a) * rr); c.copy(lo).lerp(hi, Math.min(1, h / 230)); col.push(c.r, c.g, c.b);
      if (j < NR && i < NA) { const k = j * (NA + 1) + i; idx.push(k, k + NA + 1, k + 1, k + 1, k + NA + 1, k + NA + 2); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const hills = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); hills.name = 'hills'; scene.add(hills);
}
