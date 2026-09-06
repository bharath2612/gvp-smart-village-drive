import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { box, cyl, merge } from '../world/geo.js';
import { bakeGeometry, recolorPalette, loadGLTF } from '../world/models.js';
import { clamp, lerp } from '../util/math.js';

// Loads the SUV GLTF (override at /models/suv.glb, else the Kenney suv), bakes body + one wheel geometry,
// recolours the paint to the brand colour and returns {body, wheel, wheelPositions, length}.
export async function loadCarModel() {
  const tryUrls = [CONFIG.car.overrideModel, CONFIG.car.model];
  for (const url of tryUrls) {
    try {
      const head = await fetch(url, { method: 'HEAD' }); if (!head.ok || /text\/html/.test(head.headers.get('content-type') || '')) continue;
      const gltf = await loadGLTF(url);
      const scene = gltf.scene; scene.updateMatrixWorld(true);
      // Road wheels are the nodes named wheel-<front|back>-<left|right>. Anything else called "wheel"
      // (Kenney's SUV carries a spare on the tailgate as "wheel-back") stays part of the static body.
      const isRoadWheel = (name) => /wheel[-_ ]?(front|back|rear)[-_ ]?(left|right)/i.test(name);
      const wheelNodes = []; scene.traverse((n) => { if (isRoadWheel(n.name)) wheelNodes.push(n); });
      const underRoadWheel = (n) => { let p = n; while (p) { if (isRoadWheel(p.name)) return true; p = p.parent; } return false; };
      const body = bakeGeometry(scene, { filter: (n) => !underRoadWheel(n) });
      let wheel = null, wheelPositions = [];
      if (wheelNodes.length >= 4) {
        const w0 = wheelNodes.find((n) => /left/i.test(n.name)) || wheelNodes[0]; const inv = new THREE.Matrix4().copy(w0.matrixWorld).invert();
        const wb = bakeGeometry(w0, { filter: () => true }); wb.geo.applyMatrix4(inv); // wheel geometry at its own origin, axle along x
        wheel = wb.geo;
        wheelPositions = wheelNodes.map((n) => { const p = new THREE.Vector3(); n.getWorldPosition(p); return { name: n.name, p }; });
      }
      // Orientation: front wheels are named front-*; make the front point to -Z.
      let flip = false;
      const front = wheelPositions.filter((w) => /front/i.test(w.name)), back = wheelPositions.filter((w) => /back|rear/i.test(w.name));
      if (front.length && back.length) flip = front[0].p.z > back[0].p.z;
      if (flip) { body.geo.rotateY(Math.PI); if (wheel) wheel.rotateY(Math.PI); wheelPositions.forEach((w) => { w.p.x = -w.p.x; w.p.z = -w.p.z; }); }
      // Scale to the configured length, ground at 0, centred on x/z.
      body.geo.computeBoundingBox(); const bb = body.geo.boundingBox; const size = new THREE.Vector3(); bb.getSize(size);
      const s = CONFIG.car.length / size.z;
      const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      body.geo.translate(-cx, 0, -cz); body.geo.scale(s, s, s);
      if (wheel) { wheel.scale(s, s, s); wheelPositions.forEach((w) => { w.p.x = (w.p.x - cx) * s; w.p.y *= s; w.p.z = (w.p.z - cz) * s; }); }
      // Wheel radius from the wheel geometry; ground the body so wheels touch y = 0.
      let wheelR = 0.38, wheelOut = 1; if (wheel) { wheel.computeBoundingBox(); const wb = wheel.boundingBox; wheelR = (wb.max.y - wb.min.y) / 2; wheelOut = Math.sign((wb.min.x + wb.max.x) / 2) || 1; }
      const groundY = wheelPositions.length ? Math.min(...wheelPositions.map((w) => w.p.y)) - wheelR : bb.min.y * s;
      body.geo.translate(0, -groundY, 0); wheelPositions.forEach((w) => { w.p.y -= groundY; });
      // Paint: repaint the palette texture cells matching the dominant body colour with the brand colour.
      let map = null;
      if (body.paletteMap && body.paintColors && body.paintColors.length) map = recolorPalette(body.paletteMap, body.paintColorsWide && body.paintColorsWide.length ? body.paintColorsWide : body.paintColors, CONFIG.brandColor, body.dominant);
      else if (body.paletteMap) map = body.paletteMap;
      body.geo.computeBoundingBox();
      console.log('[car] model', url, 'wheels', wheelPositions.length, 'flip', flip);
      return { body: body.geo, wheel, wheelPositions, wheelR, wheelOut, bbox: body.geo.boundingBox, map, wheelMap: body.paletteMap };
    } catch (e) { console.warn('[car] failed', url, e); }
  }
  return null;
}

export class CarVisual {
  constructor(scene, T, model) {
    this.root = new THREE.Group(); this.root.name = 'car';
    this.chassis = new THREE.Group(); this.root.add(this.chassis);
    const brand = CONFIG.brandColor;
    this.wheels = [];
    let bbox;
    if (model) {
      const paint = model.map ? new THREE.MeshStandardMaterial({ map: model.map, roughness: 0.4, metalness: 0.3 }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 });
      const bodyMesh = new THREE.Mesh(model.body, paint); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; this.chassis.add(bodyMesh);
      bbox = model.bbox;
      const wheelMat = model.wheelMap ? new THREE.MeshStandardMaterial({ map: model.wheelMap, roughness: 0.8, metalness: 0.2 }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.2 });
      const wp = model.wheelPositions.length >= 4 ? model.wheelPositions : [[-0.86, -1.45], [0.86, -1.45], [-0.86, 1.45], [0.86, 1.45]].map(([x, z], i) => ({ name: i < 2 ? 'front' : 'back', p: new THREE.Vector3(x, 0.38, z) }));
      for (const w of wp) {
        const pivot = new THREE.Group(); pivot.position.copy(w.p);
        const spin = new THREE.Group(); pivot.add(spin);
        const mesh = new THREE.Mesh(model.wheel || new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18).rotateZ(Math.PI / 2), model.wheel ? wheelMat : new THREE.MeshStandardMaterial({ color: 0x15171a }));
        // The baked wheel's hub offset points one way; mirror it for wheels on the other side of the car.
        if (model.wheel && Math.sign(w.p.x) !== model.wheelOut) mesh.scale.x = -1;
        mesh.castShadow = true; spin.add(mesh);
        this.root.add(pivot); this.wheels.push({ pivot, spin, front: /front/i.test(w.name), r: model.wheelR });
      }
    } else {
      const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 });
      const body = merge([box(1.9, 0.62, 4.6, brand, { y: 0.78 }), box(1.86, 0.34, 4.3, brand, { y: 1.22, z: 0.1 }), box(1.78, 0.02, 2.55, brand, { y: 1.98, z: 0.25 }), box(1.9, 0.28, 0.5, 0x2a2d31, { y: 0.55, z: -2.35 }), box(1.9, 0.28, 0.5, 0x2a2d31, { y: 0.55, z: 2.35 }), box(2.0, 0.16, 4.66, 0x1e2124, { y: 0.5 })]);
      const bodyMesh = new THREE.Mesh(body, paint); bodyMesh.castShadow = true; this.chassis.add(bodyMesh);
      const glass = new THREE.Mesh(box(1.72, 0.58, 2.5, 0x101820, { y: 1.68, z: 0.25 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.7 })); this.chassis.add(glass);
      bbox = new THREE.Box3(new THREE.Vector3(-0.95, 0, -2.3), new THREE.Vector3(0.95, 2.0, 2.3));
      const tyre = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.95 });
      for (const [x, z, front] of [[-0.86, -1.45, true], [0.86, -1.45, true], [-0.86, 1.45, false], [0.86, 1.45, false]]) {
        const pivot = new THREE.Group(); pivot.position.set(x, 0.38, z); const spin = new THREE.Group(); pivot.add(spin);
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18), tyre); t.rotation.z = Math.PI / 2; t.castShadow = true; spin.add(t);
        this.root.add(pivot); this.wheels.push({ pivot, spin, front, r: 0.38 });
      }
    }
    // Lights placed from the bounding box.
    const frontZ = bbox.min.z, backZ = bbox.max.z, hy = bbox.min.y + (bbox.max.y - bbox.min.y) * 0.42, hx = (bbox.max.x - bbox.min.x) * 0.33;
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff2c0, emissiveIntensity: 0.4 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2a1a, emissiveIntensity: 0.3 });
    for (const sx of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), this.headMat); hl.position.set(sx * hx, hy, frontZ + 0.12); this.chassis.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), this.tailMat); tl.position.set(sx * hx, hy + 0.05, backZ - 0.12); this.chassis.add(tl);
    }
    this.spots = [];
    for (const sx of [-1, 1]) {
      const s = new THREE.SpotLight(0xfff1cc, 0, 80, 0.42, 0.6, 1.4); s.position.set(sx * hx, hy, frontZ + 0.1); s.target.position.set(sx * hx, 0.2, frontZ - 30);
      this.chassis.add(s); this.chassis.add(s.target); s.visible = false; this.spots.push(s);
    }
    const N = 240; this.dustN = N;
    const pos = new Float32Array(N * 3); const life = new Float32Array(N).fill(-1);
    this.dustGeo = new THREE.BufferGeometry(); this.dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustLife = life; this.dustVel = new Float32Array(N * 3);
    const mat = new THREE.PointsMaterial({ color: 0xc9b58f, size: 1.6, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true });
    this.dust = new THREE.Points(this.dustGeo, mat); this.dust.frustumCulled = false; scene.add(this.dust);
    this.dustNext = 0;
    this.bounce = 0; this.bounceV = 0; this.pitch = 0; this.roll = 0;
    scene.add(this.root);
  }
  setNight(on) { this.spots.forEach((s) => { s.visible = on; s.intensity = on ? 180 : 0; }); this.headMat.emissiveIntensity = on ? 2.5 : 0.4; }
  update(dt, car, alpha, input, now) {
    const x = lerp(car.px, car.x, alpha), z = lerp(car.pz, car.z, alpha);
    const yaw = car.pyaw + ((car.yaw - car.pyaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * alpha;
    this.root.position.set(x, 0, z); this.root.rotation.y = -yaw;
    const targetPitch = clamp(-car.telemetry.accel * 0.012, -0.035, 0.035);
    const targetRoll = clamp(car.telemetry.latG * 0.006, -0.05, 0.05);
    this.pitch = lerp(this.pitch, targetPitch, 1 - Math.exp(-8 * dt)); this.roll = lerp(this.roll, targetRoll, 1 - Math.exp(-8 * dt));
    this.bounceV += (-this.bounce * 60 - this.bounceV * 9) * dt; this.bounce += this.bounceV * dt;
    this.chassis.rotation.set(this.pitch, 0, this.roll); this.chassis.position.y = this.bounce;
    for (const w of this.wheels) { w.spin.rotation.x = -car.wheelSpin * (0.38 / w.r); if (w.front) w.pivot.rotation.y = -car.steer; }
    this.tailMat.emissiveIntensity = input.brake > 0 || (input.handbrake && Math.abs(car.speed) > 1) ? 3 : 0.3;
    const speed = Math.abs(car.speed);
    if (car.offroad && speed > 4) {
      const n = Math.min(4, Math.floor(speed / 6) + 1);
      for (let i = 0; i < n; i++) { const k = this.dustNext = (this.dustNext + 1) % this.dustN; const r = car.right(); const s = i % 2 ? 1 : -1; const p = this.dustGeo.attributes.position.array;
        p[k * 3] = car.x + r.x * s * 0.9 - car.forward().x * 2; p[k * 3 + 1] = 0.3; p[k * 3 + 2] = car.z + r.z * s * 0.9 - car.forward().z * 2;
        this.dustVel[k * 3] = (Math.random() - 0.5) * 2 - car.vx * 0.05; this.dustVel[k * 3 + 1] = 1.5 + Math.random(); this.dustVel[k * 3 + 2] = (Math.random() - 0.5) * 2 - car.vz * 0.05; this.dustLife[k] = 1.2; }
    }
    const p = this.dustGeo.attributes.position.array;
    for (let k = 0; k < this.dustN; k++) { if (this.dustLife[k] <= 0) { p[k * 3 + 1] = -50; continue; } this.dustLife[k] -= dt; p[k * 3] += this.dustVel[k * 3] * dt; p[k * 3 + 1] += this.dustVel[k * 3 + 1] * dt; p[k * 3 + 2] += this.dustVel[k * 3 + 2] * dt; this.dustVel[k * 3 + 1] -= 1.2 * dt; }
    this.dustGeo.attributes.position.needsUpdate = true;
  }
  kick(strength) { this.bounceV += strength * 3; }
}
