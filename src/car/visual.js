import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { box, cyl, merge } from '../world/geo.js';
import { clamp, lerp } from '../util/math.js';

export class CarVisual {
  constructor(scene, T) {
    this.root = new THREE.Group(); this.root.name = 'car';
    this.chassis = new THREE.Group(); this.root.add(this.chassis);
    const brand = CONFIG.brandColor;
    const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 });
    const body = merge([
      box(1.9, 0.62, 4.6, brand, { y: 0.78 }),                    // lower body
      box(1.86, 0.34, 4.3, brand, { y: 1.22, z: 0.1 }),           // upper body / bonnet line
      box(1.78, 0.02, 2.55, brand, { y: 1.98, z: 0.25 }),         // roof
      box(1.9, 0.28, 0.5, 0x2a2d31, { y: 0.55, z: -2.35 }),       // front bumper
      box(1.9, 0.28, 0.5, 0x2a2d31, { y: 0.55, z: 2.35 }),        // rear bumper
      box(1.2, 0.22, 0.06, 0x14171a, { y: 0.92, z: -2.31 }),      // grille
      box(2.0, 0.16, 4.66, 0x1e2124, { y: 0.5 }),                 // sills / underbody
      box(0.08, 0.6, 0.08, brand, { x: 0.9, y: 1.68, z: -0.9 }), box(0.08, 0.6, 0.08, brand, { x: -0.9, y: 1.68, z: -0.9 }),
      box(0.08, 0.6, 0.08, brand, { x: 0.9, y: 1.68, z: 1.35 }), box(0.08, 0.6, 0.08, brand, { x: -0.9, y: 1.68, z: 1.35 }),
      box(0.08, 0.6, 0.08, brand, { x: 0.9, y: 1.68, z: 0.3 }), box(0.08, 0.6, 0.08, brand, { x: -0.9, y: 1.68, z: 0.3 }),
      box(0.4, 0.12, 0.18, 0x2a2d31, { x: 1.05, y: 1.3, z: -0.7 }), box(0.4, 0.12, 0.18, 0x2a2d31, { x: -1.05, y: 1.3, z: -0.7 }), // mirrors
      box(1.4, 0.06, 1.2, 0x2a2d31, { y: 2.02, z: 0.3 }),         // roof rails
    ]);
    const bodyMesh = new THREE.Mesh(body, paint); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; this.chassis.add(bodyMesh);
    const glassG = merge([
      box(1.72, 0.58, 2.5, 0x101820, { y: 1.68, z: 0.25 }),
      (() => { const w = box(1.7, 0.7, 0.06, 0x101820, { y: 1.66, z: -1.05 }); w.rotateX(0.55); w.translate(0, 0.02, 0.06); return w; })(),
    ]);
    const glass = new THREE.Mesh(glassG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.7 })); this.chassis.add(glass);
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff2c0, emissiveIntensity: 0.4 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2a1a, emissiveIntensity: 0.3 });
    for (const sx of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), this.headMat); hl.position.set(sx * 0.62, 1.0, -2.32); this.chassis.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.08), this.tailMat); tl.position.set(sx * 0.66, 1.05, 2.32); this.chassis.add(tl);
    }
    // Wheels
    const tyre = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.95 });
    const hub = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.4, metalness: 0.8 });
    this.wheels = [];
    for (const [x, z, front] of [[-0.86, -1.45, true], [0.86, -1.45, true], [-0.86, 1.45, false], [0.86, 1.45, false]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.38, z);
      const spin = new THREE.Group(); pivot.add(spin);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18), tyre); t.rotation.z = Math.PI / 2; t.castShadow = true; spin.add(t);
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10), hub); hb.rotation.z = Math.PI / 2; spin.add(hb);
      for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), hub); sp.rotation.z = Math.PI / 2; sp.rotation.x = (i / 5) * Math.PI; spin.add(sp); }
      this.root.add(pivot); this.wheels.push({ pivot, spin, front });
    }
    // Headlights (spotlights) only used at night.
    this.spots = [];
    for (const sx of [-1, 1]) {
      const s = new THREE.SpotLight(0xfff1cc, 0, 90, 0.5, 0.5, 1.2); s.position.set(sx * 0.6, 1.0, -2.2); s.target.position.set(sx * 0.6, 0.2, -30);
      this.chassis.add(s); this.chassis.add(s.target); s.visible = false; this.spots.push(s);
    }
    // Dust particles
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
  setNight(on) { this.spots.forEach((s) => { s.visible = on; s.intensity = on ? 400 : 0; }); this.headMat.emissiveIntensity = on ? 2.5 : 0.4; }
  update(dt, car, alpha, input, now) {
    const x = lerp(car.px, car.x, alpha), z = lerp(car.pz, car.z, alpha);
    const yaw = car.pyaw + ((car.yaw - car.pyaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * alpha;
    this.root.position.set(x, 0, z); this.root.rotation.y = -yaw;
    // Chassis pitch / roll / bounce
    const targetPitch = clamp(-car.telemetry.accel * 0.012, -0.035, 0.035);
    const targetRoll = clamp(car.telemetry.latG * 0.006, -0.05, 0.05);
    this.pitch = lerp(this.pitch, targetPitch, 1 - Math.exp(-8 * dt)); this.roll = lerp(this.roll, targetRoll, 1 - Math.exp(-8 * dt));
    this.bounceV += (-this.bounce * 60 - this.bounceV * 9) * dt; this.bounce += this.bounceV * dt;
    this.chassis.rotation.set(this.pitch, 0, this.roll); this.chassis.position.y = this.bounce;
    for (const w of this.wheels) { w.spin.rotation.x = -car.wheelSpin; if (w.front) w.pivot.rotation.y = -car.steer; }
    this.tailMat.emissiveIntensity = input.brake > 0 || (input.handbrake && Math.abs(car.speed) > 1) ? 3 : 0.3;
    // Dust
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
