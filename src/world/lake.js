import * as THREE from 'three';

export function buildLake(ctx) {
  const { scene, world, T } = ctx;
  const pts = world.lake.points;
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(shape); g.rotateX(Math.PI / 2); // shape (x, y) -> (x, -z); flip so y maps to +z
  g.scale(1, 1, -1);
  const uv = g.attributes.uv; const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 40, pos.getZ(i) / 40);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b6c8a, roughness: 0.12, metalness: 0.05, normalMap: T.waterNormal, transparent: true, opacity: 0.94, envMapIntensity: 0.5 });
  mat.normalScale.set(0.55, 0.55);
  const water = new THREE.Mesh(g, mat); water.position.y = 0.09; water.name = 'lake'; water.receiveShadow = true; scene.add(water);
  // Shore rim: dark wet band just above the sand.
  const rim = new THREE.Mesh(g.clone(), new THREE.MeshStandardMaterial({ color: 0x6f6a5b, roughness: 1 })); rim.position.y = 0.05; rim.scale.set(1.006, 1, 1.006);
  const c = world.lake.bbox; rim.position.x = -(c.x + c.w / 2) * 0.006; rim.position.z = -(c.y + c.h / 2) * 0.006; scene.add(rim);
  ctx.waterMat = mat;
  ctx.animate = ctx.animate || [];
  ctx.animate.push((dt, t) => { mat.normalMap.offset.set(t * 0.012, t * 0.008); if (ctx.poolMat) ctx.poolMat.normalMap.offset.set(t * 0.02, -t * 0.015); });
}
