// Procedural Cessna 172 style charter plane: bevelled fuselage, high wing with struts, animated control surfaces,
// tricycle gear, prop that blurs into a disc, nav/strobe/beacon lights, landing light, live cockpit panel, dust and smoke.
import * as THREE from 'three';
import { box, cyl, merge } from '../world/geo.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp } from '../util/math.js';
import { drawPanel } from './hud.js';

const WHITE = 0xf4f4f0, BLUE = 0x1e4fa3, GOLD = 0xc9a227, DARK = 0x23272e, GREY = 0x8b949e, GLASS = 0x7fa5c4, TYRE = 0x15171a, INTERIOR = 0x3a3f46, SEAT = 0x2a3a5a;

function colour(geo, hex) { const c = new THREE.Color(hex); const arr = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return geo; }
// Extrude a (z, y) profile along X, centred, with bevel for rounded edges.
function profile(points, width, bevel, hex, opts = {}) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * (opts.bevelSize || 1), bevelSegments: opts.segments || 2 });
  g.rotateY(Math.PI / 2); g.translate(-width / 2, 0, 0);
  if (opts.x) g.translate(opts.x, 0, 0);
  if (opts.smooth) { const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); return colour(m, hex); }
  return colour(g, hex);
}
function strut(a, b, r, hex) {
  const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, 6); colour(g, hex);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
class Particles {
  constructor(scene, n, color, size, opacity) {
    this.n = n; this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.life = new Float32Array(n).fill(-1); this.max = new Float32Array(n); this.vel = new Float32Array(n * 3); this.next = 0;
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16); grad.addColorStop(0, 'rgba(255,255,255,0.8)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    this.mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; scene.add(this.points);
    for (let i = 0; i < n; i++) this.geo.attributes.position.array[i * 3 + 1] = -100;
  }
  emit(x, y, z, vx, vy, vz, life) { const k = this.next = (this.next + 1) % this.n; const p = this.geo.attributes.position.array; p[k * 3] = x; p[k * 3 + 1] = y; p[k * 3 + 2] = z; this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz; this.life[k] = life; this.max[k] = life; }
  update(dt, gravity = 0, drag = 0) {
    const p = this.geo.attributes.position.array;
    for (let k = 0; k < this.n; k++) { if (this.life[k] <= 0) continue; this.life[k] -= dt; if (this.life[k] <= 0) { p[k * 3 + 1] = -100; continue; } p[k * 3] += this.vel[k * 3] * dt; p[k * 3 + 1] += this.vel[k * 3 + 1] * dt; p[k * 3 + 2] += this.vel[k * 3 + 2] * dt; this.vel[k * 3 + 1] += gravity * dt; if (drag) { const f = 1 - drag * dt; this.vel[k * 3] *= f; this.vel[k * 3 + 1] *= f; this.vel[k * 3 + 2] *= f; } if (p[k * 3 + 1] < 0.1) p[k * 3 + 1] = 0.1; }
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class PlaneVisual {
  constructor(scene, ctx, opts = {}) {
    this.scene = scene; this.ctx = ctx;
    this.root = new THREE.Group(); this.root.name = 'plane';
    this.body = new THREE.Group(); this.root.add(this.body);   // everything that moves with the airframe
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.12 });
    const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const livery = opts.livery || { main: WHITE, accent: BLUE, stripe: GOLD };
    this.bodyMat = bodyMat;
    const F = [], R = [], G = [];
    // Fuselage: side profile (z, y) from the nose (-4.15) to the tail (+4.15), y = 0 is the ground.
    const fus = [[-4.15, 1.05], [-4.15, 1.5], [-3.3, 1.72], [-2.45, 1.85], [-1.7, 2.32], [0.5, 2.36], [1.4, 2.12], [4.05, 1.72], [4.15, 1.5], [4.05, 1.38], [1.6, 0.98], [-0.6, 0.82], [-2.6, 0.82], [-3.6, 0.9]];
    F.push(profile(fus, 0.9, 0.32, livery.main, { segments: 4, smooth: true }));
    // Belly band and cheat line (thin decals that poke through both sides).
    F.push(box(1.56, 0.26, 5.6, livery.accent, { y: 1.02, z: 0.6 }));
    F.push(box(1.58, 0.055, 6.2, livery.stripe, { y: 1.62, z: 0.6 }));
    F.push(box(1.58, 0.03, 6.2, livery.accent, { y: 1.68, z: 0.6 }));
    // Cabin glass: windscreen, side windows, rear windows.
    { const ws = box(1.3, 0.62, 0.05, GLASS, { y: 2.06, z: -1.98 }); ws.translate(0, -2.06, 1.98); ws.rotateX(-0.62); ws.translate(0, 2.06, 1.98); G.push(ws); }
    for (const sx of [-1, 1]) { G.push(box(0.05, 0.5, 1.5, GLASS, { x: sx * 0.76, y: 1.98, z: -0.9 })); G.push(box(0.05, 0.42, 0.9, GLASS, { x: sx * 0.72, y: 1.96, z: 0.55 })); }
    G.push(box(1.2, 0.36, 0.05, GLASS, { y: 1.98, z: 1.05 }));
    // Engine cowling, spinner.
    R.push(box(1.18, 0.86, 1.25, livery.main, { y: 1.32, z: -3.62 }));
    R.push(box(1.2, 0.24, 1.27, livery.accent, { y: 1.0, z: -3.62 }));
    for (const sx of [-1, 1]) R.push(box(0.16, 0.1, 0.5, DARK, { x: sx * 0.35, y: 1.15, z: -4.0 })); // air intakes
    R.push(cyl(0.05, 0.05, 0.3, 6, DARK, { x: 0.5, y: 0.85, z: -3.2 })); // exhaust
    { const sp = cyl(0.02, 0.2, 0.42, 12, livery.main, { y: 0, z: 0 }); sp.rotateX(-Math.PI / 2); sp.translate(0, 1.32, -4.42); R.push(sp); }
    // Wing: two halves with 1.7 degree dihedral, tapered tips, accent tips and a stripe; ailerons and flaps are hinged.
    this.wingY = 2.42;
    for (const sx of [-1, 1]) {
      const half = [box(5.5, 0.15, 1.5, livery.main, { x: sx * 2.75, y: 0, z: -0.25 }), box(0.7, 0.13, 1.3, livery.accent, { x: sx * 5.15, y: 0, z: -0.3 }), box(4.4, 0.02, 0.12, livery.stripe, { x: sx * 2.7, y: 0.08, z: -0.98 })];
      const g = merge(half); g.rotateZ(sx * 1.7 * Math.PI / 180); g.translate(0, this.wingY, 0); R.push(g);
      // Struts from the fuselage belly to the wing.
      R.push(strut(new THREE.Vector3(sx * 0.62, 1.05, -0.5), new THREE.Vector3(sx * 2.9, this.wingY - 0.08, -0.5), 0.035, GREY));
      R.push(strut(new THREE.Vector3(sx * 0.62, 1.05, -0.1), new THREE.Vector3(sx * 2.9, this.wingY - 0.08, -0.2), 0.03, GREY));
    }
    // Tail: horizontal stabiliser, fin with a swept leading edge, dorsal fillet; elevator and rudder hinged.
    R.push(box(3.4, 0.09, 0.85, livery.main, { y: 1.6, z: 3.5 }));
    R.push(profile([[2.6, 1.72], [3.75, 1.72], [4.05, 2.85], [3.55, 2.85]], 0.1, 0.02, livery.main));
    R.push(profile([[3.0, 1.75], [3.7, 1.75], [3.95, 2.75], [3.65, 2.75]], 0.13, 0.0, livery.accent));
    R.push(profile([[1.6, 1.98], [2.7, 1.72], [2.9, 1.72]], 0.12, 0.0, livery.main));
    // Landing gear: nose strut (steering) and sprung main legs with wheel fairings.
    R.push(cyl(0.045, 0.05, 0.55, 8, GREY, { y: 0.67, z: -2.85 }));
    for (const sx of [-1, 1]) { R.push(strut(new THREE.Vector3(sx * 0.42, 0.92, 0.45), new THREE.Vector3(sx * 1.12, 0.3, 0.55), 0.045, GREY)); R.push(box(0.26, 0.28, 0.66, livery.main, { x: sx * 1.18, y: 0.4, z: 0.55 })); R.push(box(0.26, 0.08, 0.66, livery.accent, { x: sx * 1.18, y: 0.28, z: 0.55 })); }
    R.push(box(0.2, 0.26, 0.5, livery.main, { y: 0.4, z: -2.85 }));
    // Cockpit interior: seats, yoke column, glare shield.
    for (const sx of [-0.36, 0.36]) { R.push(box(0.5, 0.12, 0.55, SEAT, { x: sx, y: 1.28, z: -0.7 })); R.push(box(0.5, 0.55, 0.12, SEAT, { x: sx, y: 1.6, z: -0.42 })); }
    R.push(box(1.35, 0.04, 0.55, INTERIOR, { y: 1.83, z: -2.05 }));
    R.push(cyl(0.02, 0.02, 0.3, 6, DARK, { x: -0.36, y: 1.36, z: -1.9 }));
    const rest = new THREE.Mesh(merge(R), bodyMat); rest.castShadow = true; rest.receiveShadow = true; this.body.add(rest);
    this.fuselage = new THREE.Mesh(merge(F), bodyMat); this.fuselage.castShadow = true; this.body.add(this.fuselage);
    this.glass = new THREE.Mesh(merge(G), glassMat); this.body.add(this.glass);
    // Registration plates on both sides.
    const reg = opts.reg || 'VT-GVP';
    for (const sx of [-1, 1]) { const m = textPlate(1.35, 0.32, reg, '#f4f4f0', '#1e4fa3'); m.position.set(sx * 0.81, 1.42, 2.3); m.rotation.y = sx * Math.PI / 2; this.fuselage.add(m); }
    // Instrument panel with a live canvas.
    this.panelCanvas = document.createElement('canvas'); this.panelCanvas.width = 512; this.panelCanvas.height = 192;
    this.panelTex = new THREE.CanvasTexture(this.panelCanvas); this.panelTex.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.48), new THREE.MeshStandardMaterial({ map: this.panelTex, emissive: 0xffffff, emissiveMap: this.panelTex, emissiveIntensity: 0.55, roughness: 0.7 }));
    panel.position.set(0, 1.6, -2.02); panel.rotation.x = -0.2; this.body.add(panel);
    const panelBack = new THREE.Mesh(box(1.34, 0.5, 0.06, INTERIOR, { y: 0, z: 0 }), bodyMat); panelBack.position.set(0, 1.6, -2.06); panelBack.rotation.x = -0.2; this.body.add(panelBack);
    this.yoke = new THREE.Mesh(merge([cyl(0.11, 0.11, 0.025, 16, DARK, { y: 0 }), box(0.2, 0.025, 0.04, DARK, { y: 0 })]), bodyMat); this.yoke.rotation.x = Math.PI / 2; this.yoke.position.set(-0.36, 1.48, -1.9); this.body.add(this.yoke);
    // Moving parts.
    const part = (geo, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); const m = new THREE.Mesh(geo, bodyMat); m.castShadow = true; p.add(m); this.body.add(p); return p; };
    this.ailerons = [-1, 1].map((sx) => part(box(1.7, 0.06, 0.36, livery.main, { x: sx * 0.85, y: 0, z: 0.18 }), sx * 3.45, this.wingY + sx * 0, 0.5));
    this.flaps = [-1, 1].map((sx) => part(box(2.3, 0.07, 0.4, livery.main, { x: sx * 1.15, y: 0, z: 0.2 }), sx * 1.05, this.wingY, 0.5));
    this.elevator = part(box(3.3, 0.06, 0.4, livery.main, { y: 0, z: 0.2 }), 0, 1.6, 3.92);
    this.rudder = part(profile([[0, 0.02], [0.42, 0.02], [0.42, 0.9], [0.22, 1.05], [0, 1.05]], 0.1, 0.0, livery.accent), 0, 1.74, 3.78);
    // Prop: two blades plus a translucent disc at speed.
    this.prop = new THREE.Group(); this.prop.position.set(0, 1.32, -4.5); this.body.add(this.prop);
    const blade = new THREE.Mesh(merge([box(0.13, 1.9, 0.035, DARK, { y: 0 }), box(0.13, 0.22, 0.04, GOLD, { y: 0.84 }), box(0.13, 0.22, 0.04, GOLD, { y: -0.84 })]), bodyMat); blade.castShadow = true; this.prop.add(blade);
    this.propDisc = new THREE.Mesh(new THREE.CircleGeometry(0.97, 24), new THREE.MeshBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); this.prop.add(this.propDisc);
    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.15, 16).rotateZ(Math.PI / 2); const wheelMat = new THREE.MeshStandardMaterial({ color: TYRE, roughness: 0.95 });
    const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12).rotateZ(Math.PI / 2); const hubMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.4, metalness: 0.6 });
    this.wheels = [];
    const wheel = (x, y, z, r) => { const g = new THREE.Group(); g.position.set(x, y, z); const w = new THREE.Mesh(wheelGeo, wheelMat); w.scale.setScalar(r / 0.23); g.add(w); g.add(new THREE.Mesh(hub, hubMat)); return g; };
    this.noseGear = new THREE.Group(); this.noseGear.position.set(0, 0, -2.85); this.body.add(this.noseGear);
    const nw = wheel(0, 0.2, 0, 0.2); this.noseGear.add(nw); this.wheels.push(nw);
    for (const sx of [-1, 1]) { const w = wheel(sx * 1.18, 0.24, 0.55, 0.24); this.body.add(w); this.wheels.push(w); }
    // Lights: nav (red left, green right, white tail), beacon (red, fin), strobes (white, wingtips), landing light.
    const lamp = (hex) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.4 });
    this.navL = lamp(0xff2020); this.navR = lamp(0x20ff50); this.navT = lamp(0xffffff); this.beaconMat = lamp(0xff2020); this.strobeMat = lamp(0xffffff);
    const bulb = (mat, x, y, z, r = 0.07) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat); m.position.set(x, y, z); this.body.add(m); return m; };
    bulb(this.navL, -5.52, this.wingY - 0.16, -0.75); bulb(this.navR, 5.52, this.wingY - 0.16, -0.75); bulb(this.navT, 0, 2.82, 4.05, 0.05);
    bulb(this.beaconMat, 0, 2.9, 3.75, 0.08); bulb(this.strobeMat, -5.52, this.wingY - 0.16, -0.5, 0.05); bulb(this.strobeMat, 5.52, this.wingY - 0.16, -0.5, 0.05);
    this.landing = new THREE.SpotLight(0xfff4d6, 0, 140, 0.42, 0.5, 1.0); this.landing.position.set(0, 1.25, -4.1); this.landing.target.position.set(0, -6, -80); this.body.add(this.landing); this.body.add(this.landing.target); this.landing.visible = false;
    this.landingLens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 0.3 })); this.landingLens.position.set(0, 1.25, -4.26); this.landingLens.rotation.y = Math.PI; this.body.add(this.landingLens);
    // Particles: prop-wash dust on the ground, crash smoke.
    this.dust = new Particles(scene, 200, 0xc9b58f, 2.0, 0.45); this.smoke = new Particles(scene, 300, 0x3a3a3a, 5, 0.55);
    this.squat = 0; this.squatV = 0; this.propAngle = 0; this.lastPanel = 0; this._night = false;
    this.root.visible = false; scene.add(this.root);
  }
  setNight(on) { this._night = on; this.landing.visible = on; this.landing.intensity = on ? 260 : 0; for (const m of [this.navL, this.navR, this.navT]) m.emissiveIntensity = on ? 2.4 : 0.5; this.landingLens.material.emissiveIntensity = on ? 3 : 0.3; }
  setBodyVisible(v) { this.fuselage.visible = v; this.glass.visible = v; }
  // Static copy for the second aircraft in the hangar.
  static parked(scene, ctx, x, z, yaw, livery, reg) { const v = new PlaneVisual(scene, ctx, { livery, reg }); v.root.visible = true; v.root.position.set(x, 0, z); v.root.rotation.y = -yaw; v.dust.points.visible = false; v.smoke.points.visible = false; v.flaps.forEach((f) => { f.rotation.x = 0; }); return v; }
  crashPuff(x, y, z) { for (let i = 0; i < 60; i++) this.smoke.emit(x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, 1.5 + Math.random() * 4, (Math.random() - 0.5) * 4, 2 + Math.random() * 3); }
  update(dt, p, alpha, input, t) {
    const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha), z = lerp(p.pz, p.z, alpha);
    this.root.position.set(x, y - this.squat, z);
    this.root.quaternion.copy(p.pq).slerp(p.q, alpha);
    // Gear squat after a touchdown decays (frame-rate independent).
    this.squat *= Math.exp(-5 * dt); if (this.squat < 0.001) this.squat = 0;
    // Control surfaces follow the smoothed inputs; flaps their setting.
    const ail = p.in.roll * 0.35, ele = -p.in.pitch * 0.45, rud = -p.in.yaw * 0.45, fl = p.flaps * Math.PI / 180;
    this.ailerons[0].rotation.x = -ail; this.ailerons[1].rotation.x = ail; this.elevator.rotation.x = ele; this.rudder.rotation.y = rud;
    for (const f of this.flaps) f.rotation.x = fl;
    this.noseGear.rotation.y = -p.steer * 1.2; this.yoke.rotation.z = -p.in.roll * 0.8;
    for (const w of this.wheels) w.children[0].rotation.x = w.children[1].rotation.x = p.wheelSpin;
    // Prop: spin rate from rpm; blur disc above 55 % power.
    this.propAngle += (4 + p.rpm * 60) * dt; this.prop.rotation.z = this.propAngle;
    this.propDisc.material.opacity = clamp((p.rpm - 0.5) * 1.6, 0, 0.35);
    // Beacon 1 Hz, strobes double-flash every 1.4 s in the air.
    const beacon = (t % 1) < 0.12 ? 4 : 0.2; this.beaconMat.emissiveIntensity = p.rpm > 0.28 ? beacon : 0.2;
    const st = t % 1.4; const strobe = !p.onGround && (st < 0.06 || (st > 0.16 && st < 0.22)) ? 6 : 0.1; this.strobeMat.emissiveIntensity = strobe;
    // Prop wash dust on the ground at power.
    if (p.onGround && p.throttle > 0.3 && p.groundSpeed < 25) { const f = p.forward(); const n = Math.floor(p.throttle * 3); for (let i = 0; i < n; i++) this.dust.emit(x - f.x * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2, 0.2, z - f.z * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2, -f.x * (6 + Math.random() * 6), 0.6 + Math.random(), -f.z * (6 + Math.random() * 6), 1.2); }
    this.dust.update(dt, -0.5, 1.5); this.smoke.update(dt, 0.3, 0.6);
    // Cockpit panel redraw at ~20 Hz.
    if (t - this.lastPanel > 0.05) { this.lastPanel = t; drawPanel(this.panelCanvas, p); this.panelTex.needsUpdate = true; }
  }
  touchdown(sink) { this.squat = Math.min(0.3, sink * 0.08); }
}

function textPlate(w, h, text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = `bold ${Math.round(c.height * 0.72)}px Inter, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
}
