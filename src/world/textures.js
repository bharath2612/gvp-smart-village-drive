// Procedural PBR-ish textures drawn on canvases (albedo + normal from height). Deterministic, zero download.
import * as THREE from 'three';
import { rng } from '../util/math.js';

function valueNoise(size, seed, octaves = 4, base = 8) {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    const grid = new Float32Array((cells + 1) * (cells + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells;
      const x0 = Math.floor(fx) % cells, y0 = Math.floor(fy) % cells, x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
      const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = grid[y0 * (cells + 1) + x0], b = grid[y0 * (cells + 1) + x1], c = grid[y1 * (cells + 1) + x0], d = grid[y1 * (cells + 1) + x1];
      out[y * size + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function toTexture(canvas, srgb, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function normalFromHeight(height, size, strength) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size); const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = height[y * size + ((x - 1 + size) % size)], r = height[y * size + ((x + 1) % size)];
    const u = height[((y - 1 + size) % size) * size + x], dn = height[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}

function paint(size, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size); const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; const [r, g, b] = fn(x, y, y * size + x); d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0); return { canvas: c, ctx };
}

function material(size, seed, colorFn, opts = {}) {
  const n1 = valueNoise(size, seed, opts.octaves || 5, opts.base || 6);
  const n2 = valueNoise(size, seed + 7, 3, 24);
  const height = new Float32Array(size * size);
  const { canvas } = paint(size, (x, y, i) => { const h = n1[i] * 0.7 + n2[i] * 0.3; height[i] = opts.height ? opts.height(h, n1[i], n2[i], x, y) : h; return colorFn(h, n1[i], n2[i], x, y); });
  if (opts.draw) opts.draw(canvas.getContext('2d'), size, height);
  const map = toTexture(canvas, true, opts.repeat || 1);
  const normalMap = toTexture(normalFromHeight(height, size, opts.normalStrength || 6), false, opts.repeat || 1);
  return { map, normalMap, roughness: opts.roughness ?? 0.9 };
}

export function buildTextures(quality = 'medium') {
  const S = quality === 'low' ? 256 : 512;
  const T = {};
  T.asphalt = material(S, 11, (h, a, b) => { const v = 52 + h * 40 + (b - 0.5) * 14; return [v, v, v + 2]; }, { normalStrength: 4, roughness: 0.85 });
  T.concrete = material(S, 12, (h, a, b) => { const v = 150 + h * 45 + (b - 0.5) * 12; return [v, v - 2, v - 6]; }, { normalStrength: 3, roughness: 0.8 });
  T.grass = material(S, 13, (h, a, b) => [58 + h * 60 + (b - 0.5) * 20, 95 + h * 70 + (b - 0.5) * 18, 30 + h * 30], { normalStrength: 5, base: 10, roughness: 1 });
  T.lawn = material(S, 14, (h, a, b) => [70 + h * 50, 125 + h * 60 + (b - 0.5) * 18, 40 + h * 25], { normalStrength: 4, base: 10, roughness: 1 });
  T.soil = material(S, 15, (h, a, b) => [110 + h * 50 + (b - 0.5) * 20, 78 + h * 40, 48 + h * 25], { normalStrength: 6, roughness: 1 });
  T.crop = material(S, 16, (h, a, b, x, y) => { const row = Math.abs(((y / S) * 12) % 1 - 0.5) < 0.2; return row ? [60 + h * 40, 110 + h * 50, 35] : [95 + h * 45, 70 + h * 30, 42]; },
    { normalStrength: 6, roughness: 1, height: (h, a, b, x, y) => (Math.abs(((y / S) * 12) % 1 - 0.5) < 0.2 ? 0.8 : 0.2) + h * 0.3 });
  T.plaster = material(S, 17, (h, a, b) => { const v = 225 + h * 25; return [v, v - 4, v - 12]; }, { normalStrength: 2, roughness: 0.75 });
  T.stone = material(S, 18, (h, a, b, x, y) => { const mortar = ((x % 64) < 3) || ((y % 32) < 3 && ((Math.floor(y / 32) % 2) ? (x + 32) % 64 < 3 : true) === false) ? 0 : 1; const v = mortar ? 150 + h * 50 : 90; return [v, v - 12, v - 30]; }, { normalStrength: 5, roughness: 0.9 });
  T.paving = material(S, 19, (h, a, b, x, y) => { const g = ((x % 64) < 2 || (y % 64) < 2) ? 0.55 : 1; const v = (175 + h * 40) * g; return [v, v - 3, v - 10]; }, { normalStrength: 4, roughness: 0.85 });
  T.roof = material(S, 20, (h, a, b) => { const v = 120 + h * 40; return [v, v - 5, v - 12]; }, { normalStrength: 5, roughness: 0.95 });
  T.metal = material(S, 21, (h, a, b, x) => { const rib = (x % 32) < 6 ? 0.8 : 1; const v = (170 + h * 30) * rib; return [v, v + 2, v + 6]; }, { normalStrength: 6, roughness: 0.5 });
  T.sand = material(S, 22, (h, a, b) => [200 + h * 40, 185 + h * 35, 140 + h * 30], { normalStrength: 2, roughness: 1 });
  T.track = material(S, 23, (h, a, b) => [150 + h * 40, 70 + h * 25, 50 + h * 20], { normalStrength: 3, roughness: 1 });
  // Water normal map: two overlapping ripple fields.
  const wn = valueNoise(S, 31, 4, 8); const wn2 = valueNoise(S, 32, 3, 20);
  const wh = new Float32Array(S * S); for (let i = 0; i < wh.length; i++) wh[i] = wn[i] * 0.6 + wn2[i] * 0.4;
  T.waterNormal = toTexture(normalFromHeight(wh, S, 10), false, 1);
  T.waterNormal2 = toTexture(normalFromHeight(wh, S, 10), false, 1);
  return T;
}
