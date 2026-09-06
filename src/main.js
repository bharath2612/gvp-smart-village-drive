import './style.css';
import * as THREE from 'three';
import { CONFIG, KMH } from './config.js';
import { Input } from './core/input.js';
import { Loop, SIM_DT } from './core/loop.js';
import { Settings } from './core/settings.js';
import { AudioMixer } from './core/audio.js';
import { loadLayout, roadPlacement } from './world/layout.js';
import { ColliderGrid } from './world/spatial.js';
import { buildTextures } from './world/textures.js';
import { buildGround } from './world/ground.js';
import { buildRoads } from './world/roads.js';
import { buildWall } from './world/wall.js';
import { buildBuildings } from './world/buildings.js';
import { buildAmenities } from './world/amenities.js';
import { buildLake } from './world/lake.js';
import { buildVegetation, updateLOD } from './world/vegetation.js';
import { buildProps } from './world/props.js';
import { buildLights } from './world/lights.js';
import { loadModelSet } from './world/models.js';
import { buildLighting, PRESET_ORDER } from './world/lighting.js';
import { CarModel } from './car/model.js';
import { CarVisual, loadCarModel } from './car/visual.js';
import { CameraRig } from './car/camera.js';
import { Missions, fmtTime } from './game/missions.js';
import { loadPlotData } from './game/plots.js';
import { Minimap } from './ui/minimap.js';
import { UI } from './ui/hud.js';
import { clamp, lerp } from './util/math.js';

const settings = new Settings();
const audio = new AudioMixer(settings);
const ui = new UI(settings, audio);
const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 120); });

async function boot() {
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  let qualityName = settings.get('quality'); if (qualityName === 'auto') qualityName = 'medium';
  const Q = CONFIG.quality[qualityName] || CONFIG.quality.medium;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.dpr));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = Q.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ui.fatal('The graphics context was lost. Reload the page to continue.'); });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 4200);
  window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.dpr)); });

  ui.setLoading(0.02, 'Loading the verified layout…');
  let world;
  try { world = await loadLayout(); } catch (e) { ui.fatal(e.message); throw e; }
  await loadPlotData();
  const colliders = new ColliderGrid(50);
  const ctx = { scene, renderer, camera, world, colliders, qualityPreset: Q, qualityName, animate: [] };
  // CC0 models (Kenney kits, ~1.7 MB total) load before the world is generated; the game still works if any fail.
  ui.setLoading(0.03, 'Loading CC0 models…');
  const MODEL_LIST = [
    ['tree_default', 9], ['tree_oak', 11], ['tree_detailed', 12], ['tree_fat', 9], ['tree_tall', 13], ['tree_palmDetailedTall', 12], ['tree_palmBend', 9],
    ['plant_bushDetailed', 1.1], ['flower_redA', 0.55], ['flower_yellowA', 0.55], ['flower_purpleA', 0.55], ['pot_large', 1.1], ['rock_largeA', 1.6], ['log_stack', 1.2], ['statue_column', 4],
  ].map(([key, height]) => ({ key, url: `/models/nature/${key}.glb`, height }));
  for (const [key, length] of [['sedan', 4.4], ['suv-luxury', 4.7], ['hatchback-sports', 4.2], ['van', 4.9], ['sedan-sports', 4.5], ['taxi', 4.5]]) MODEL_LIST.push({ key, url: `/models/cars/${key}.glb`, length });
  const [models, carModel] = await Promise.all([loadModelSet(MODEL_LIST, (p) => ui.setLoading(0.03 + p * 0.1)), loadCarModel()]);
  ctx.models = models; ctx.lodDistance = new URLSearchParams(location.search).get('lod') === 'off' ? 1e9 : CONFIG.lodDistance;
  console.log('[models] loaded', Object.keys(models).length, 'car', !!carModel);
  const steps = [
    ['Painting textures…', () => { ctx.T = buildTextures(qualityName); }],
    ['Laying the ground…', () => buildGround(ctx)],
    ['Building 91 roads, kerbs and lamp posts…', () => buildRoads(ctx)],
    ['Raising the 20 ft boundary wall…', () => buildWall(ctx)],
    ['Generating 1,698 buildings…', () => buildBuildings(ctx)],
    ['Temple, school, stadium, agro plant…', () => buildAmenities(ctx)],
    ['Filling the lake…', () => buildLake(ctx)],
    ['Planting trees, hedges and crops…', () => buildVegetation(ctx)],
    ['Parking cars, planting flowers…', () => buildProps(ctx)],
    ['Wiring street, garden and stadium lights…', () => buildLights(ctx)],
    ['Lighting…', () => buildLighting(ctx)],
  ];
  const t0 = performance.now();
  for (let i = 0; i < steps.length; i++) { ui.setLoading(0.15 + (i / steps.length) * 0.8, steps[i][0]); await nextFrame(); steps[i][1](); }
  console.log(`[world] built in ${Math.round(performance.now() - t0)} ms, colliders ${colliders.list.length}, trees ${ctx.treeCount}, crop shrubs ${ctx.shrubCount}`);
  // Paved (non-slowing) areas besides roads.
  ctx.pavedRects = [...world.L.commercial, ...world.L.amenities.filter((a) => ['parking', 'agro', 'fire-station', 'wtp', 'school'].includes(a.id)), ...world.L.parks.map((p) => ({ x: p.x, y: p.y + p.h / 2 - 2, w: p.w, h: 4 }))];

  const input = new Input(); input.invertSteer = settings.get('invertSteer');
  const car = new CarModel(world, colliders, ctx);
  const carVisual = new CarVisual(scene, ctx.T, carModel);
  const rig = new CameraRig(camera, settings);
  const missions = new Missions(scene, world, settings, audio, ui);
  const minimap = new Minimap(world, $('minimap'), $('bigmap-canvas'));
  minimap.mode = settings.get('minimapMode');
  ctx.lighting.set(settings.get('timeOfDay')); ctx.lighting.update(1, { x: 1500, z: 1500 });
  ui.setLoading(1, 'Ready'); await nextFrame();

  // ---------------------------------------------------------------- state
  let simTime = 0, lastNearestPick = null;
  const G = { phase: 'title', titleT: 0, swoopT: 0, paused: false, overlay: null, resumeCount: 0, lakeSeq: null, nearestTimer: 0, stillTimer: 0, autoQ: { t: 0, samples: 0, sum: 0, done: qualityName !== 'medium' || settings.get('quality') !== 'auto' } };
  const gateStart = () => { car.reset(CONFIG.world.gate.x - 6, CONFIG.world.gate.y - 14, 0); };
  gateStart();
  const at = new URLSearchParams(location.search).get('at');
  if (at && world.byId.get(at)) teleportTo(world.byId.get(at));

  function teleportTo(plot) {
    // Prefer the road the plot faces (its street), so the car lands in front of it.
    const pl = plot.road ? placeOnRoad(plot.road, plot.cx, plot.cy) : roadPlacement(world, plot.cx, plot.cy);
    // Face along the road towards the plot's side.
    const dx = plot.cx - pl.x, dz = plot.cy - pl.y;
    let yaw = pl.yaw; const f = { x: Math.sin(yaw), z: -Math.cos(yaw) };
    if (pl.road.horizontal) yaw = dx >= 0 ? Math.PI / 2 : -Math.PI / 2; else yaw = dz >= 0 ? Math.PI : 0;
    if (Math.abs(dx) < 15 && Math.abs(dz) < 15) yaw = pl.yaw;
    car.reset(pl.x, pl.y, yaw); rig.snapTo(car); ui.hideCard();
    ui.lastNearest = plot; lastNearestPick = { plot, dist: 0 }; G.stillTimer = CONFIG.ui.plotCardDelay;
    ui.toast(`Teleported to ${plot.kind} ${plot.n || ''}`.trim(), 3);
  }
  function placeOnRoad(r, x, y) {
    if (r.horizontal) return { x: Math.min(Math.max(x, r.x + 10), r.x + r.w - 10), y: r.y + r.h / 2, yaw: Math.PI / 2, road: r };
    return { x: r.x + r.w / 2, y: Math.min(Math.max(y, r.y + 10), r.y + r.h - 10), yaw: 0, road: r };
  }
  function resetToRoad() {
    const pl = roadPlacement(world, car.x, car.z, car.yaw);
    car.reset(pl.x, pl.y, pl.yaw); rig.snapTo(car); ui.hideCard();
  }
  function respawnOnTrack() {
    const lk = world.lake.bbox; const o = 15;
    const x0 = lk.x - o, x1 = lk.x + lk.w + o, z0 = lk.y - o, z1 = lk.y + lk.h + o;
    const cx = clamp(car.x, x0, x1), cz = clamp(car.z, z0, z1);
    const d = [[Math.abs(cx - x0), x0, cz, Math.PI], [Math.abs(cx - x1), x1, cz, 0], [Math.abs(cz - z0), cx, z0, Math.PI / 2], [Math.abs(cz - z1), cx, z1, -Math.PI / 2]].sort((a, b) => a[0] - b[0])[0];
    car.reset(d[1], d[2], d[3]); rig.snapTo(car);
  }

  // ---------------------------------------------------------------- overlays
  const overlays = { pause: $('pause'), missions: $('missions'), settings: $('settings'), teleport: $('teleport'), bigmap: $('bigmap') };
  function openOverlay(name) {
    closeOverlay();
    G.overlay = name; overlays[name].classList.remove('hidden'); input.enabled = false; input.clear();
    if (G.phase === 'drive') loop.paused = true;
    if (name === 'missions') renderMissionList();
    if (name === 'settings') syncSettingsUI();
    if (name === 'teleport') { $('tp-input').value = ''; renderTeleportList(''); setTimeout(() => $('tp-input').focus(), 30); }
    if (name === 'bigmap') minimap.drawBig(car, missions.active ? missions.active.rings.filter((r, i) => !missions.done.has(i)) : [], missions.target());
  }
  function closeOverlay() {
    if (!G.overlay) return;
    overlays[G.overlay].classList.add('hidden'); G.overlay = null; input.enabled = G.phase === 'drive';
    if (G.phase === 'drive' && !document.hidden) loop.paused = false;
  }
  function renderMissionList() {
    const list = $('mission-list'); list.innerHTML = '';
    for (const m of missions.defs) {
      const row = document.createElement('div'); row.className = 'mission-row';
      const best = m.timed && settings.get('bestLap') ? ` · best ${fmtTime(settings.get('bestLap'))}` : '';
      row.innerHTML = `<div><b>${m.name}${missions.active === m ? ' (active)' : ''}</b><span>${m.desc}${best}</span></div>`;
      const b = document.createElement('button'); b.className = 'btn small gold'; b.textContent = 'Start'; b.onclick = () => { audio.click(); if (G.phase !== 'drive') startDrive(); missions.start(m.id); closeOverlay(); }; row.appendChild(b); list.appendChild(row);
    }
  }
  const searchable = world.plots.map((p) => ({ p, key: `${p.kind} ${p.n || ''} ${p.id} ${p.name || ''}`.toLowerCase() }));
  let tpSel = 0, tpMatches = [];
  function renderTeleportList(q) {
    q = q.trim().toLowerCase().replace(/^th\b/, 'town house').replace(/^com\b/, 'commercial').replace(/^v\b/, 'villa').replace(/^f\b/, 'farm');
    const m = /^([a-z ]+?)\s*(\d+)$/.exec(q);
    tpMatches = searchable.filter(({ p, key }) => {
      if (!q) return p.type === 'amenity' || p.type === 'park';
      if (m) return key.includes(m[1].trim()) && String(p.n) === m[2];
      return key.includes(q);
    }).slice(0, 12);
    tpSel = 0; const list = $('tp-list'); list.innerHTML = '';
    tpMatches.forEach(({ p }, i) => { const d = document.createElement('div'); d.textContent = `${p.kind}${p.n ? ' ' + p.n : ''} · ${world.zoneOf(p.cx, p.cy)}`; d.className = i === tpSel ? 'sel' : ''; d.onclick = () => { doTeleport(p); }; list.appendChild(d); });
  }
  function doTeleport(p) { closeOverlay(); if (G.phase !== 'drive') startDrive(); teleportTo(p); audio.click(); }
  $('tp-input').addEventListener('input', (e) => renderTeleportList(e.target.value));
  $('tp-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && tpMatches[tpSel]) { doTeleport(tpMatches[tpSel].p); e.preventDefault(); }
    if (e.key === 'ArrowDown') { tpSel = Math.min(tpMatches.length - 1, tpSel + 1); [...$('tp-list').children].forEach((c, i) => c.classList.toggle('sel', i === tpSel)); e.preventDefault(); }
    if (e.key === 'ArrowUp') { tpSel = Math.max(0, tpSel - 1); [...$('tp-list').children].forEach((c, i) => c.classList.toggle('sel', i === tpSel)); e.preventDefault(); }
    if (e.key === 'Escape') { closeOverlay(); e.stopPropagation(); }
    e.stopPropagation();
  });
  function syncSettingsUI() {
    $('s-quality').value = settings.get('quality'); $('s-tod').value = ctx.lighting.name; $('s-master').value = settings.get('master'); $('s-engine').value = settings.get('engine'); $('s-ambience').value = settings.get('ambience');
    $('s-chase').value = settings.get('chaseDistance'); $('s-invert').checked = settings.get('invertSteer'); $('s-minimap').value = settings.get('minimapMode');
  }
  $('s-quality').onchange = (e) => settings.set('quality', e.target.value);
  $('s-tod').onchange = (e) => { settings.set('timeOfDay', e.target.value); ctx.lighting.set(e.target.value); };
  for (const k of ['master', 'engine', 'ambience']) $(`s-${k}`).oninput = (e) => { settings.set(k, +e.target.value); audio.applyVolumes(); };
  $('s-chase').onchange = (e) => settings.set('chaseDistance', e.target.value);
  $('s-invert').onchange = (e) => { settings.set('invertSteer', e.target.checked); input.invertSteer = e.target.checked; };
  $('s-minimap').onchange = (e) => { settings.set('minimapMode', e.target.value); minimap.mode = e.target.value; };
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act; audio.click();
    if (act === 'resume' || act === 'close') closeOverlay();
    if (act === 'missions') openOverlay('missions');
    if (act === 'settings') openOverlay('settings');
    if (act === 'controls') { closeOverlay(); ui.showControls(8); }
    if (act === 'restart') { closeOverlay(); missions.abandon(); gateStart(); rig.snapTo(car); ui.hideCard(); }
    if (act === 'abandon') { missions.abandon(); ui.setWrongWay(false); renderMissionList(); }
    if (act === 'driveon') ui.hideComplete();
    if (act === 'next') { ui.hideComplete(); openOverlay('missions'); }
  }));
  $('tod-btn').onclick = () => cycleTod(); $('mute-btn').onclick = () => audio.setMuted(!audio.muted); $('pause-btn').onclick = () => openOverlay('pause');
  $('title-missions').onclick = () => openOverlay('missions'); $('title-settings').onclick = () => openOverlay('settings');
  function cycleTod() { const i = PRESET_ORDER.indexOf(ctx.lighting.name); const n = PRESET_ORDER[(i + 1) % 3]; ctx.lighting.set(n); settings.set('timeOfDay', n); }

  // ---------------------------------------------------------------- actions
  input.on('camera', () => { if (G.phase === 'drive' && !G.overlay) { rig.cycle(); audio.click(); } });
  input.on('reset', () => { if (G.phase === 'drive' && !G.overlay) resetToRoad(); });
  input.on('timeOfDay', () => { if (!G.overlay) cycleTod(); });
  input.on('teleport', () => { if (G.phase === 'drive') openOverlay(G.overlay === 'teleport' ? null : 'teleport'); });
  input.on('map', () => { if (G.overlay === 'bigmap') closeOverlay(); else if (G.phase === 'drive') openOverlay('bigmap'); });
  input.on('missions', () => { if (G.overlay === 'missions') closeOverlay(); else openOverlay('missions'); });
  input.on('mute', () => audio.setMuted(!audio.muted));
  input.on('help', () => ui.showControls(8));
  input.on('pause', () => { if (ui.cardPlot) { ui.hideCard(); return; } if (G.overlay) closeOverlay(); else if (G.phase === 'drive') openOverlay('pause'); });
  input.on('confirm', () => { if (G.phase === 'title' && !G.overlay) startDrive(); });
  input.on('debug', () => { $('debug').classList.toggle('hidden'); $('tuning').classList.toggle('hidden'); if (!$('tuning').children.length) buildTuning(); });
  $('start-btn').onclick = () => startDrive();
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (G.phase !== 'drive') return; if (document.hidden) { loop.paused = true; G.resumeCount = 0; hiddenAt = performance.now(); } else if (!G.overlay) { if (performance.now() - hiddenAt > 4000) { G.resumeCount = 3; ui.showResume(3); } else { loop.paused = false; ui.showResume(0); } } });

  function buildTuning() {
    const t = $('tuning'); t.innerHTML = '<b style="color:#c9a227">Handling (backtick toggles)</b>';
    const keys = ['topSpeed', 'boostSpeed', 'accel', 'brake', 'steerLowDeg', 'steerHighDeg', 'steerRateDeg', 'wheelbase', 'gripNormal', 'gripHandbrake', 'gripSlide', 'handbrakeYawGain', 'offroadFactor'];
    for (const k of keys) { const v = car.h[k]; const l = document.createElement('label'); const max = v > 50 ? 400 : v > 5 ? 60 : v > 1 ? 5 : 1; const step = v > 5 ? 1 : 0.005; l.innerHTML = `<span>${k}</span><input type="range" min="${v > 1 ? 0.5 : 0.8}" max="${max}" step="${step}" value="${v}"><span class="v">${v}</span>`; l.querySelector('input').oninput = (e) => { car.h[k] = +e.target.value; l.querySelector('.v').textContent = e.target.value; }; t.appendChild(l); }
  }

  // ---------------------------------------------------------------- phases
  function startDrive() {
    if (G.phase === 'drive') return;
    closeOverlay();
    audio.unlock(); audio.setAmbience(ctx.lighting.ambience);
    ui.hideTitle(); ui.showHud();
    G.phase = 'swoop'; G.swoopT = 0; G.swoopFrom = camera.position.clone(); G.swoopLook = new THREE.Vector3(1500, 0, 1500);
    input.enabled = false;
  }
  function finishSwoop() { G.phase = 'drive'; input.enabled = true; rig.snapTo(car); ui.showControls(CONFIG.ui.controlsCardSeconds); ui.toast('Welcome to GVP Smart Village. Drive anywhere. Press Tab for missions, T to find a plot.', 6); }

  // ---------------------------------------------------------------- sim
  function sim(dt) {
    if (G.phase !== 'drive' || G.resumeCount > 0) return;
    car.handbrakeOn = input.handbrake;
    if (G.lakeSeq) { car.frozen = true; return; }
    car.step(dt, input);
    missions.update(dt, car);
  }
  // ---------------------------------------------------------------- render
  function render(dt, alpha) {
    simTime += dt;
    input.sample();
    if (G.phase === 'title') {
      G.titleT += dt; const a = G.titleT * 0.05; const r = 1500;
      camera.position.set(1500 + Math.sin(a) * r, 520, 1500 + Math.cos(a) * r); camera.up.set(0, 1, 0); camera.lookAt(1500, 0, 1500); camera.fov = 55; camera.updateProjectionMatrix();
      ctx.lighting.update(dt, { x: camera.position.x, z: camera.position.z });
    } else if (G.phase === 'swoop') {
      G.swoopT += dt; const t = clamp(G.swoopT / 2.5, 0, 1); const e = t * t * (3 - 2 * t);
      rig.snapTo(car); const target = camera.position.clone(); const look = new THREE.Vector3(car.x, 1.1, car.z - 4);
      camera.position.lerpVectors(G.swoopFrom, target, e); camera.up.set(0, 1, 0); camera.lookAt(G.swoopLook.clone().lerp(look, e)); camera.fov = lerp(55, 60, e); camera.updateProjectionMatrix();
      ctx.lighting.update(dt, car);
      if (t >= 1) finishSwoop();
    } else {
      // Resume countdown after a hidden tab.
      if (G.resumeCount > 0 && !G.overlay) { G.resumeT = (G.resumeT || 0) + dt; if (G.resumeT > 0.8) { G.resumeT = 0; G.resumeCount--; ui.showResume(G.resumeCount); if (G.resumeCount === 0) loop.paused = false; } }
      for (const ev of car.takeEvents()) {
        if (ev.type === 'impact') { audio.thud(ev.strength); rig.addShake(ev.strength); carVisual.kick(ev.strength); }
        if (ev.type === 'bump') { audio.bump(); carVisual.kick(0.4 + ev.strength * 0.6); rig.addShake(0.15 + ev.strength * 0.3); }
        if (ev.type === 'hedge') audio.rustle();
        if (ev.type === 'boost') audio.boostStart();
        if (ev.type === 'stuckReset') { resetToRoad(); ui.toast('Unstuck: back on the road.', 2); }
        if (ev.type === 'lake' && !G.lakeSeq) { G.lakeSeq = { t: 0 }; audio.splash(); rig.addShake(0.6); $('splash').classList.add('show'); ui.toast('Splash! Fished out onto the joggers’ track.', 4); }
      }
      if (G.lakeSeq) { G.lakeSeq.t += dt; carVisual.root.position.y = -Math.min(1.5, G.lakeSeq.t * 2); if (G.lakeSeq.t > 0.9 && !G.lakeSeq.moved) { G.lakeSeq.moved = true; respawnOnTrack(); $('splash').classList.remove('show'); } if (G.lakeSeq.t > 1.4) { G.lakeSeq = null; car.frozen = false; carVisual.root.position.y = 0; } }
      carVisual.update(dt, car, alpha, input, simTime);
      rig.update(dt, car, alpha, input);
      ctx.lighting.update(dt, car);
      carVisual.setNight(ctx.lighting.isNight);
      audio.setAmbience(ctx.lighting.ambience);
      audio.update(dt, { speed: car.speed, throttle: input.throttle, boosting: car.boosting, offroad: car.offroad, hedge: car.hedge, slip: car.telemetry.slip });
      ui.update(dt, car, world, missions, ctx.lighting, rig.mode);
      minimap.draw(car, missions.active ? missions.active.rings.filter((r, i) => !missions.done.has(i)) : [], missions.target());
      // Nearest plot every 0.25 s; card after 1 s stopped within 20 m.
      G.nearestTimer += dt;
      if (G.nearestTimer > 0.25) { G.nearestTimer = 0; lastNearestPick = ui.updateNearest(car, world); }
      const stopped = Math.abs(car.speed) < CONFIG.ui.plotCardSpeed;
      G.stillTimer = stopped ? G.stillTimer + dt : 0;
      if (input.throttle > 0.5 && ui.cardPlot) ui.hideCard();
      if (G.stillTimer > CONFIG.ui.plotCardDelay && lastNearestPick && lastNearestPick.dist <= CONFIG.ui.plotCardRadius && !ui.cardPlot && !G.overlay) ui.showCard(lastNearestPick.plot, world);
      if (ctx.crops) ctx.crops.update(car.time);
      // Auto quality: 3 s sample after start; drop once if under 45 fps.
      if (!G.autoQ.done) { G.autoQ.t += dt; if (G.autoQ.t > 2) { G.autoQ.sum += 1 / Math.max(dt, 1e-3); G.autoQ.samples++; } if (G.autoQ.t > 5) { G.autoQ.done = true; const avg = G.autoQ.sum / G.autoQ.samples; console.log('[auto-quality] avg fps', avg.toFixed(1)); if (avg < 45) { settings.set('quality', 'low'); renderer.shadowMap.enabled = false; ctx.lighting.sun.castShadow = false; renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); ui.toast('Performance: switched to Low quality (saved for next time).', 4); } } }
      if (!$('debug').classList.contains('hidden')) {
        const info = renderer.info;
        ui.debug([`fps ${loop.fps.toFixed(0)}  frame ${(dt * 1000).toFixed(1)} ms  steps ${loop.stepsThisFrame}`, `draw calls ${info.render.calls}  tris ${(info.render.triangles / 1e6).toFixed(2)} M`, `pos ${car.x.toFixed(1)}, ${car.z.toFixed(1)}  yaw ${(car.yaw * 57.3).toFixed(0)}°`, `speed ${(car.speed * KMH).toFixed(1)} km/h  slip ${(car.telemetry.slip * 30).toFixed(1)}°  latG ${car.telemetry.latG.toFixed(1)}`, `steer ${(car.steer * 57.3).toFixed(1)}° / max ${(car.steerMax * 57.3).toFixed(0)}°  boost ${(car.boostCharge * 100).toFixed(0)}%`, `offroad ${car.offroad}  hedge ${!!car.hedge}  stuck ${car.stuck.toFixed(2)}`, `zone ${world.zoneOf(car.x, car.z)}  nearest ${lastNearestPick ? lastNearestPick.plot.id : '-'}`, `colliders ${colliders.list.length}  trees ${ctx.treeCount}  shrubs ${ctx.shrubCount}  parked ${ctx.parkedCars || 0}  lights ${JSON.stringify(ctx.lightCounts || {})}`, `counts farms ${world.L.farms.length} villas ${world.L.villas.length} th ${world.L.townhouses.length} com ${world.L.commercial.length} parks ${world.L.parks.length}`]);
      }
    }
    for (const fn of ctx.animate) fn(dt, simTime);
    updateLOD(ctx, camera.position);
    renderer.render(scene, camera);
  }
  const loop = new Loop(sim, render);
  ui.hideLoading(); ui.showTitle(settings.get('bestLap'));
  loop.start();
  window.__svd = { car, world, ctx, rig, missions, settings, teleportTo, startDrive, finishSwoop, G, carVisual, loop };
}
boot().catch((e) => { console.error('[boot] ' + (e && e.stack ? e.stack : String(e))); ui.fatal((e && (e.message || e.stack)) || String(e)); });
