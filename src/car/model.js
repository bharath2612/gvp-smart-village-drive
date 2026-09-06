// Deterministic arcade car model. Units: m, s, rad. Runs at a fixed 120 Hz step, 2D in the XZ plane.
import { CONFIG, DEG } from '../config.js';
import { clamp, lerp, smoothstep, pointInPolygon, distToRect } from '../util/math.js';

export class CarModel {
  constructor(world, colliders, ctx) {
    this.world = world; this.colliders = colliders; this.ctx = ctx;
    this.h = { ...CONFIG.handling };
    this.halfL = 2.3; this.halfW = 0.95;
    this.reset(CONFIG.world.gate.x, CONFIG.world.gate.y - 12, 0);
    this.events = [];
    this.time = 0;
    this.boostCharge = 1; this.boostTimer = 0;
    this.lakeSteps = 0; this.stuck = 0; this.lastBump = null;
    this.hedgeWas = false; this.farmCache = null;
    this.telemetry = { slip: 0, latG: 0, accel: 0, impact: 0 };
    this.history = [];
  }
  reset(x, z, yaw) {
    this.x = x; this.z = z; this.yaw = yaw; this.vx = 0; this.vz = 0; this.steer = 0;
    this.px = x; this.pz = z; this.pyaw = yaw;
    this.frozen = false; this.stuck = 0; this.lakeSteps = 0;
  }
  get speed() { const f = this.forward(); return this.vx * f.x + this.vz * f.z; }
  get absSpeed() { return Math.hypot(this.vx, this.vz); }
  forward() { return { x: Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  right() { return { x: Math.cos(this.yaw), z: Math.sin(this.yaw) }; }
  samplePoints() {
    const f = this.forward(), r = this.right(); const pts = [];
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) pts.push({ x: this.x + f.x * this.halfL * a + r.x * this.halfW * b, z: this.z + f.z * this.halfL * a + r.z * this.halfW * b });
    pts.push({ x: this.x, z: this.z });
    return pts;
  }
  step(dt, input) {
    const h = this.h;
    this.px = this.x; this.pz = this.z; this.pyaw = this.yaw;
    this.time += dt;
    if (this.frozen) return;
    const f = this.forward(), r = this.right();
    let vF = this.vx * f.x + this.vz * f.z;
    let vL = this.vx * r.x + this.vz * r.z;
    const speedAbs = Math.abs(vF);

    // Surface
    const road = this.world.onRoad(this.x, this.z);
    const paved = road || (this.ctx.pavedRects || []).some((q) => this.x >= q.x && this.x <= q.x + q.w && this.z >= q.y && this.z <= q.y + q.h);
    this.offroad = !paved;
    const hedge = this.inHedge();
    if (hedge && !this.hedgeWas) this.events.push({ type: 'hedge' });
    this.hedgeWas = hedge; this.hedge = hedge;

    // Boost
    if (input.boost && this.boostCharge > 0.15 && this.boostTimer <= 0 && input.throttle > 0) { this.boostTimer = h.boostDuration * this.boostCharge; this.boostCharge = 0; this.events.push({ type: 'boost' }); }
    const boosting = this.boostTimer > 0;
    if (boosting) this.boostTimer -= dt; else this.boostCharge = Math.min(1, this.boostCharge + dt / h.boostRecharge);
    this.boosting = boosting;

    // Longitudinal
    let vmax = boosting ? h.boostSpeed : h.topSpeed;
    if (this.offroad) vmax *= h.offroadFactor;
    if (hedge) vmax *= h.hedgeFactor;
    let a = 0;
    const accel = boosting ? h.boostAccel : h.accel;
    if (input.throttle > 0) {
      if (vF < -0.5) a += h.brake; else a += accel * Math.max(0, 1 - (vF / vmax) * (vF / vmax)) + (boosting ? 2 : 0);
    }
    if (input.brake > 0) {
      if (vF > 0.3) a -= h.brake;
      else if (vF > -h.reverseMax) { this.reverseHold = (this.reverseHold || 0) + dt; if (this.reverseHold > 0.15) a -= h.reverseAccel * (1 - Math.abs(vF) / h.reverseMax); }
    } else this.reverseHold = 0;
    if (!input.throttle && !input.brake) a -= Math.sign(vF) * Math.min(Math.abs(vF) / dt, h.rolling + (this.offroad ? h.offroadDrag : 0));
    if (this.offroad && input.throttle) a -= h.offroadDrag * 0.5;
    if (input.handbrake) a -= Math.sign(vF) * Math.min(Math.abs(vF) / dt, h.handbrakeDecel);
    // Drag above the cap (e.g. boost ending, off-road entry).
    if (vF > vmax) a -= (vF - vmax) * 2.5;
    const prevVF = vF;
    vF += a * dt;
    this.telemetry.accel = (vF - prevVF) / dt;

    // Steering: speed-sensitive angle with rate limit and return to centre.
    const t = clamp(speedAbs / h.topSpeed, 0, 1);
    const maxSteer = lerp(h.steerLowDeg, h.steerHighDeg, t) * DEG;
    const target = input.steer * maxSteer;
    const rate = (input.steer === 0 ? h.steerReturnDeg : h.steerRateDeg) * DEG * dt;
    this.steer += clamp(target - this.steer, -rate, rate);
    this.steerMax = maxSteer;

    // Yaw from a bicycle model; handbrake loosens the rear.
    let yawRate = (vF / h.wheelbase) * Math.tan(this.steer);
    if (input.handbrake) yawRate *= h.handbrakeYawGain;
    if (this.offroad) yawRate *= 0.9;
    this.yaw += yawRate * dt;
    this.yawRate = yawRate;

    // Lateral grip as damping, weaker at high slip angles and under handbrake.
    const slipAngle = Math.atan2(Math.abs(vL), Math.max(Math.abs(vF), 0.5)) / DEG;
    const slipT = smoothstep(h.slipLowDeg, h.slipHighDeg, slipAngle);
    let grip = lerp(h.gripNormal, h.gripSlide, slipT);
    if (input.handbrake) grip = h.gripHandbrake;
    if (this.offroad) grip = Math.min(0.995, grip + 0.03);
    vL *= grip;
    this.telemetry.slip = clamp(slipAngle / 30, 0, 1) * (speedAbs > 3 ? 1 : 0) + (input.handbrake && speedAbs > 3 ? 0.4 : 0);
    this.telemetry.latG = vF * yawRate;

    // Back to world velocity using the new heading.
    const f2 = this.forward(), r2 = this.right();
    this.vx = f2.x * vF + r2.x * vL; this.vz = f2.z * vF + r2.z * vL;
    this.x += this.vx * dt; this.z += this.vz * dt;

    this.resolveCollisions(dt);
    this.checkTriggers(dt);
    this.wheelSpin = (this.wheelSpin || 0) + vF * dt / 0.38;
  }
  resolveCollisions(dt) {
    let penetrated = false; let maxImpact = 0;
    for (let pass = 0; pass < 2; pass++) {
      const pts = this.samplePoints();
      const near = this.colliders.near(this.x, this.z);
      for (const p of pts) {
        for (const c of near) {
          if (c.dead) continue;
          if (p.x <= c.x0 || p.x >= c.x1 || p.z <= c.z0 || p.z >= c.z1) continue;
          const dx0 = p.x - c.x0, dx1 = c.x1 - p.x, dz0 = p.z - c.z0, dz1 = c.z1 - p.z;
          const m = Math.min(dx0, dx1, dz0, dz1);
          let nx = 0, nz = 0;
          if (m === dx0) nx = -1; else if (m === dx1) nx = 1; else if (m === dz0) nz = -1; else nz = 1;
          this.x += nx * m; this.z += nz * m; p.x += nx * m; p.z += nz * m;
          const vn = this.vx * nx + this.vz * nz;
          if (vn < 0) {
            const impact = -vn;
            this.vx -= nx * vn; this.vz -= nz * vn;
            const keep = this.h.slideKeep + (1 - this.h.slideKeep) * (1 - Math.min(1, impact / 15));
            this.vx *= keep; this.vz *= keep;
            if (impact > maxImpact) maxImpact = impact;
          }
          penetrated = true;
        }
      }
    }
    if (maxImpact > 1.5) this.events.push({ type: 'impact', strength: Math.min(1, maxImpact / 25) });
    this.telemetry.impact = maxImpact;
    // Stuck guard: if still penetrating after 0.5 s, back out along the heading.
    if (penetrated) {
      this.stuck += dt;
      if (this.stuck > this.h.stuckNudgeAfter) { const f = this.forward(); const s = Math.sign(this.speed || 1); this.x -= f.x * s * 0.6 * dt * 10; this.z -= f.z * s * 0.6 * dt * 10; this.vx *= 0.5; this.vz *= 0.5; }
      // Wedged between two colliders (house + compound wall): hand the car back to the road.
      if (this.stuck > 1.5) { this.stuck = 0; this.events.push({ type: 'stuckReset' }); }
    } else this.stuck = 0;
  }
  checkTriggers(dt) {
    // Lake
    if (pointInPolygon(this.x, this.z, this.world.lake.points)) { this.lakeSteps++; if (this.lakeSteps === 3) this.events.push({ type: 'lake' }); }
    else this.lakeSteps = 0;
    // Speed bumps
    let onBump = null;
    for (const b of this.ctx.bumps || []) if (this.x >= b.x && this.x <= b.x + b.w && this.z >= b.z && this.z <= b.z + b.h) { onBump = b; break; }
    if (onBump && onBump !== this.lastBump) this.events.push({ type: 'bump', strength: Math.min(1, this.absSpeed / 25) });
    this.lastBump = onBump;
    // Crops
    if (this.ctx.crops && this.offroad && this.absSpeed > 0.5) { this.ctx.crops.flattenAt(this.x, this.z, this.time); const f = this.forward(); this.ctx.crops.flattenAt(this.x - f.x * 1.5, this.z - f.z * 1.5, this.time); }
  }
  inHedge() {
    const w = this.world;
    if (!this.farmCache || distToRect(this.x, this.z, this.farmCache) > 0) {
      this.farmCache = null;
      for (const { plot } of w.plotsNear(this.x, this.z, 0)) if (plot.type === 'farm') { this.farmCache = plot; break; }
    }
    const f = this.farmCache; if (!f) return false;
    const gap = this.ctx.hedgeGaps && this.ctx.hedgeGaps.get(f.id);
    const dN = this.z - f.y, dS = f.y + f.h - this.z, dW = this.x - f.x, dE = f.x + f.w - this.x;
    const inGapX = gap && this.x > gap.x0 && this.x < gap.x1;
    if (dN < 1.6 && !(gap && gap.side === 'N' && inGapX)) return true;
    if (dS < 1.6 && !(gap && gap.side === 'S' && inGapX)) return true;
    return dW < 1.6 || dE < 1.6;
  }
  takeEvents() { const e = this.events; this.events = []; return e; }
}
