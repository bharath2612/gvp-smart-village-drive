// Motor boat: arcade water physics kept inside the lake polygon, a detailed procedural boat, wake and spray.
import * as THREE from 'three';
import { box, cyl, merge } from '../world/geo.js';
import { clamp, lerp, pointInPolygon } from '../util/math.js';

export class BoatModel {
  constructor(ctx) {
    this.ctx = ctx; this.halfL = 3.1; this.halfW = 1.2;
    this.reset(ctx.marina.pierEnd.x, ctx.marina.pierEnd.z, ctx.marina.pierEnd.yaw);
    this.events = []; this.time = 0; this.telemetry = { slip: 0, latG: 0, accel: 0, impact: 0 };
    this.boostCharge = 1; this.boosting = false; this.steerMax = 0.6; this.offroad = false; this.hedge = false; this.wheelSpin = 0; this.stuck = 0; this.frozen = false; this.handbrakeOn = false;
  }
  reset(x, z, yaw) { this.x = x; this.z = z; this.yaw = yaw; this.px = x; this.pz = z; this.pyaw = yaw; this.vx = 0; this.vz = 0; this.steer = 0; this.rpm = 0; }
  get speed() { const f = this.forward(); return this.vx * f.x + this.vz * f.z; }
  get absSpeed() { return Math.hypot(this.vx, this.vz); }
  forward() { return { x: Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  right() { return { x: Math.cos(this.yaw), z: Math.sin(this.yaw) }; }
  samplePoints() { const f = this.forward(), r = this.right(); const p = []; for (const [a, b] of [[1, 0], [-1, 0.9], [-1, -0.9], [0, 0]]) p.push({ x: this.x + f.x * this.halfL * a + r.x * this.halfW * b, z: this.z + f.z * this.halfL * a + r.z * this.halfW * b }); return p; }
  step(dt, input) {
    this.px = this.x; this.pz = this.z; this.pyaw = this.yaw; this.time += dt;
    if (this.frozen) return;
    const f = this.forward(), r = this.right();
    let vF = this.vx * f.x + this.vz * f.z, vL = this.vx * r.x + this.vz * r.z;
    const MAX = 14, ACC = 6.5;
    let a = 0;
    if (input.throttle) a += ACC * Math.max(0.15, 1 - (vF / MAX) * (vF / MAX));
    if (input.brake) a -= vF > 0.3 ? 5 : (vF > -3 ? 2.2 : 0);
    a -= 0.18 * vF * Math.abs(vF) / MAX + 0.4 * Math.sign(vF) * Math.min(Math.abs(vF) / dt, 1);
    const prev = vF; vF += a * dt; this.telemetry.accel = (vF - prev) / dt;
    // Steering: rudder needs way on; boats slide.
    const target = input.steer * 0.6; const rate = 2.5 * dt; this.steer += clamp(target - this.steer, -rate, rate);
    const yawRate = this.steer * 1.1 * clamp(vF / 6, -0.6, 1);
    this.yaw += yawRate * dt;
    vL *= 0.975; this.telemetry.slip = clamp(Math.abs(vL) / 4, 0, 1); this.telemetry.latG = vF * yawRate;
    const f2 = this.forward(), r2 = this.right();
    this.vx = f2.x * vF + r2.x * vL; this.vz = f2.z * vF + r2.z * vL;
    // Move, then keep every sample point inside the lake and outside obstacles (slide along the shore).
    const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const ok = (x, z) => { const sx = x - this.x, sz = z - this.z; return this.samplePoints().every((p) => this.free(p.x + sx, p.z + sz)); };
    if (ok(nx, nz)) { this.x = nx; this.z = nz; }
    else if (ok(nx, this.z)) { this.x = nx; this.vz *= -0.2; this.bump(); }
    else if (ok(this.x, nz)) { this.z = nz; this.vx *= -0.2; this.bump(); }
    else { this.vx *= -0.3; this.vz *= -0.3; this.bump(); }
    this.rpm = lerp(this.rpm, input.throttle ? 0.4 + Math.min(1, Math.abs(vF) / MAX) * 0.6 : 0.15 + Math.min(1, Math.abs(vF) / MAX) * 0.3, dt * 3);
  }
  free(x, z) {
    if (!pointInPolygon(x, z, this.ctx.lakePolygon)) return false;
    for (const o of this.ctx.lakeObstacles) if (Math.hypot(o.x - x, o.z - z) < o.r) return false;
    return true;
  }
  bump() { const s = Math.min(1, this.absSpeed / 8); if (s > 0.15) this.events.push({ type: 'impact', strength: s * 0.5 }); }
  takeEvents() { const e = this.events; this.events = []; return e; }
}

export class BoatVisual {
  constructor(scene, ctx) {
    this.scene = scene; this.root = new THREE.Group(); this.root.name = 'boat'; this.hull = new THREE.Group(); this.root.add(this.hull);
    const W = 0xf4f4f0, BLUE = 0x1e4fa3, TEAK = 0xa87a4a, DARK = 0x2a2f36, CHROME = 0xd8dde2, GLASS = 0x8fb0c8;
    const L = [], G = [];
    // Hull: stacked tapered sections (bow at -Z), keel, chine stripe.
    const hullShape = new THREE.Shape([[-1.25, 3.0], [-1.3, 1.0], [-1.15, -1.2], [-0.6, -2.7], [0, -3.1], [0.6, -2.7], [1.15, -1.2], [1.3, 1.0], [1.25, 3.0]].map(([x, z]) => new THREE.Vector2(x, z)));
    const deck = new THREE.ExtrudeGeometry(hullShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.22, bevelSegments: 2 }); deck.rotateX(Math.PI / 2); deck.translate(0, 1.15, 0);
    const col = (geo, hex) => { const c = new THREE.Color(hex); const arr = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return geo; };
    L.push(col(deck, W));
    const lower = new THREE.ExtrudeGeometry(hullShape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2 }); lower.rotateX(Math.PI / 2); lower.scale(0.86, 1, 0.97); lower.translate(0, 0.55, 0.1); L.push(col(lower, BLUE));
    L.push(box(2.2, 0.06, 5.2, TEAK, { y: 1.18, z: 0.3 }));                      // teak deck
    L.push(box(2.3, 0.35, 2.0, W, { y: 1.35, z: 0.6 }));                          // console base
    L.push(box(1.6, 0.6, 0.5, DARK, { y: 1.75, z: -0.3 }));                       // dashboard
    G.push(box(2.2, 0.7, 0.06, GLASS, { y: 2.05, z: -0.65 }));                    // windscreen
    L.push(box(2.3, 0.05, 0.08, CHROME, { y: 2.42, z: -0.65 }));
    L.push(cyl(0.22, 0.22, 0.05, 12, DARK, { y: 1.95, z: -0.2 }));                // wheel
    for (const sx of [-0.55, 0.55]) { L.push(box(0.8, 0.5, 0.8, 0x2a3a5a, { x: sx, y: 1.45, z: 0.6 })); L.push(box(0.8, 0.55, 0.15, 0x2a3a5a, { x: sx, y: 1.7, z: 1.0 })); }  // seats
    L.push(box(2.2, 0.45, 0.9, 0x2a3a5a, { y: 1.42, z: 2.2 }));                    // rear bench
    // Bow rail and stern rails (chrome).
    for (const [x, z] of [[-1.0, -1.6], [1.0, -1.6], [-0.5, -2.5], [0.5, -2.5], [0, -2.95], [-1.15, 0.2], [1.15, 0.2], [-1.15, 2.6], [1.15, 2.6]]) L.push(cyl(0.03, 0.03, 0.55, 6, CHROME, { x, y: 1.45, z }));
    L.push(box(0.05, 0.05, 1.5, CHROME, { x: -1.15, y: 1.72, z: 1.4 })); L.push(box(0.05, 0.05, 1.5, CHROME, { x: 1.15, y: 1.72, z: 1.4 }));
    L.push(box(2.05, 0.05, 0.05, CHROME, { y: 1.72, z: -1.6 })); L.push(box(1.1, 0.05, 0.05, CHROME, { y: 1.72, z: -2.5 }));
    // Outboard motor: cowling, leg, propeller.
    L.push(box(0.6, 0.6, 0.5, DARK, { y: 1.55, z: 3.3 })); L.push(box(0.45, 0.35, 0.4, 0x3a4048, { y: 2.0, z: 3.3 })); L.push(box(0.2, 1.0, 0.25, DARK, { y: 0.7, z: 3.35 }));
    this.prop = new THREE.Group(); this.prop.position.set(0, 0.25, 3.5);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.12), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.3 })); b.rotation.z = (i / 3) * Math.PI * 2; b.position.set(Math.sin(b.rotation.z) * 0.14, Math.cos(b.rotation.z) * 0.14, 0); this.prop.add(b); }
    this.hull.add(this.prop);
    // Navigation lights: red port (left), green starboard (right), white stern.
    this.navMats = [new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 0.3 }), new THREE.MeshStandardMaterial({ color: 0x30ff60, emissive: 0x20ff50, emissiveIntensity: 0.3 }), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 })];
    for (const [i, [x, z]] of [[-1.2, -1.4], [1.2, -1.4], [0, 3.0]].entries()) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), this.navMats[i]); m.position.set(x, i === 2 ? 2.7 : 1.5, z); this.hull.add(m); }
    // Flag and a small canopy frame.
    L.push(cyl(0.02, 0.02, 1.4, 5, CHROME, { y: 2.6, z: 2.9 })); L.push(box(0.5, 0.3, 0.02, 0xc9a227, { x: 0.26, y: 3.1, z: 2.9 }));
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
    const body = new THREE.Mesh(merge(L), bodyMat); body.castShadow = true; this.hull.add(body);
    const glass = new THREE.Mesh(merge(G), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.6 })); this.hull.add(glass);
    // Headlight for night (spot) and a warm cabin lamp.
    this.spot = new THREE.SpotLight(0xfff1cc, 0, 60, 0.5, 0.6, 1.2); this.spot.position.set(0, 2.3, -0.7); this.spot.target.position.set(0, 0.3, -30); this.hull.add(this.spot); this.hull.add(this.spot.target); this.spot.visible = false;
    // Wake: points behind the stern; spray: points at the bow.
    const N = 400; this.N = N; this.wakeGeo = new THREE.BufferGeometry(); this.wakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.life = new Float32Array(N).fill(-1); this.vel = new Float32Array(N * 3);
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16); grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    this.wake = new THREE.Points(this.wakeGeo, new THREE.PointsMaterial({ map: tex, size: 2.2, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true })); this.wake.frustumCulled = false; scene.add(this.wake);
    this.next = 0; this.pitch = 0; this.roll = 0; this.halfLength = 3.1; this.halfWidth = 1.25;
    this.root.visible = false; scene.add(this.root);
  }
  setNight(on) { this.spot.visible = on; this.spot.intensity = on ? 140 : 0; this.navMats.forEach((m) => { m.emissiveIntensity = on ? 2.5 : 0.3; }); }
  setBodyVisible(v) { this.hull.traverse((o) => { if (o.isMesh) o.visible = v; }); }
  update(dt, b, alpha, input, t) {
    const x = lerp(b.px, b.x, alpha), z = lerp(b.pz, b.z, alpha);
    const yaw = b.pyaw + ((b.yaw - b.pyaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * alpha;
    const sp = Math.abs(b.speed);
    this.root.position.set(x, 0.12 + Math.sin(t * 1.6) * 0.04 + Math.sin(t * 2.7 + 1) * 0.03, z); this.root.rotation.y = -yaw;
    const tp = -0.09 * Math.min(1, sp / 8) + Math.sin(t * 1.9) * 0.012, tr = clamp(b.telemetry.latG * 0.03, -0.12, 0.12) + Math.sin(t * 1.3) * 0.015;
    this.pitch = lerp(this.pitch, tp, 1 - Math.exp(-5 * dt)); this.roll = lerp(this.roll, tr, 1 - Math.exp(-5 * dt));
    this.hull.rotation.set(this.pitch, 0, this.roll);
    this.prop.rotation.z += b.rpm * 40 * dt;
    const p = this.wakeGeo.attributes.position.array;
    if (sp > 1.5) {
      const f = b.forward(), r = b.right(); const n = Math.min(6, Math.floor(sp / 2) + 1);
      for (let i = 0; i < n; i++) { const k = this.next = (this.next + 1) % this.N; const side = i % 2 ? 1 : -1; const bow = i % 3 === 0;
        p[k * 3] = x - f.x * (bow ? -2.6 : 3.2) + r.x * side * (bow ? 1.1 : 0.6); p[k * 3 + 1] = 0.15; p[k * 3 + 2] = z - f.z * (bow ? -2.6 : 3.2) + r.z * side * (bow ? 1.1 : 0.6);
        this.vel[k * 3] = r.x * side * (bow ? 1.8 : 0.9) + (Math.random() - 0.5) * 0.6; this.vel[k * 3 + 1] = bow ? 1.2 : 0; this.vel[k * 3 + 2] = r.z * side * (bow ? 1.8 : 0.9) + (Math.random() - 0.5) * 0.6; this.life[k] = 2.2; }
    }
    for (let k = 0; k < this.N; k++) { if (this.life[k] <= 0) { p[k * 3 + 1] = -50; continue; } this.life[k] -= dt; p[k * 3] += this.vel[k * 3] * dt; p[k * 3 + 1] += this.vel[k * 3 + 1] * dt; p[k * 3 + 2] += this.vel[k * 3 + 2] * dt; this.vel[k * 3 + 1] -= 3 * dt; if (p[k * 3 + 1] < 0.15) { p[k * 3 + 1] = 0.15; this.vel[k * 3 + 1] = 0; } }
    this.wakeGeo.attributes.position.needsUpdate = true;
  }
}
