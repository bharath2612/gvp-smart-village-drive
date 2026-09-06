// Small geometry helpers shared by the builders: world-UV planes, vertex-coloured boxes, merging.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function patchGeo(x, z, w, h, tile = 4, y = 0) {
  const g = new THREE.PlaneGeometry(w, h, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(x + w / 2, y, z + h / 2);
  const uv = g.attributes.uv; const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
  return g;
}

const _c = new THREE.Color();
export function box(w, h, d, color, opts = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  // World-scaled UVs so a 3 m tile stays 3 m on every face.
  const uv = g.attributes.uv; const groups = g.groups;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let gi = 0; gi < groups.length; gi++) {
    const gr = groups[gi]; const [su, sv] = dims[gi];
    const idx = g.index; const seen = new Set();
    for (let i = gr.start; i < gr.start + gr.count; i++) { const vi = idx.getX(i); if (seen.has(vi)) continue; seen.add(vi); uv.setXY(vi, uv.getX(vi) * su / 3, uv.getY(vi) * sv / 3); }
  }
  g.clearGroups();
  const col = new Float32Array(g.attributes.position.count * 3);
  _c.set(color);
  for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(opts.x || 0, (opts.y ?? h / 2), opts.z || 0);
  if (opts.rotY) { g.translate(-(opts.x || 0), 0, -(opts.z || 0)); g.rotateY(opts.rotY); g.translate(opts.x || 0, 0, opts.z || 0); }
  return g;
}
export function cyl(rTop, rBot, h, seg, color, opts = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, !!opts.open);
  const col = new Float32Array(g.attributes.position.count * 3); _c.set(color);
  for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(opts.x || 0, (opts.y ?? h / 2), opts.z || 0);
  return g;
}
export function ico(r, detail, color, opts = {}) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const col = new Float32Array(g.attributes.position.count * 3); _c.set(color);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const jitter = opts.jitter ? 1 + (Math.sin(i * 12.9898) * 0.5) * opts.jitter : 1; col[i * 3] = _c.r * jitter; col[i * 3 + 1] = _c.g * jitter; col[i * 3 + 2] = _c.b * jitter; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.scale(opts.sx || 1, opts.sy || 1, opts.sz || 1);
  g.translate(opts.x || 0, opts.y || 0, opts.z || 0);
  return g;
}
export function merge(list) {
  const clean = list.filter(Boolean);
  if (!clean.length) return null;
  // Drop attributes that not every geometry has (e.g. color) so merging never fails.
  const names = ['position', 'normal', 'uv', 'color'].filter((n) => clean.every((g) => g.attributes[n]));
  for (const g of clean) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
  // mergeGeometries needs every input indexed the same way; icosahedra are non-indexed, boxes are indexed.
  const anyNonIndexed = clean.some((g) => !g.index);
  const norm = anyNonIndexed ? clean.map((g) => (g.index ? g.toNonIndexed() : g)) : clean;
  const m = mergeGeometries(norm, false);
  if (!m) throw new Error('merge failed: ' + clean.map((g) => Object.keys(g.attributes).join('/')).join(' | '));
  clean.forEach((g) => g.dispose());
  return m;
}
export function stdMat(T, tex, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: tex ? tex.roughness : 0.9, metalness: 0, ...opts });
  if (tex) { m.map = tex.map; m.normalMap = tex.normalMap; if (opts.normalScale !== undefined) m.normalScale.set(opts.normalScale, opts.normalScale); }
  return m;
}
