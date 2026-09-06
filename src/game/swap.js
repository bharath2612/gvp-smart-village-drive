// Car swapping: stop near any parked car, press E (or the button) to take it. Your previous car is left
// parked where you stopped, in its own colour, and can be swapped back into later.
import * as THREE from 'three';
import { loadCarModelFrom } from '../car/visual.js';
import { CAR_NAMES, CAR_LENGTHS } from '../world/props.js';
import { CONFIG } from '../config.js';

export class CarSwap {
  constructor(ctx, car, carVisual, rig, ui, audio) {
    this.ctx = ctx; this.car = car; this.visual = carVisual; this.rig = rig; this.ui = ui; this.audio = audio;
    this.current = { key: 'suv', color: CONFIG.brandColor, name: CAR_NAMES.suv };
    this.cache = new Map(); this.nearest = null; this.busy = false;
    this._m = new THREE.Matrix4(); this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  update() {
    const reg = this.ctx.parkedRegistry || []; const car = this.car;
    let best = null, bd = 7.5;
    if (Math.abs(car.speed) * 3.6 < 8) for (const e of reg) { if (e.taken) continue; const d = Math.hypot(e.x - car.x, e.z - car.z); if (d < bd) { bd = d; best = e; } }
    this.nearest = best;
    this.ui.showSwapPrompt(best ? `Swap into the ${CAR_NAMES[best.key] || best.key}` : null);
  }
  async swap() {
    const e = this.nearest; if (!e || this.busy) return;
    this.busy = true;
    try {
      const key = `${e.key}|${e.color}`;
      let model = this.cache.get(key);
      if (!model) { model = await loadCarModelFrom(`/models/cars/${e.key}.glb`, e.color, CAR_LENGTHS[e.key] || 4.5); if (!model) throw new Error('model failed'); this.cache.set(key, model); }
      const car = this.car;
      // 1. Leave the current car parked where it stands, as a static copy, and register it as swappable.
      const copy = this.visual.makeParkedCopy(); copy.position.set(car.x, 0, car.z); copy.rotation.y = -car.yaw; this.ctx.scene.add(copy);
      const hw = this.visual.halfWidth + 0.15, hl = this.visual.halfLength + 0.2; const c = Math.abs(Math.cos(car.yaw)) > 0.5 ? [hw, hl] : [hl, hw];
      const collider = this.ctx.colliders.add(car.x - c[0], car.z - c[1], car.x + c[0], car.z + c[1], 'car');
      const left = { key: this.current.key, color: this.current.color, x: car.x, z: car.z, rot: Math.PI - car.yaw, collider, group: copy, mesh: null, index: -1 };
      this.ctx.parkedRegistry.push(left);
      // 2. Take the parked car: hide its instance (or static copy), free its collider.
      if (e.mesh) { e.mesh.setMatrixAt(e.index, this._zero); e.mesh.instanceMatrix.needsUpdate = true; }
      if (e.group) { this.ctx.scene.remove(e.group); }
      e.collider.dead = true; e.taken = true;
      // 3. Become that car.
      this.visual.setModel(model);
      car.halfL = this.visual.halfLength; car.halfW = this.visual.halfWidth;
      car.reset(e.x, e.z, Math.PI - e.rot); this.rig.snapTo(car);
      this.current = { key: e.key, color: e.color, name: CAR_NAMES[e.key] || e.key };
      this.audio.click(); this.ui.toast(`You are now driving the ${this.current.name}. Your previous car is parked here.`, 4);
      this.ui.hideCard();
    } catch (err) { console.warn('[swap]', err); this.ui.toast('Could not swap cars.', 3); }
    this.busy = false;
  }
}
