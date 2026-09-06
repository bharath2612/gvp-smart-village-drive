import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, lerp, lerpAngle } from '../util/math.js';

export const CAM_MODES = ['chase', 'hood', 'drone', 'orbit'];
export const PLANE_MODES = ['chase', 'cockpit', 'flyby', 'drone'];
export class CameraRig {
  constructor(camera, settings) {
    this.camera = camera; this.settings = settings; this.mode = 'chase';
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.shake = 0; this.orbitYaw = 0.6; this.orbitPitch = 0.35; this.orbitDist = 12; this.followYaw = 0;
    this.fov = 60; this.blend = 1; this.snapped = false; this.plane = false; this.flyby = null; this.upVec = new THREE.Vector3(0, 1, 0);
    this.tmp = new THREE.Vector3();
  }
  cycle() { const modes = this.plane ? PLANE_MODES : CAM_MODES; const i = modes.indexOf(this.mode); this.mode = modes[(i + 1) % (this.plane ? 4 : 3)]; this.blend = 0; this.flyby = null; }
  setMode(m) { this.mode = m; this.blend = 0; }
  setVehicle(kind) { this.plane = kind === 'plane'; this.mode = 'chase'; this.blend = 0; this.flyby = null; }
  addShake(s) { this.shake = Math.min(1, this.shake + s); }
  snapTo(car) { this.snapped = false; this.update(1, car, 0, {}, true); }
  update(dt, car, alpha, input, hardSnap = false) {
    if (this.plane) return this.updatePlane(dt, car, alpha, input, hardSnap);
    const cfg = CONFIG.camera; const cam = this.camera;
    const x = lerp(car.px, car.x, alpha), z = lerp(car.pz, car.z, alpha);
    const yaw = car.pyaw + ((car.yaw - car.pyaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * alpha;
    const speed = Math.abs(car.speed), t = clamp(speed / CONFIG.handling.topSpeed, 0, 1);
    const carPos = new THREE.Vector3(x, 0, z);
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    this.blend = Math.min(1, this.blend + dt / 0.45);
    let targetPos = new THREE.Vector3(), targetLook = new THREE.Vector3(), targetFov = 60, up = new THREE.Vector3(0, 1, 0);

    // Orbit when stopped and the mouse is dragged; throttle snaps back to chase.
    if (this.mode !== 'orbit' && this.mode !== 'drone' && speed < 0.6 && input.mouse && input.mouse.down && (Math.abs(input.mouse.dx) > 0 || Math.abs(input.mouse.dy) > 0)) { this.mode = 'orbit'; this.orbitYaw = this.followYaw + Math.PI; this.orbitPitch = 0.3; this.orbitDist = 10; }
    if (this.mode === 'orbit' && (input.throttle || input.brake || speed > 1)) { this.mode = 'chase'; this.blend = 0.5; }

    if (this.mode === 'chase') {
      const dist = { near: 0.8, normal: 1, far: 1.35 }[this.settings.get('chaseDistance')] || 1;
      const back = lerp(cfg.chase.back, cfg.chase.backFast, t) * dist, upY = lerp(cfg.chase.up, cfg.chase.upFast, t) * dist;
      // Follow the velocity direction when moving so drifts show the car sliding across the frame.
      let followTarget = yaw;
      if (speed > 6) { const vyaw = Math.atan2(car.vx, -car.vz); const blendV = car.speed > 0 ? 0.65 : 0; followTarget = lerpAngle(yaw, vyaw, blendV); }
      this.followYaw = lerpAngle(this.followYaw, followTarget, 1 - Math.exp(-6 * dt));
      const fdir = new THREE.Vector3(Math.sin(this.followYaw), 0, -Math.cos(this.followYaw));
      targetPos.copy(carPos).addScaledVector(fdir, -back).add(new THREE.Vector3(0, upY, 0));
      targetLook.copy(carPos).addScaledVector(fwd, cfg.chase.lookAhead).add(new THREE.Vector3(0, 1.1, 0));
      targetFov = lerp(cfg.chase.fov, cfg.chase.fovFast, t) + (car.boosting ? 6 : 0);
    } else if (this.mode === 'hood') {
      // Bumper-height first-person view just behind the front edge; the car body is hidden while this is active.
      targetPos.copy(carPos).addScaledVector(fwd, car.halfL - 0.9).add(new THREE.Vector3(0, 1.35, 0));
      targetLook.copy(carPos).addScaledVector(fwd, 40).add(new THREE.Vector3(0, 0.9, 0));
      targetFov = cfg.hood.fov;
    } else if (this.mode === 'drone') {
      targetPos.copy(carPos).add(new THREE.Vector3(0, cfg.drone.height, 0.01));
      targetLook.copy(carPos); up.set(0, 0, -1); targetFov = 55;
    } else {
      if (input.mouse) { this.orbitYaw -= input.mouse.dx * 0.006; this.orbitPitch = clamp(this.orbitPitch + input.mouse.dy * 0.004, 0.08, 1.3); this.orbitDist = clamp(this.orbitDist + input.mouse.wheel * 0.02, cfg.orbit.min, cfg.orbit.max); }
      targetPos.set(x + Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist, 1 + Math.sin(this.orbitPitch) * this.orbitDist, z + Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist);
      targetLook.copy(carPos).add(new THREE.Vector3(0, 1.0, 0)); targetFov = 55;
    }
    if (input.mouse) { input.mouse.dx = 0; input.mouse.dy = 0; input.mouse.wheel = 0; }
    if (hardSnap || !this.snapped) { this.pos.copy(targetPos); this.look.copy(targetLook); this.snapped = true; this.followYaw = yaw; }
    else {
      const k = this.mode === 'hood' ? 40 : this.mode === 'drone' ? 3 : 8 + 6 * this.blend;
      const f = 1 - Math.exp(-k * dt);
      this.pos.lerp(targetPos, f); this.look.lerp(targetLook, this.mode === 'hood' ? 1 : 1 - Math.exp(-14 * dt));
    }
    if (this.pos.y < 0.6 && this.mode !== 'drone') this.pos.y = 0.6;
    this.fov = lerp(this.fov, targetFov, 1 - Math.exp(-4 * dt));
    cam.fov = this.fov; cam.updateProjectionMatrix();
    // Shake
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake * 0.5 + (this.mode === 'hood' ? t * 0.01 : 0) + (car.offroad && speed > 5 ? 0.01 : 0);
    const off = new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    cam.position.copy(this.pos).add(off); cam.up.copy(up); cam.lookAt(this.look);
    if (this.mode === 'chase') cam.rotateZ(-car.steer * 0.08 * t);
  }
  // Aircraft cameras: chase (follows the flight path, partly banks with the wings), cockpit, fly-by, drone.
  updatePlane(dt, p, alpha, input, hardSnap) {
    const cfg = CONFIG.camera.plane; const cam = this.camera;
    const P = new THREE.Vector3(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha), lerp(p.pz, p.z, alpha));
    const q = p.pq.clone().slerp(p.q, alpha);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const V = p.speed, t = clamp(V / 65, 0, 1);
    const vdir = V > 8 ? new THREE.Vector3(p.vx, p.vy, p.vz).divideScalar(V) : fwd.clone();
    this.blend = Math.min(1, this.blend + dt / 0.45);
    let targetPos = new THREE.Vector3(), targetLook = new THREE.Vector3(), targetFov = 60, targetUp = new THREE.Vector3(0, 1, 0);
    if (this.mode !== 'drone' && this.mode !== 'orbit' && p.onGround && V < 0.6 && input.mouse && input.mouse.down && (Math.abs(input.mouse.dx) > 0 || Math.abs(input.mouse.dy) > 0)) { this.mode = 'orbit'; this.orbitYaw = p.yaw + Math.PI; this.orbitPitch = 0.3; this.orbitDist = 16; }
    if (this.mode === 'orbit' && (V > 1 || input.throttleUp)) { this.mode = 'chase'; this.blend = 0.5; }
    if (this.mode === 'chase') {
      const dist = { near: 0.8, normal: 1, far: 1.35 }[this.settings.get('chaseDistance')] || 1;
      const back = lerp(cfg.chase.back, cfg.chase.backFast, t) * dist;
      const fdir = vdir.clone(); fdir.y *= 0.45; fdir.normalize();
      targetPos.copy(P).addScaledVector(fdir, -back).addScaledVector(new THREE.Vector3(0, 1, 0), cfg.chase.up * dist).addScaledVector(up, 0.8);
      targetLook.copy(P).addScaledVector(fwd, 14).addScaledVector(up, 1.2);
      targetFov = lerp(cfg.chase.fov, cfg.chase.fovFast, t);
      targetUp.lerp(up, cfg.chase.bankFollow).normalize();
      if (p.onGround) targetUp.set(0, 1, 0);
    } else if (this.mode === 'cockpit') {
      const e = cfg.cockpit.eye;
      targetPos.copy(P).addScaledVector(right, e[0]).addScaledVector(up, e[1]).addScaledVector(fwd, e[2]);
      targetLook.copy(targetPos).addScaledVector(fwd, 50).addScaledVector(up, -2.5); targetUp.copy(up); targetFov = cfg.cockpit.fov;
    } else if (this.mode === 'flyby') {
      const rel = this.flyby ? P.clone().sub(this.flyby) : null;
      if (!this.flyby || rel.dot(vdir) > 60 || rel.length() > 400) { const side = Math.random() < 0.5 ? -1 : 1; this.flyby = P.clone().addScaledVector(vdir, cfg.flyby.ahead).addScaledVector(new THREE.Vector3(-vdir.z, 0, vdir.x).normalize(), side * cfg.flyby.side).add(new THREE.Vector3(0, 8 + Math.random() * 25, 0)); if (this.flyby.y < 4) this.flyby.y = 4; this.pos.copy(this.flyby); }
      targetPos.copy(this.flyby); targetLook.copy(P); targetFov = clamp(48 - P.distanceTo(this.flyby) * 0.06, 28, 50);
    } else if (this.mode === 'drone') {
      targetPos.copy(P).add(new THREE.Vector3(0, CONFIG.camera.drone.height, 0.01)); targetLook.copy(P); targetUp.set(0, 0, -1); targetFov = 55;
    } else {
      if (input.mouse) { this.orbitYaw -= input.mouse.dx * 0.006; this.orbitPitch = clamp(this.orbitPitch + input.mouse.dy * 0.004, 0.08, 1.3); this.orbitDist = clamp(this.orbitDist + input.mouse.wheel * 0.02, 6, 60); }
      targetPos.set(P.x + Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist, P.y + 1.5 + Math.sin(this.orbitPitch) * this.orbitDist, P.z + Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist);
      targetLook.copy(P).add(new THREE.Vector3(0, 1.4, 0)); targetFov = 55;
    }
    if (input.mouse) { input.mouse.dx = 0; input.mouse.dy = 0; input.mouse.wheel = 0; }
    if (hardSnap || !this.snapped) { this.pos.copy(targetPos); this.look.copy(targetLook); this.upVec.copy(targetUp); this.snapped = true; }
    else {
      const k = this.mode === 'cockpit' ? 60 : this.mode === 'flyby' ? 60 : this.mode === 'drone' ? 3 : 5 + 5 * this.blend;
      this.pos.lerp(targetPos, 1 - Math.exp(-k * dt)); this.look.lerp(targetLook, 1 - Math.exp(-(this.mode === 'cockpit' ? 60 : 12) * dt)); this.upVec.lerp(targetUp, 1 - Math.exp(-(this.mode === 'cockpit' ? 60 : 5) * dt)).normalize();
    }
    if (this.pos.y < 1.2 && this.mode !== 'drone') this.pos.y = 1.2;
    this.fov = lerp(this.fov, targetFov, 1 - Math.exp(-4 * dt));
    cam.fov = this.fov; cam.updateProjectionMatrix();
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake * 0.5 + (p.stalled ? 0.05 : 0) + (p.onGround && V > 3 ? 0.012 : 0);
    const off = new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    cam.position.copy(this.pos).add(off); cam.up.copy(this.upVec); cam.lookAt(this.look);
  }
}
