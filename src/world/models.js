// GLTF model loading for instancing: each model is baked into ONE BufferGeometry with vertex colours
// (palette textures are sampled per vertex, flat materials use a natural-colour override), normalised
// to a target height and grounded at y = 0, so it goes straight through instancedChunks().
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { merge } from './geo.js';

const loader = new GLTFLoader();
const cache = new Map();

// Natural palette for Kenney's flat materials (their defaults are toy-like teal/orange).
export const PALETTE = {
  woodBark: 0x6b4a2e, leafsGreen: 0x3f8a3a, leafsDark: 0x2f6e2e, leafsFall: 0xc98a3a, _defaultMat: 0xbfbfbf,
  stone: 0x9a968c, stoneDark: 0x77736a, dirt: 0x8a6a45, grass: 0x5f9a3f, flowerRed: 0xd0413a, flowerYellow: 0xe6c23a, flowerPurple: 0x8a5fc4,
  wood: 0x8b6a45, woodDark: 0x5a4330, metal: 0x9aa0a8, snow: 0xffffff, water: 0x4a90c8,
};

export function loadGLTF(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, (g) => res(g), undefined, rej)));
  return cache.get(url);
}

function samplerFor(material) {
  const map = material.map;
  if (!map || !map.image) return null;
  const img = map.image; const w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, w, h).data;
  const flipY = map.flipY;
  return (u, v) => { u = u - Math.floor(u); v = v - Math.floor(v); const x = Math.min(w - 1, Math.floor(u * w)); const y = Math.min(h - 1, Math.floor((flipY ? 1 - v : v) * h)); const i = (y * w + x) * 4; return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]; };
}

// Bake a loaded gltf scene (or one node) into a single geometry with vertex colours.
export function bakeGeometry(root, opts = {}) {
  root.updateMatrixWorld(true);
  const parts = []; const colorStats = new Map();
  root.traverse((n) => {
    if (!n.isMesh) return;
    if (opts.filter && !opts.filter(n)) return;
    const g = n.geometry.clone().applyMatrix4(n.matrixWorld);
    const mat = Array.isArray(n.material) ? n.material[0] : n.material;
    const count = g.attributes.position.count;
    const col = new Float32Array(count * 3);
    const sampler = samplerFor(mat);
    const uv = g.attributes.uv;
    let base = new THREE.Color(0xffffff);
    if (!sampler) { const ov = opts.palette && opts.palette[mat.name]; base = new THREE.Color(ov !== undefined ? ov : PALETTE[mat.name] !== undefined ? PALETTE[mat.name] : (mat.color || base)); }
    for (let i = 0; i < count; i++) {
      let r = base.r, gg = base.g, b = base.b;
      if (sampler && uv) { [r, gg, b] = sampler(uv.getX(i), uv.getY(i)); }
      // sRGB texture sample -> linear for vertex colours.
      if (sampler) { r = srgbToLinear(r); gg = srgbToLinear(gg); b = srgbToLinear(b); }
      col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
      // Dominant-colour stats ignore dark parts (tyres, glass, underbody) so the car's paint wins.
      if (0.3 * r + 0.59 * gg + 0.11 * b > 0.12) { const key = `${Math.round(r * 40)},${Math.round(gg * 40)},${Math.round(b * 40)}`; colorStats.set(key, (colorStats.get(key) || 0) + 1); }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    parts.push(g);
  });
  const geo = merge(parts);
  // Dominant colour (largest vertex share) - used to find the car's paint colour.
  let dom = null, dn = 0; for (const [k, n] of colorStats) if (n > dn) { dn = n; dom = k.split(',').map((v) => v / 40); }
  return { geo, dominant: dom };
}
const srgbToLinear = (c) => (c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// Recolour every vertex close to `from` (linear rgb) to `to`; keeps shading variation by scaling.
export function recolor(geo, from, to, tol = 0.12, minLum = 0) {
  const col = geo.attributes.color; const t = to.isColor ? to : new THREE.Color(to);
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), g = col.getY(i), b = col.getZ(i);
    if (0.3 * r + 0.59 * g + 0.11 * b < minLum) continue;
    if (Math.abs(r - from[0]) < tol && Math.abs(g - from[1]) < tol && Math.abs(b - from[2]) < tol) col.setXYZ(i, t.r, t.g, t.b);
  }
  col.needsUpdate = true;
}

// Recolour every bright, saturated vertex whose hue is near `fromHue` (0..1); catches two-tone paint jobs.
export function recolorHue(geo, fromHue, to, hueTol = 0.07, minLum = 0.12, minSat = 0.18) {
  const col = geo.attributes.color; const t = to.isColor ? to : new THREE.Color(to); const c = new THREE.Color(); const hsl = { h: 0, s: 0, l: 0 };
  const th = new THREE.Color(); th.copy(t).getHSL(hsl); const targetL = hsl.l;
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.LinearSRGBColorSpace); c.getHSL(hsl);
    if (hsl.l < minLum || hsl.s < minSat) continue;
    let dh = Math.abs(hsl.h - fromHue); dh = Math.min(dh, 1 - dh);
    if (dh > hueTol) continue;
    // Keep the shade relationship (a darker two-tone panel stays darker).
    const out = new THREE.Color().copy(t); const o = { h: 0, s: 0, l: 0 }; out.getHSL(o); out.setHSL(o.h, o.s, Math.max(0.05, Math.min(0.9, targetL * (hsl.l / Math.max(hsl.l, 0.01)) * 1)));
    col.setXYZ(i, out.r, out.g, out.b);
  }
  col.needsUpdate = true;
}
export function hueOf(rgb) { const c = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace); const h = { h: 0, s: 0, l: 0 }; c.getHSL(h); return h; }

// Normalise: scale so the bounding-box height == targetHeight (or length == targetLength), centre on x/z, ground at y = 0.
export function normalise(geo, { height, length, width } = {}) {
  geo.computeBoundingBox(); const bb = geo.boundingBox; const size = new THREE.Vector3(); bb.getSize(size);
  let s = 1;
  if (height) s = height / size.y; else if (length) s = length / size.z; else if (width) s = width / size.x;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(s, s, s);
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return { scale: s, size: size.multiplyScalar(s) };
}

// Load a list of {key, url, height|length, palette?} and return {key: {geo, size}}.
export async function loadModelSet(list, onProgress) {
  const out = {}; let done = 0;
  await Promise.all(list.map(async (m) => {
    try {
      const gltf = await loadGLTF(m.url);
      const { geo, dominant } = bakeGeometry(gltf.scene, { palette: m.palette });
      const { size } = normalise(geo, m);
      out[m.key] = { geo, size, dominant, gltf };
    } catch (e) { console.warn('[models] failed', m.url, e); }
    done++; if (onProgress) onProgress(done / list.length);
  }));
  return out;
}
