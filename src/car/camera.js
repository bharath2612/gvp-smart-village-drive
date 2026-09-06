import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, lerp, lerpAngle } from '../util/math.js';

export const CAM_MODES = ['chase', 'hood', 'drone', 'orbit'];
export class CameraRig {
  constructor(camera, settings) {
    this.camera = camera; this.settings = settings; this.mode = 'chase';
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.shake = 0; this.orbitYaw = 0.6; this.orbitPitch = 0.35; this.orbitDist = 12; this.followYaw = 0;
    this.fov = 60; this.blend = 1; this.snapped = false;
    this.tmp = new THREE.Vector3();
  }
  cycle() { const i = CAM_MODES.indexOf(this.mode); this.mode = CAM_MODES[(i + 1) % 3]; this.blend = 0; }
  setMode(m) { this.mode = m; this.blend = 0; }
  addShake(s) { this.shake = Math.min(1, this.shake + s); }
  snapTo(car) { this.snapped = false; this.update(1, car, 0, {}, true); }
  update(dt, car, alpha, input, hardSnap = false) {
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
      targetPos.copy(carPos).addScaledVector(fwd, -0.3).add(new THREE.Vector3(0, 1.62, 0));
      targetLook.copy(carPos).addScaledVector(fwd, 40).add(new THREE.Vector3(0, 1.0, 0));
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
}
