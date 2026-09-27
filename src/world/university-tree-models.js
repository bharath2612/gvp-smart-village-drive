import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLTF } from './models.js';
import { instancedChunks } from './instancing.js';
import { cyl, ico, merge } from './geo.js';

const NAMES = ['broadleaf_mature', 'woodland_tall', 'broadleaf_spreading'];

// Keep the Blender vertex colours; the older palette baker replaces them.
function geometryOf(gltf) {
  const parts = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(node => {
    if (!node.isMesh) return;
    let geo = node.geometry.clone().applyMatrix4(node.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    const source = geo.getAttribute('color');
    const colors = new Float32Array(geo.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length / 3; i++) {
      colors[i * 3] = source ? source.getX(i) : node.material.color.r;
      colors[i * 3 + 1] = source ? source.getY(i) : node.material.color.g;
      colors[i * 3 + 2] = source ? source.getZ(i) : node.material.color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (const key of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(key)) geo.deleteAttribute(key);
    geo.morphAttributes = {};
    parts.push(geo);
  });
  const merged = mergeGeometries(parts);
  merged.computeBoundingBox(); merged.computeBoundingSphere();
  return merged;
}

export async function loadUniversityTrees() {
  try {
    return await Promise.all(NAMES.map(async name => {
      const [hi, mid] = await Promise.all(['static', 'lod'].map(level => loadGLTF(`/models/university/${name}_${level}.glb`)));
      return { name, hi: geometryOf(hi), mid: geometryOf(mid) };
    }));
  } catch (error) {
    console.warn('[university trees] Using existing trees because an asset failed to load.', error);
    return null;
  }
}

function windMaterials(ctx) {
  const time = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, side: THREE.DoubleSide });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  const patch = shader => {
    shader.uniforms.uForestTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uForestTime;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 groveOrigin = vec2(0.0);
      #ifdef USE_INSTANCING
        groveOrigin = instanceMatrix[3].xz;
      #endif
      float phase = dot(groveOrigin, vec2(.047, .061));
      float bend = pow(clamp(position.y / 20.0, 0.0, 1.5), 2.0);
      transformed.x += .20 * bend * sin(uForestTime * 1.57 + phase);
      transformed.z += .08 * bend * sin(uForestTime * 1.57 + phase + .7);
    `);
  };
  material.onBeforeCompile = patch; depth.onBeforeCompile = patch;
  material.customProgramCacheKey = depth.customProgramCacheKey = () => 'university-breeze-v1';
  ctx.animate.push((_dt, elapsed) => { time.value = elapsed; });
  return { material, depth };
}

function distantTree(index) {
  const height = [16, 20, 15][index], spread = [5.3, 4, 6.4][index];
  const parts = [cyl(.18, .6, height * .72, 6, 0x594936, { y: height * .36 })];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39996, upper = i / 6;
    parts.push(ico(1, 0, [0x46742b, 0x517d32, 0x3d6828][i % 3], {
      x: Math.cos(a) * spread * .42, z: Math.sin(a) * spread * .42,
      y: height * (.55 + upper * .3), sx: spread * .62, sy: height * .19, sz: spread * .62,
    }));
  }
  return merge(parts);
}

export function addUniversityTrees(ctx, root, groups) {
  const { material, depth } = windMaterials(ctx);
  const lods = [];
  groups.forEach((items, i) => {
    if (!items.length) return;
    const index = i % NAMES.length, model = ctx.universityTrees[index];
    const levels = [model.hi, model.mid, distantTree(index)].map((geo, level) => {
      const group = instancedChunks(geo, material, items, { name: `university-reference-trees-${i}-lod${level}`, chunk: 120, castShadow: level === 0, receiveShadow: true });
      group.children.forEach(mesh => { mesh.customDepthMaterial = depth; mesh.boundingSphere.radius += 1; });
      root.add(group); return group;
    });
    for (let j = 0; j < levels[0].children.length; j++) lods.push(levels.map(group => group.children[j]));
  });
  const camera = ctx.camera;
  const highDistance = ctx.qualityName === 'low' ? 15 : 40;
  const midDistance = ctx.qualityName === 'low' ? 110 : 180;
  const update = () => {
    for (const meshes of lods) {
      const sphere = meshes[0].boundingSphere;
      const distance = Math.hypot(camera.position.x - sphere.center.x, camera.position.z - sphere.center.z) - sphere.radius;
      const level = distance < highDistance ? 0 : distance < midDistance ? 1 : 2;
      meshes.forEach((mesh, i) => { mesh.visible = i === level; });
    }
  };
  update(); ctx.animate.push(update);
  ctx.university.referenceTrees = true;
}
