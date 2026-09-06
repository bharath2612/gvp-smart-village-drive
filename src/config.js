// Every tunable number lives here. Units: metres, seconds, radians (degrees only where noted).
export const CONFIG = {
  title: 'Smart Village Drive',
  brandColor: 0x1e4fa3,
  salesEmail: 'rkreddyzoomin@gmail.com',
  planViewerUrl: 'https://gvp-smart-village-plan.vercel.app',
  expectedCounts: { farms: 564, villas: 560, townhouses: 504, commercial: 70, parks: 4 },
  car: {
    // Drop a CC0 GLB of your own (e.g. the Meshy Honda SUV) at public/models/suv.glb and it is used instead of the Kenney SUV.
    // Wheels are found by node names containing "wheel" (front/back); the paint colour (dominant vertex colour) is replaced by brandColor.
    overrideModel: '/models/suv.glb', model: '/models/cars/suv.glb', length: 4.7,
  },
  lodDistance: 380,
  world: { size: 3000, outside: 700, wallHeight: 6.1, wallThickness: 0.4, gate: { x: 1500, y: 3000 }, plain: 14000, cameraFar: 9000 },
  // Charter plane: Cessna 172 style trainer. Forces in N, masses in kg, angles in radians unless *Deg.
  plane: {
    mass: 1000, wingArea: 16.2, rho: 1.225,
    clSlope: 5.0, cl0: 0.1, stallDeg: 15, flapsCl: 0.4, flapsStallDeg: 2,
    cd0: 0.03, cdFlaps: 0.02, cdStall: 0.03, kInduced: 0.05, sideForce: 1.0,
    thrustMax: 3000, thrustFade: 75, ceilingStart: 800, ceilingEnd: 950,
    rollRate: 1.9, pitchRate: 1.2, yawRate: 0.8, authoritySpeed: 35,
    alphaStab: 4.0, betaStab: 3.0, rollDamp: 2.5,
    autoLevel: { full: 1.2, light: 0.4, off: 0 }, trimHold: 1.6,
    stallNoseDown: 1.0, stallWobble: 0.3,
    rotateSpeed: 24, brakeDecel: 3.4, rollingDrag: 0.02, steerLow: 1.6, steerHigh: 0.25,
    crashSink: 4.5, crashBank: 20, crashPitchLow: -8, crashPitchHigh: 15, bumpSpeed: 8,
    boundary: 2000, boundaryCountdown: 10, throttleRate: 0.4,
    span: 11, length: 8.3, gearHeight: 1.05,
  },
  handling: {
    topSpeed: 33.3,        // m/s (120 km/h)
    boostSpeed: 44.4,      // m/s (160 km/h)
    accel: 8.0,            // m/s^2 engine push at zero speed
    boostAccel: 16.0,
    brake: 12.0,
    reverseMax: 8.3,       // 30 km/h
    reverseAccel: 5.0,
    rolling: 0.6,          // m/s^2 coast-down
    steerLowDeg: 32,
    steerHighDeg: 8,
    steerRateDeg: 200,
    steerReturnDeg: 320,
    wheelbase: 3.0,
    gripNormal: 0.92,      // lateral velocity retained per 120 Hz step
    gripHandbrake: 0.985,
    gripSlide: 0.965,      // when slip angle is above slipHighDeg
    slipLowDeg: 8,
    slipHighDeg: 25,
    handbrakeYawGain: 1.35,
    handbrakeDecel: 4.0,
    offroadFactor: 0.85,
    offroadDrag: 1.6,
    hedgeFactor: 0.85,
    boostDuration: 2.0,
    boostRecharge: 8.0,
    slideKeep: 0.7,        // tangential velocity kept on impact
    stuckNudgeAfter: 0.5,
  },
  camera: {
    chase: { back: 7.5, up: 2.9, backFast: 10.5, upFast: 3.6, lookAhead: 6, fov: 60, fovFast: 70, k: 8, damp: 0.9 },
    hood: { fov: 75 },
    drone: { height: 180 },
    plane: { chase: { back: 12, up: 3.5, backFast: 15, fov: 60, fovFast: 72, bankFollow: 0.35 }, cockpit: { eye: [-0.36, 1.8, 1.25], fov: 72 }, flyby: { ahead: 120, side: 40 } },
    orbit: { min: 4, max: 60 },
  },
  quality: {
    low: { shadows: false, shadowMap: 1024, shadowRadius: 60, treeDensity: 0.4, dpr: 1.5, water: 'flat', lamps: 0.5 },
    medium: { shadows: true, shadowMap: 2048, shadowRadius: 150, treeDensity: 0.7, dpr: 2, water: 'animated', lamps: 1 },
    high: { shadows: true, shadowMap: 4096, shadowRadius: 300, treeDensity: 1.0, dpr: 2, water: 'animated', lamps: 1 },
  },
  ui: {
    plotCardRadius: 20, plotCardSpeed: 3 / 3.6, plotCardDelay: 1.0, nearestRadius: 25,
    controlsCardSeconds: 5,
  },
};
export const KMH = 3.6;
export const DEG = Math.PI / 180;
