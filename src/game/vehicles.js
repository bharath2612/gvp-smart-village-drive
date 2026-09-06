// Switching between the car, the motor boat and the charter plane; the airstrip prompts; the crash sequence.
import { roadPlacement } from '../world/layout.js';

const $ = (id) => document.getElementById(id);
export class Vehicles {
  constructor(o) { Object.assign(this, o); this.crashSeq = null; this.fade = null; this.firstFlight = true; }
  get active() { return this.G.flying ? this.plane : this.G.boating ? this.boat : this.car; }
  // ---------------------------------------------------------------- plane
  enterPlane(opts = {}) {
    const { G, ctx, car, carVisual, plane, planeVisual, rig, ui, audio, settings } = this;
    if (G.flying) return; if (G.boating) this.exitBoat(); const A = ctx.airstrip;
    car.reset(A.park.x, A.park.z, A.park.yaw); car.frozen = true; carVisual.update(0, car, 1, this.input, 0); carVisual.root.visible = true;
    const sp = opts.at || A.threshold; plane.reset(sp.x, sp.z, sp.yaw); plane.assist = settings.get('flightAssist'); planeVisual.root.visible = true; planeVisual.update(0, plane, 1, this.input, 0);
    G.flying = true; rig.setVehicle('plane'); rig.snapTo(plane); ui.hideCard(); ui.showSwapPrompt(null); ui.showBoatPrompt(null); ui.setControlsMode('plane'); settings.set('vehicle', 'plane');
    if (!opts.silent) { audio.click(); ui.showControls(9); ui.toast('Runway 09, heading east. Hold W (or Shift) for full power, pull back with ↓ at 100 km/h. F on the apron parks the plane again.', 8); }
    this.firstFlight = true;
  }
  exitPlane(opts = {}) {
    const { G, ctx, car, carVisual, plane, planeVisual, rig, ui, audio, settings, world } = this;
    if (!G.flying) return; const A = ctx.airstrip;
    const nearApron = Math.hypot(plane.x - A.hangarPrompt.x, plane.z - A.hangarPrompt.z) < 45 && plane.onGround;
    const finish = () => {
      if (nearApron) { plane.reset(A.apron.x, A.apron.z, A.apron.yaw); car.reset(A.park.x, A.park.z, A.park.yaw); }
      else { plane.reset(A.apron.x, A.apron.z, A.apron.yaw); const pl = roadPlacement(world, Math.min(2990, Math.max(10, plane.x)), Math.min(2990, Math.max(10, plane.z))); car.reset(pl.x, pl.y, pl.yaw); }
      planeVisual.root.visible = true; planeVisual.update(0, plane, 1, this.input, 0);
      car.frozen = false; G.flying = false; rig.setVehicle('car'); rig.snapTo(car); ui.setControlsMode('car'); settings.set('vehicle', 'car'); ui.banner(null); ui.showFlyPrompt(null);
      if (!opts.silent) { audio.click(); ui.toast(nearApron ? 'Plane parked on the apron. Your car is in the car park.' : 'Your car is waiting on the road below.', 4); }
    };
    if (!plane.onGround && !opts.silent) this.startFade(0.6, finish); else finish();
  }
  respawnPlane(msg) { const { plane, ctx, rig, ui } = this; const A = ctx.airstrip; plane.reset(A.threshold.x, A.threshold.z, A.threshold.yaw); rig.setMode('chase'); rig.snapTo(plane); if (msg) ui.toast(msg, 4); }
  crash(reason) {
    const { plane, planeVisual, audio, rig, G } = this;
    if (this.crashSeq) return;
    planeVisual.crashPuff(plane.x, plane.y, plane.z); audio.crash(); rig.addShake(1); G.crashCount = (G.crashCount || 0) + 1;
    this.crashSeq = { t: 0, reason }; G.lastCrash = reason;
  }
  startFade(hold, fn) { $('blackout').classList.add('show'); this.fade = { t: 0, hold, fn }; }
  // ---------------------------------------------------------------- boat
  enterBoat() {
    const { G, ctx, car, carVisual, boat, boatVisual, rig, ui, audio, input } = this;
    if (G.boating) return; if (G.flying) return; const m = ctx.marina;
    car.reset(m.park.x, m.park.z, m.park.yaw); car.frozen = true; carVisual.update(0, car, 1, input, 0);
    boat.reset(m.pierEnd.x, m.pierEnd.z, m.pierEnd.yaw); boatVisual.root.visible = true; G.boating = true;
    rig.setMode('chase'); rig.snapTo(boat); ui.hideCard(); ui.showSwapPrompt(null);
    audio.click(); ui.toast('Welcome aboard. W/S throttle, A/D rudder, C changes view. Return to the pier and press B to get back to your car.', 6);
  }
  exitBoat() {
    const { G, ctx, car, boat, boatVisual, rig, ui, audio } = this;
    if (!G.boating) return; const m = ctx.marina;
    boat.reset(m.pierEnd.x, m.pierEnd.z, m.pierEnd.yaw); boatVisual.root.visible = false; G.boating = false;
    car.frozen = false; rig.setMode('chase'); rig.snapTo(car); audio.click(); ui.toast('Back on dry land.', 3);
  }
  // ---------------------------------------------------------------- prompts (every 0.25 s)
  updatePrompts() {
    const { G, ctx, car, boat, plane, ui } = this; const m = ctx.marina, A = ctx.airstrip;
    if (G.flying) { ui.showBoatPrompt(null); const d = Math.hypot(plane.x - A.hangarPrompt.x, plane.z - A.hangarPrompt.z); ui.showFlyPrompt(plane.onGround && d < 45 && plane.speed < 1.5 ? 'Park the plane and take the car?' : null, 'Park · F'); return; }
    if (G.boating) { ui.showFlyPrompt(null); const d = Math.hypot(boat.x - m.pierEnd.x, boat.z - m.pierEnd.z); ui.showBoatPrompt(d < 12 && Math.abs(boat.speed) * 3.6 < 8 ? 'Dock and return to your car?' : null, 'Dock · B'); return; }
    const db = Math.hypot(car.x - m.gate.x, car.z - m.gate.z); ui.showBoatPrompt(db < 14 && Math.abs(car.speed) * 3.6 < 8 ? 'Take a motor boat out on the lake?' : null, 'Yes · B');
    const df = Math.hypot(car.x - A.hangarPrompt.x, car.z - A.hangarPrompt.z); ui.showFlyPrompt(df < 22 && Math.abs(car.speed) * 3.6 < 10 ? 'Take the charter plane up?' : null, 'Fly · F');
  }
  onFlyKey() {
    const { G, ctx, car, plane, ui } = this; const A = ctx.airstrip;
    if (G.flying) { if (!plane.onGround) { ui.toast('Land first (any road or the runway), or switch the vehicle in Settings.', 4); return; } if (Math.hypot(plane.x - A.hangarPrompt.x, plane.z - A.hangarPrompt.z) < 45) this.exitPlane(); else ui.toast('Taxi to the apron by the hangar to park, or switch the vehicle in Settings.', 4); return; }
    if (G.boating) return;
    if (Math.hypot(car.x - A.hangarPrompt.x, car.z - A.hangarPrompt.z) < 22) this.enterPlane(); else ui.toast('The charter plane waits at GVP Airstrip: out through the main gate, then follow the road south.', 5);
  }
  // ---------------------------------------------------------------- per-frame: crash and fade timers
  update(dt) {
    if (this.crashSeq) { const c = this.crashSeq; c.t += dt; if (c.t > 1.1 && !c.faded) { c.faded = true; this.startFade(0.7, () => { this.plane.crashed = false; this.respawnPlane(`Crashed: ${c.reason}. Back on the runway at GVP Airstrip.`); this.crashSeq = null; }); } }
    if (this.fade) { const f = this.fade; f.t += dt; if (f.t > f.hold && !f.done) { f.done = true; f.fn(); $('blackout').classList.remove('show'); } if (f.t > f.hold + 0.7) this.fade = null; }
  }
}
