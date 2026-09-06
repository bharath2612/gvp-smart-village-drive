// Splits a set of instance transforms into spatial chunks so Three.js frustum-culls each chunk.
import * as THREE from 'three';
const _m = new THREE.Matrix4();
export function instancedChunks(geometry, material, items, opts = {}) {
  const chunk = opts.chunk || 400;
  const groups = new Map();
  for (const it of items) { const k = `${Math.floor(it.x / chunk)},${Math.floor(it.z / chunk)}`; (groups.get(k) || groups.set(k, []).get(k)).push(it); }
  const root = new THREE.Group(); root.name = opts.name || 'instanced';
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const list of groups.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    mesh.castShadow = !!opts.castShadow; mesh.receiveShadow = !!opts.receiveShadow;
    let hasColor = false;
    list.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot || 0);
      p.set(it.x, it.y || 0, it.z);
      s.set(it.sx || 1, it.sy || 1, it.sz || 1);
      _m.compose(p, q, s);
      mesh.setMatrixAt(i, _m);
      if (it.color) { mesh.setColorAt(i, it.color); hasColor = true; }
      if (opts.onInstance) opts.onInstance(mesh, i, it);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (hasColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  return root;
}
