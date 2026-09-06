// Fixed 120 Hz simulation with an accumulator; rendering at display rate. Max 8 steps per frame.
export const SIM_DT = 1 / 120;
export class Loop {
  constructor(sim, render) {
    this.sim = sim; this.render = render; this.acc = 0; this.last = 0; this.running = false; this.paused = false;
    this.stepsThisFrame = 0; this.frameDt = 0; this.fps = 60; this._fpsAcc = 0; this._fpsN = 0;
    this._tick = this._tick.bind(this);
  }
  start() { this.running = true; this.last = performance.now(); requestAnimationFrame(this._tick); }
  _tick(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.frameDt = dt;
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc >= 0.5) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }
    this.stepsThisFrame = 0;
    if (!this.paused) {
      this.acc += dt;
      while (this.acc >= SIM_DT && this.stepsThisFrame < 8) { this.sim(SIM_DT); this.acc -= SIM_DT; this.stepsThisFrame++; }
      if (this.stepsThisFrame >= 8) this.acc = 0;
    }
    this.render(dt, this.paused ? 1 : this.acc / SIM_DT);
    requestAnimationFrame(this._tick);
  }
}
