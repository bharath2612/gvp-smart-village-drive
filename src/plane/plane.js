// Charter plane flight model: arcade-real. Lift, drag, thrust and gravity act on the velocity vector; the
// attitude is a quaternion driven by commanded body rates (with aerodynamic stability and optional assists).
// Fixed 120 Hz step like the car. Units: m, s, rad, N, kg. World: X east, Z south, Y up; yaw 0 = north, clockwise.
import * as THREE from 'three';
import { CONFIG, DEG } from '../config.js';
import { clamp, lerp, smoothstep, wrapAngle, pointInPolygon } from '../util/math.js';

const G = 9.81;
const _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _right = new THREE.Vector3(), _v = new THREE.Vector3(), _lift = new THREE.Vector3(), _dq = new THREE.Quaternion(), _e = new THREE.Euler(), _axis = new THREE.Vector3();

export class PlaneModel {
  constructor(world, colliders, ctx) {
    this.world = world; this.colliders = colliders; this.ctx = ctx; this.P = { ...CONFIG.plane };
    this.halfL = 4.15; this.halfW = 5.5;
    this.q = new THREE.Quaternion(); this.pq = new THREE.Quaternion();
    this.events = []; this.time = 0; this.telemetry = { slip: 0, latG: 0, accel: 0, impact: 0 };
    this.boosting = false; this.offroad = false; this.hedge = false; this.stuck = 0; this.handbrakeOn = false; this.steerMax = 0.6;
    this.assist = 'full'; this.in = { pitch: 0, roll: 0, yaw: 0 }; this.rates = { p: 0, q: 0, r: 0 };
    this.reset(0, 0, 0);
  }
  get boostCharge() { return this.throttle; }
  reset(x, z, yaw, opts = {}) {
    this.x = x; this.y = opts.y || 0; this.z = z; this.yaw = yaw; this.pitch = 0; this.roll = 0;
    this.q.setFromEuler(_e.set(0, -yaw, 0, 'YXZ')); this.pq.copy(this.q);
    this.px = x; this.pz = z; this.py = this.y; this.pyaw = yaw;
    const V = opts.speed || 0; this.vx = Math.sin(yaw) * V; this.vz = -Math.cos(yaw) * V; this.vy = 0;
    this.throttle = opts.throttle ?? 0; this.flaps = 0; this.brakes = !opts.speed; this.steer = 0;
    this.onGround = !(opts.y > 0); this.stalled = false; this.alpha = 0; this.beta = 0; this.vs = 0; this.load = 1; this.rpm = 0.2;
    this.frozen = false; this.stuck = 0; this.crashed = false; this.autopilot = null; this.boundaryT = -1; this.outside = 0; this.ceilingWarn = false;
    this.in = { pitch: 0, roll: 0, yaw: 0 }; this.rates = { p: 0, q: 0, r: 0 }; this.airTime = 0; this.groundRoll = 0; this.wheelSpin = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vy, this.vz); }
  get absSpeed() { return this.speed; }
  get groundSpeed() { return Math.hypot(this.vx, this.vz); }
  forward() { return { x: Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  right() { return { x: Math.cos(this.yaw), z: Math.sin(this.yaw) }; }
  axes() { _fwd.set(0, 0, -1).applyQuaternion(this.q); _up.set(0, 1, 0).applyQuaternion(this.q); _right.set(1, 0, 0).applyQuaternion(this.q); return { fwd: _fwd, up: _up, right: _right }; }
  cycleFlaps() { this.flaps = this.flaps === 0 ? 10 : this.flaps === 10 ? 30 : 0; return this.flaps; }
  // Sample points in world space: nose, tail, wingtips (the wing sits 1.4 m above the origin), belly.
  samplePoints() {
    const { fwd, up, right } = this.axes(); const o = new THREE.Vector3(this.x, this.y, this.z); const pts = [];
    for (const [a, b, c] of [[4.2, 0.9, 0], [-4.1, 1.2, 0], [0, 1.6, 5.5], [0, 1.6, -5.5], [0, 0.2, 0]]) pts.push(o.clone().addScaledVector(fwd, a).addScaledVector(up, b).addScaledVector(right, c));
    return pts;
  }
  step(dt, input) {
    const P = this.P;
    this.px = this.x; this.pz = this.z; this.py = this.y; this.pyaw = this.yaw; this.pq.copy(this.q); this.time += dt;
    if (this.frozen) return;
    // Throttle lever and smoothed axes.
    if (input.boost) this.throttle = 1; else if (input.throttleUp) this.throttle = Math.min(1, this.throttle + P.throttleRate * dt); else if (input.throttleDown) this.throttle = Math.max(0, this.throttle - P.throttleRate * dt);
    this.brakes = !!input.handbrake; this.handbrakeOn = this.brakes && this.onGround;
    const ramp = (cur, tgt) => { const rate = (tgt === 0 || Math.sign(tgt) !== Math.sign(cur) ? 6.7 : 4) * dt; return cur + clamp(tgt - cur, -rate, rate); };
    this.in.pitch = ramp(this.in.pitch, input.pitch || 0); this.in.roll = ramp(this.in.roll, input.roll || 0); this.in.yaw = ramp(this.in.yaw, input.yaw || 0);
    const assist = { full: 1, light: 0.5, off: 0 }[this.assist] ?? 1;
    const { fwd, up, right } = this.axes();
    _v.set(this.vx, this.vy, this.vz); const V = _v.length();
    const qDyn = 0.5 * P.rho * V * V * P.wingArea;
    // Angle of attack and sideslip.
    if (V > 1) { this.alpha = Math.atan2(-_v.dot(up), _v.dot(fwd)); this.beta = Math.asin(clamp(_v.dot(right) / V, -1, 1)); } else { this.alpha = 0; this.beta = 0; }
    const flapF = this.flaps / 30;
    const aStall = (P.stallDeg + P.flapsStallDeg * flapF) * DEG;
    const aAbs = Math.abs(this.alpha), sgn = Math.sign(this.alpha) || 1;
    let cl = P.cl0 + P.clSlope * this.alpha + P.flapsCl * flapF;
    // Stall with hysteresis (enters above the stall angle, clears 2 degrees below it).
    const stalled = V > 8 && (this.stalled ? aAbs > aStall - 2 * DEG : aAbs > aStall);
    if (aAbs > aStall) { const clMax = P.cl0 * sgn + P.clSlope * aStall * sgn + P.flapsCl * flapF; const f = clamp((aAbs - aStall) / (7 * DEG), 0, 1); cl = clMax * (f < 1 ? lerp(1, 0.6, f) : 0.35); }
    if (stalled && !this.stalled) this.events.push({ type: 'stall' }); if (!stalled && this.stalled) this.events.push({ type: 'stallEnd' });
    this.stalled = stalled;
    const cd = P.cd0 + P.cdFlaps * flapF + (stalled ? P.cdStall : 0) + P.kInduced * cl * cl;
    // Forces.
    let ax = 0, ay = -G, az = 0;
    const ceiling = 1 - smoothstep(P.ceilingStart, P.ceilingEnd, this.y); this.ceilingWarn = this.y > P.ceilingStart;
    const thrust = this.throttle * P.thrustMax * Math.max(0, 1 - 0.5 * V / P.thrustFade) * ceiling;
    ax += fwd.x * thrust / P.mass; ay += fwd.y * thrust / P.mass; az += fwd.z * thrust / P.mass;
    if (V > 1) {
      const vhat = _v.clone().divideScalar(V);
      _lift.copy(up).addScaledVector(vhat, -up.dot(vhat)); const ln = _lift.length();
      if (ln > 1e-3) { _lift.divideScalar(ln); const L = qDyn * cl / P.mass; ax += _lift.x * L; ay += _lift.y * L; az += _lift.z * L; this.load = (qDyn * cl) / (P.mass * G); }
      const D = qDyn * cd / P.mass; ax -= vhat.x * D; ay -= vhat.y * D; az -= vhat.z * D;
      const S = -qDyn * P.sideForce * this.beta / P.mass; ax += right.x * S; ay += right.y * S; az += right.z * S;
    } else this.load = 1;
    // Commanded body rates: p roll (right wing down +), q pitch (nose up +), r yaw (nose right +).
    const qa = clamp(V / P.authoritySpeed, 0, 1), qf = clamp(V / 40, 0, 1.3) ** 2;
    // Angle-of-attack protection (assist): back stick fades out 3 degrees before the stall and the nose is eased down.
    const aProt = aStall - 3 * DEG; let pitchIn = this.in.pitch;
    if (assist > 0 && !this.onGround && this.alpha > aProt && pitchIn > 0) pitchIn *= 1 - assist * clamp((this.alpha - aProt) / (3 * DEG), 0, 1);
    let p = this.in.roll * P.rollRate * qa, qq = pitchIn * P.pitchRate * qa, r = this.in.yaw * P.yawRate * qa;
    if (assist > 0 && !this.onGround && this.alpha > aProt) qq -= (this.alpha - aProt) * 8 * assist * qa;
    const aTrim = 0.04;
    // Weathercock stability: the nose follows the airflow even at low speed (never falls flat), sideslip washes out.
    const qs = Math.max(qf, 0.35);
    qq += -P.alphaStab * (this.alpha - aTrim) * qs * (1 - 0.6 * Math.abs(pitchIn));
    r += P.betaStab * this.beta * qs;
    // Dihedral: wings level themselves a little at low speed / when stalled, whatever the assist setting.
    p += -this.roll * (0.6 * (1 - qa) + (stalled ? 0.8 : 0));
    // Attitude envelope with full assist: back stick fades out beyond 60 degrees nose up, roll beyond 80 degrees bank.
    if (assist > 0 && !this.onGround) { const bankMax = (assist === 1 ? 55 : 80) * DEG; if (this.pitch > 60 * DEG && qq > 0) qq *= clamp(1 - (this.pitch - 60 * DEG) / (10 * DEG), 0, 1); if (Math.abs(this.roll) > bankMax - 5 * DEG && Math.sign(this.in.roll) === Math.sign(this.roll)) p *= clamp(1 - (Math.abs(this.roll) - bankMax + 5 * DEG) / (5 * DEG), 0, 1); if (Math.abs(this.roll) > bankMax) p -= Math.sign(this.roll) * (Math.abs(this.roll) - bankMax) * 4; }
    if (this.autopilot) {
      // Boundary autopilot: bank 45 degrees towards the site centre until the heading is within 20 degrees.
      const want = Math.atan2(1500 - this.x, -(1500 - this.z)); const d = wrapAngle(want - this.yaw);
      const bank = clamp(d * 2, -0.8, 0.8); p = clamp((bank - this.roll) * 2.5, -P.rollRate, P.rollRate);
      qq += -clamp(this.vy * 0.15, -0.5, 0.5) * P.trimHold; this.throttle = Math.max(this.throttle, 0.7);
      if (Math.abs(d) < 20 * DEG && this.outside < this.P.boundary - 300) { this.autopilot = null; this.events.push({ type: 'boundaryDone' }); }
    } else {
      if (this.in.roll === 0 && assist > 0) { const lvl = (P.autoLevel[this.assist] ?? 1.2) * (Math.abs(this.roll) < 60 * DEG ? 1 : 0.3); p += -this.roll * lvl * qa; }
      if (this.in.yaw === 0 && assist > 0 && V > 10) { const om = G * Math.tan(clamp(this.roll, -1.2, 1.2)) / Math.max(V, 15); r += om * Math.cos(this.roll) * qa; qq += Math.abs(om * Math.sin(this.roll)) * assist * qa; }
      // Altitude hold (full assist) fades out below 55 % power so that pulling the throttle back starts a descent, as in a real aircraft.
      if (this.in.pitch === 0 && assist === 1 && !this.onGround && V > 15) qq += -clamp(this.vy * 0.2, -0.6, 0.6) * P.trimHold * qa * clamp((this.throttle - 0.3) / 0.25, 0, 1);
    }
    if (stalled) { qq -= P.stallNoseDown; p += (Math.random() - 0.5) * 2 * P.stallWobble; }
    // Ground handling overrides.
    if (this.onGround) {
      const gs = this.groundSpeed;
      const steer = this.in.yaw * lerp(P.steerLow, P.steerHigh, clamp(gs / 30, 0, 1)) * clamp(gs / 2, 0, 1);
      r = steer; this.steer = this.in.yaw * 0.45;
      p = clamp(-this.roll * 6, -3, 3);
      const canRotate = gs >= P.rotateSpeed && this.in.pitch > 0;
      const maxPitch = 10 * DEG; qq = canRotate ? (this.pitch < maxPitch ? this.in.pitch * P.pitchRate * qa : clamp(-(this.pitch - maxPitch) * 6, -2, 0)) : clamp(-this.pitch * 4, -2, 2);
      if (!canRotate && this.pitch <= 0.001 && qq < 0) qq = 0;
      // Rolling resistance, brakes; no lateral velocity on wheels.
      const fx = Math.sin(this.yaw), fz = -Math.cos(this.yaw); const vF = this.vx * fx + this.vz * fz;
      let decel = P.rollingDrag * G + (this.brakes ? P.brakeDecel : 0);
      if (Math.abs(vF) < decel * dt) { ax -= vF / dt * fx; az -= vF / dt * fz; } else { ax -= Math.sign(vF) * decel * fx; az -= Math.sign(vF) * decel * fz; }
      this.groundRoll += Math.abs(vF) * dt;
    } else this.steer = lerp(this.steer, this.in.yaw * 0.45, 1 - Math.exp(-6 * dt));
    // Rate smoothing, then integrate the attitude (body angular velocity in three.js body axes: x = pitch, y = -yaw, z = -roll).
    const k = 1 - Math.exp(-16 * dt);
    this.rates.p += (p - this.rates.p) * k; this.rates.q += (qq - this.rates.q) * k; this.rates.r += (r - this.rates.r) * k;
    _axis.set(this.rates.q, -this.rates.r, -this.rates.p); const w = _axis.length();
    if (w > 1e-6) { _dq.setFromAxisAngle(_axis.divideScalar(w), w * dt); this.q.multiply(_dq).normalize(); }
    _e.setFromQuaternion(this.q, 'YXZ'); this.pitch = _e.x; this.yaw = -_e.y; this.roll = -_e.z;
    // Integrate velocity and position.
    const pvy = this.vy;
    this.vx += ax * dt; this.vy += ay * dt; this.vz += az * dt;
    if (this.onGround) {
      // Wheels hold lateral velocity; lift-off happens when the vertical acceleration wins.
      const fx = Math.sin(this.yaw), fz = -Math.cos(this.yaw); const vF = this.vx * fx + this.vz * fz; this.vx = fx * vF; this.vz = fz * vF;
      if (this.vy < 0) this.vy = 0;
    }
    this.telemetry.accel = (this.vy - pvy) / dt;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    this.vs = this.vy;
    // Ground contact / take-off.
    if (this.onGround) {
      if (this.y > 0.002 && this.vy > 0) { this.onGround = false; this.airTime = 0; this.events.push({ type: 'liftoff' }); } else this.y = 0;
    } else {
      this.airTime += dt;
      if (this.y <= 0) { this.y = 0; this.touchdown(); }
    }
    this.telemetry.latG = V * this.rates.r; this.telemetry.slip = 0;
    this.rpm = lerp(this.rpm, 0.25 + this.throttle * 0.75, 1 - Math.exp(-2.5 * dt));
    this.wheelSpin += (this.onGround ? this.groundSpeed : 0) * dt / 0.2;
    this.checkObstacles(V);
    this.checkBoundary(dt);
  }
  touchdown() {
    const P = this.P; const sink = -this.vy;
    const inLake = pointInPolygon(this.x, this.z, this.world.lake.points);
    if (inLake) return this.crash('splashed into the lake');
    if (sink > P.crashSink) return this.crash(`hit the ground at ${sink.toFixed(1)} m/s`);
    if (Math.abs(this.roll) > P.crashBank * DEG) return this.crash('wingtip strike');
    if (this.pitch < P.crashPitchLow * DEG) return this.crash('nose-first');
    if (this.pitch > P.crashPitchHigh * DEG) return this.crash('tail strike');
    this.onGround = true; this.vy = 0; this.groundRoll = 0;
    this.events.push({ type: 'landing', sink, speed: this.groundSpeed });
  }
  crash(reason) { if (this.crashed) return; this.crashed = true; this.frozen = true; this.events.push({ type: 'crash', reason, speed: this.speed }); }
  checkObstacles(V) {
    if (this.crashed) return;
    const pts = this.samplePoints(); const near = this.colliders.near(this.x, this.z);
    let hit = null;
    for (const p of pts) for (const c of near) { if (c.dead || c.tag === 'pool') continue; if (p.x <= c.x0 || p.x >= c.x1 || p.z <= c.z0 || p.z >= c.z1 || p.y >= c.top) continue; hit = { p, c }; break; }
    if (!hit) { this.stuck = 0; return; }
    if (!this.onGround || V >= this.P.bumpSpeed) return this.crash(`flew into ${hit.c.tag === 'tree' ? 'a tree' : hit.c.tag === 'wall' ? 'the boundary wall' : hit.c.tag === 'house' ? 'a house' : 'a building'}`);
    // Taxi bump: push the plane out of the rectangle and kill the velocity like the car does.
    const c = hit.c; const dx0 = this.x - c.x0, dx1 = c.x1 - this.x, dz0 = this.z - c.z0, dz1 = c.z1 - this.z; const m = Math.min(dx0, dx1, dz0, dz1);
    if (m === dx0) this.x = c.x0 - 0.05; else if (m === dx1) this.x = c.x1 + 0.05; else if (m === dz0) this.z = c.z0 - 0.05; else this.z = c.z1 + 0.05;
    if (V > 1) this.events.push({ type: 'impact', strength: Math.min(1, V / 10) });
    this.vx *= -0.2; this.vz *= -0.2; this.stuck += 1 / 120;
  }
  checkBoundary(dt) {
    const S = CONFIG.world.size; this.outside = Math.max(0, -this.x, this.x - S, -this.z, this.z - S);
    if (this.autopilot) return;
    if (this.outside > this.P.boundary && !this.onGround) {
      if (this.boundaryT < 0) { this.boundaryT = this.P.boundaryCountdown; this.events.push({ type: 'boundary' }); }
      this.boundaryT -= dt;
      if (this.boundaryT <= 0) { this.boundaryT = -1; this.autopilot = { t: 0 }; this.events.push({ type: 'boundaryTurn' }); }
    } else this.boundaryT = -1;
  }
  takeEvents() { const e = this.events; this.events = []; return e; }
}
