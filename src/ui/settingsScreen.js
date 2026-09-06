// Game-style settings screen: tab rail, segmented controls, sliders, switches, keyboard navigation and a live 3D
// vehicle showcase rendered on its own small canvas only while the screen is open (nothing runs when it is closed).
import * as THREE from 'three';
import { PlaneVisual } from '../plane/visual.js';
import { BoatVisual } from '../boat/boat.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

const VEHICLES = [
  { id: 'car', name: 'SUV', kicker: 'Road', blurb: 'The village runabout. 120 km/h on the spine, 160 with boost, handbrake drifts, and every parked car can be swapped into with E.', stats: [['Top speed', 0.62, '120 km/h'], ['Boost', 0.8, '160 km/h'], ['Handling', 0.75, 'Arcade grip'], ['Seats', 0.55, '5']], select: true },
  { id: 'plane', name: 'Charter plane', kicker: 'Air · Cessna 172 style', blurb: 'Board at GVP Airstrip outside the main gate. Rotate at 100 km/h, cruise at 200, see the whole 3 km plan in one frame. Assists keep it friendly.', stats: [['Cruise', 0.85, '226 km/h'], ['Climb', 0.7, '5 m/s'], ['Ceiling', 0.9, '900 m'], ['Stall', 0.3, '90 km/h']], select: true },
  { id: 'boat', name: 'Motor boat', kicker: 'Water · marina only', blurb: 'Waiting at the lake marina pier. Drive to the marina gate and press B; it cannot be chosen from here.', stats: [['Top speed', 0.3, '50 km/h'], ['Turning', 0.5, 'Rudder needs way'], ['Wake', 0.9, 'Big'], ['Seats', 0.6, '6']], select: false },
];
const TABS = [['vehicle', 'Vehicle', '1'], ['flight', 'Flight', '2'], ['graphics', 'Graphics', '3'], ['audio', 'Audio', '4'], ['controls', 'Controls', '5']];
const KEYS = {
  car: [['W / ↑', 'Throttle'], ['S / ↓', 'Brake · reverse'], ['A D / ← →', 'Steer'], ['Space', 'Handbrake'], ['Shift', 'Boost'], ['E', 'Swap into a parked car'], ['B', 'Boat at the marina gate'], ['F', 'Plane at the airstrip hangar']],
  plane: [['W / S', 'Throttle lever'], ['Shift', 'Full power'], ['↓ / ↑', 'Pull up · push down'], ['← →', 'Bank'], ['A D', 'Rudder · nosewheel'], ['Space', 'Wheel brakes'], ['V', 'Flaps 0 · 10 · 30'], ['F', 'Park on the apron']],
  all: [['C', 'Camera'], ['R', 'Reset · runway respawn'], ['N', 'Time of day'], ['T', 'Teleport to a plot'], ['M', 'Map · waypoint'], ['Tab', 'Missions'], ['X', 'Mute'], ['Esc', 'Pause · settings'], ['`', 'Debug and tuning']],
};

export class SettingsScreen {
  // hooks: { get(k), set(k, v), state() -> { vehicle, tod, quality }, onVehicle(id), onTod(name), onQuality(v), onAudio(), onChase(v), onInvert(b), onMinimap(v), onAssist(v), onPitch(v), onClose(), onReload(), onDefaults() }
  constructor(root, hooks, ctx) {
    this.root = root; this.hooks = hooks; this.ctx = ctx; this.tab = 'vehicle'; this.focus = 0; this.open = false; this.preview = null; this.lastPreview = 0;
    this.build();
  }
  build() {
    const r = this.root; r.innerHTML = '';
    const gs = h('div', 'gs'); r.appendChild(gs);
    const head = h('div', 'gs-head', `<div><div class="gs-kicker">GVP Smart Village · SV-1</div><h2>Settings</h2></div>`);
    const close = h('button', 'gs-close', '✕'); close.title = 'Close (Esc)'; close.onclick = () => this.hooks.onClose(); head.appendChild(close); gs.appendChild(head);
    const body = h('div', 'gs-body'); gs.appendChild(body);
    this.tabsEl = h('nav', 'gs-tabs'); body.appendChild(this.tabsEl);
    for (const [id, label, key] of TABS) { const b = h('button', 'gs-tab', `<span class="k">${key}</span>${label}`); b.dataset.tab = id; b.onclick = () => this.showTab(id); this.tabsEl.appendChild(b); }
    this.panes = {}; const pane = h('div', 'gs-pane'); body.appendChild(pane);
    for (const [id] of TABS) { const p = h('section', 'gs-section'); p.dataset.tab = id; pane.appendChild(p); this.panes[id] = p; }
    this.buildVehicle(this.panes.vehicle); this.buildFlight(this.panes.flight); this.buildGraphics(this.panes.graphics); this.buildAudio(this.panes.audio); this.buildControls(this.panes.controls);
    const foot = h('div', 'gs-foot', `<span><kbd>1</kbd>–<kbd>5</kbd> tabs · <kbd>↑</kbd><kbd>↓</kbd> move · <kbd>←</kbd><kbd>→</kbd> change · <kbd>Esc</kbd> close</span>`);
    const defaults = h('button', 'gs-link', 'Restore defaults'); defaults.onclick = () => this.hooks.onDefaults(); foot.appendChild(defaults);
    gs.appendChild(foot);
    this.onKey = (e) => this.key(e); this.showTab('vehicle');
  }
  // ------------------------------------------------------------ controls
  segmented(parent, { key, label, desc, options, get, set }) {
    const row = h('div', 'gs-row'); row.tabIndex = 0; row.dataset.key = key;
    row.appendChild(h('div', 'gs-label', `<b>${label}</b>${desc ? `<span>${desc}</span>` : ''}`));
    const seg = h('div', 'gs-seg'); row.appendChild(seg);
    const btns = options.map(([v, text, swatch]) => { const b = h('button', 'gs-opt', `${swatch ? `<i class="sw ${swatch}"></i>` : ''}${text}`); b.dataset.v = v; b.onclick = () => { set(v); this.refresh(); this.pop(b); }; seg.appendChild(b); return b; });
    row._refresh = () => { const cur = String(get()); btns.forEach((b) => b.classList.toggle('on', b.dataset.v === cur)); };
    row._step = (d) => { const vals = options.map((o) => o[0]); let i = vals.indexOf(get()); i = Math.min(vals.length - 1, Math.max(0, i + d)); if (String(vals[i]) !== String(get())) { set(vals[i]); this.refresh(); this.pop(btns[i]); } };
    parent.appendChild(row); return row;
  }
  slider(parent, { key, label, desc, min = 0, max = 100, get, set, fmt = (v) => `${v}%` }) {
    const row = h('div', 'gs-row'); row.tabIndex = 0; row.dataset.key = key;
    row.appendChild(h('div', 'gs-label', `<b>${label}</b>${desc ? `<span>${desc}</span>` : ''}`));
    const wrap = h('div', 'gs-slider'); const val = h('span', 'gs-val'); const inp = h('input'); inp.type = 'range'; inp.min = min; inp.max = max; wrap.appendChild(inp); wrap.appendChild(val); row.appendChild(wrap);
    inp.oninput = () => { set(+inp.value); row._refresh(); };
    row._refresh = () => { const v = get(); inp.value = v; val.textContent = fmt(v); inp.style.setProperty('--p', `${((v - min) / (max - min)) * 100}%`); };
    row._step = (d) => { set(Math.min(max, Math.max(min, get() + d * 5))); row._refresh(); };
    parent.appendChild(row); return row;
  }
  toggle(parent, { key, label, desc, get, set }) {
    const row = h('div', 'gs-row'); row.tabIndex = 0; row.dataset.key = key;
    row.appendChild(h('div', 'gs-label', `<b>${label}</b>${desc ? `<span>${desc}</span>` : ''}`));
    const sw = h('button', 'gs-switch', '<i></i>'); sw.onclick = () => { set(!get()); this.refresh(); }; row.appendChild(sw);
    row._refresh = () => sw.classList.toggle('on', !!get());
    row._step = (d) => { set(d > 0); this.refresh(); };
    parent.appendChild(row); return row;
  }
  pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  // ------------------------------------------------------------ tabs
  buildVehicle(p) {
    p.appendChild(h('div', 'gs-title', '<h3>Vehicle</h3><p>What you drive when the settings close. The boat lives at the marina.</p>'));
    const show = h('div', 'gs-showcase'); p.appendChild(show);
    this.previewCanvas = h('canvas', 'gs-preview'); this.previewCanvas.width = 640; this.previewCanvas.height = 336; show.appendChild(this.previewCanvas);
    this.showInfo = h('div', 'gs-showinfo'); show.appendChild(this.showInfo);
    const cards = h('div', 'gs-cards'); p.appendChild(cards); this.cards = {};
    for (const v of VEHICLES) {
      const c = h('button', `gs-card${v.select ? '' : ' info'}`, `<span class="kicker">${v.kicker}</span><span class="name">${v.name}</span><span class="pick">${v.select ? 'Select' : 'At the marina'}</span>`);
      c.dataset.v = v.id; c.onmouseenter = () => this.showVehicle(v.id); c.onfocus = () => this.showVehicle(v.id);
      c.onclick = () => { if (v.select) { this.hooks.onVehicle(v.id); this.refresh(); this.pop(c); } else this.showVehicle(v.id); };
      cards.appendChild(c); this.cards[v.id] = c;
    }
    this.segmented(p, { key: 'chaseDistance', label: 'Chase camera distance', desc: 'How far the camera trails the car or plane.', options: [['near', 'Near'], ['normal', 'Normal'], ['far', 'Far']], get: () => this.hooks.get('chaseDistance'), set: (v) => this.hooks.onChase(v) });
    this.segmented(p, { key: 'minimapMode', label: 'Minimap', desc: 'North-up like a map, or rotating with your heading.', options: [['north', 'North-up'], ['rotate', 'Rotating']], get: () => this.hooks.get('minimapMode'), set: (v) => this.hooks.onMinimap(v) });
    this.toggle(p, { key: 'invertSteer', label: 'Invert steering', desc: 'Swap A and D (and the arrow keys) on the road.', get: () => this.hooks.get('invertSteer'), set: (v) => this.hooks.onInvert(v) });
  }
  buildFlight(p) {
    p.appendChild(h('div', 'gs-title', '<h3>Flight</h3><p>The charter plane is arcade-real: lift, drag, stall and flaps are simulated, assists keep it friendly.</p>'));
    this.segmented(p, { key: 'flightAssist', label: 'Flight assist', desc: 'Full: wings level themselves, turns are coordinated, altitude holds above half power, stall protection, bank capped at 55°. Light: gentler help. Off: you are the pilot.', options: [['full', 'Full'], ['light', 'Light'], ['off', 'Off']], get: () => this.hooks.get('flightAssist'), set: (v) => this.hooks.onAssist(v) });
    this.segmented(p, { key: 'pitchMode', label: 'Pitch convention', desc: 'Pilot: ↓ pulls the nose up, like pulling a yoke. Arcade: ↑ raises the nose.', options: [['pilot', 'Pilot · ↓ climbs'], ['arcade', 'Arcade · ↑ climbs']], get: () => this.hooks.get('pitchMode'), set: (v) => this.hooks.onPitch(v) });
    p.appendChild(h('div', 'gs-tips', '<b>Flying tips</b><ul><li>Full power (Shift), pull back at 100 km/h, ease off once airborne.</li><li>Bank to turn; the nose follows. Throttle sets climb or descent.</li><li>Land on the runway or any road: flaps 30 (V), 35 % power, let it settle. Space brakes.</li><li>2 km beyond the wall a countdown turns you back. Above 800 m the engine fades.</li></ul>'));
  }
  buildGraphics(p) {
    p.appendChild(h('div', 'gs-title', '<h3>Graphics</h3><p>Quality changes take effect after a reload. Time of day changes instantly.</p>'));
    this.segmented(p, { key: 'quality', label: 'Quality', desc: 'Auto picks Medium and drops to Low if the first seconds run under 45 fps. High renders 4K shadows and every tree.', options: [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], get: () => this.hooks.get('quality'), set: (v) => this.hooks.onQuality(v) });
    const reload = h('div', 'gs-row gs-inline'); reload.appendChild(h('div', 'gs-label', '<b>Apply quality</b><span>Reloads the game with the chosen quality; your position is not kept.</span>')); const b = h('button', 'gs-btn', 'Reload now'); b.onclick = () => this.hooks.onReload(); reload.appendChild(b); p.appendChild(reload);
    this.segmented(p, { key: 'timeOfDay', label: 'Time of day', desc: 'Day, a 6 pm sunset, or night with every street, garden and stadium lit.', options: [['day', 'Day', 'day'], ['sunset', 'Sunset', 'sunset'], ['night', 'Night', 'night']], get: () => this.hooks.state().tod, set: (v) => this.hooks.onTod(v) });
  }
  buildAudio(p) {
    p.appendChild(h('div', 'gs-title', '<h3>Audio</h3><p>Every sound is synthesised in the browser: engine, prop, wind, tyres, birds and crickets.</p>'));
    this.slider(p, { key: 'master', label: 'Master volume', get: () => this.hooks.get('master'), set: (v) => { this.hooks.set('master', v); this.hooks.onAudio(); } });
    this.slider(p, { key: 'engine', label: 'Engine and prop', get: () => this.hooks.get('engine'), set: (v) => { this.hooks.set('engine', v); this.hooks.onAudio(); } });
    this.slider(p, { key: 'ambience', label: 'Ambience', desc: 'Birds by day, crickets at night, lake water.', get: () => this.hooks.get('ambience'), set: (v) => { this.hooks.set('ambience', v); this.hooks.onAudio(); } });
    this.toggle(p, { key: 'muted', label: 'Mute everything', desc: 'X toggles this while driving.', get: () => this.hooks.get('muted'), set: (v) => this.hooks.onMute(v) });
  }
  buildControls(p) {
    p.appendChild(h('div', 'gs-title', '<h3>Controls</h3><p>Keyboard only for now. Mouse drag orbits the camera when stopped.</p>'));
    const grid = h('div', 'gs-keys'); p.appendChild(grid);
    for (const [title, list] of [['Car', KEYS.car], ['Charter plane', KEYS.plane], ['Everywhere', KEYS.all]]) { const col = h('div', 'gs-keycol', `<b>${title}</b>`); for (const [k, what] of list) col.appendChild(h('div', 'gs-key', `<kbd>${k}</kbd><span>${what}</span>`)); grid.appendChild(col); }
  }
  // ------------------------------------------------------------ state
  rows() { return [...this.panes[this.tab].querySelectorAll('.gs-row[tabindex]')]; }
  showTab(id) { this.tab = id; for (const b of this.tabsEl.children) b.classList.toggle('on', b.dataset.tab === id); for (const [k, p] of Object.entries(this.panes)) p.classList.toggle('on', k === id); this.focus = 0; this.refresh(); }
  refresh() {
    for (const p of Object.values(this.panes)) for (const r of p.querySelectorAll('.gs-row')) if (r._refresh) r._refresh();
    const st = this.hooks.state();
    for (const [id, c] of Object.entries(this.cards)) c.classList.toggle('on', st.vehicle === id);
    if (!this.shown) this.showVehicle(st.vehicle);
    const rows = this.rows(); rows.forEach((r, i) => r.classList.toggle('focus', i === this.focus));
  }
  showVehicle(id) {
    const v = VEHICLES.find((x) => x.id === id); if (!v) return; this.shown = id;
    this.showInfo.innerHTML = `<div class="kicker">${v.kicker}</div><h3>${v.name}</h3><p>${v.blurb}</p><div class="stats">${v.stats.map(([n, f, t]) => `<div><span>${n}</span><i><b style="width:${Math.round(f * 100)}%"></b></i><em>${t}</em></div>`).join('')}</div>`;
    if (this.preview) this.preview.show(id);
  }
  key(e) {
    if (!this.open) return; const tag = e.target && e.target.tagName; if (tag === 'INPUT' && e.key !== 'Escape') return;
    const t = TABS.find((x) => x[2] === e.key); if (t) { this.showTab(t[0]); e.preventDefault(); return; }
    const rows = this.rows(); if (!rows.length) return;
    if (e.key === 'ArrowDown') { this.focus = Math.min(rows.length - 1, this.focus + 1); this.refresh(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { this.focus = Math.max(0, this.focus - 1); this.refresh(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const r = rows[this.focus]; if (r && r._step) r._step(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); }
    else if (e.key === 'Enter') { const r = rows[this.focus]; const b = r && r.querySelector('.gs-switch, .gs-btn'); if (b) b.click(); }
  }
  show() { this.open = true; this.root.classList.remove('hidden'); this.shown = null; this.refresh(); window.addEventListener('keydown', this.onKey, true); if (!this.preview) this.preview = new VehiclePreview(this.previewCanvas, this.ctx); this.preview.show(this.shown); this.preview.active = true; }
  hide() { this.open = false; this.root.classList.add('hidden'); window.removeEventListener('keydown', this.onKey, true); if (this.preview) this.preview.active = false; }
  // Called from the render loop; draws the showcase at most 30 times a second while the screen is open.
  tick(dt, now) { if (!this.open || !this.preview || this.tab !== 'vehicle') return; if (now - this.lastPreview < 1 / 30) return; this.lastPreview = now; this.preview.render(now); }
}

// Small separate renderer for the showcase: a studio disc, three lights and the vehicle turning slowly.
class VehiclePreview {
  constructor(canvas, ctx) {
    this.canvas = canvas; this.ctx = ctx; this.active = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); this.renderer.setSize(640, 336, false); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(30, 640 / 336, 0.1, 100);
    const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(4, 7, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ec9ff, 1.4); rim.position.set(-6, 4, -6); this.scene.add(rim);
    this.scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x2a2416, 0.9));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0x151a26, roughness: 0.9, metalness: 0.1 })); disc.rotation.x = -Math.PI / 2; disc.position.y = -0.01; this.scene.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.6, 9, 64), new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);
    this.rigs = {}; this.current = null; this.angle = 0;
  }
  build(id) {
    const g = new THREE.Group(); const c = this.ctx;
    if (id === 'car' && c.carVisual) { const copy = c.carVisual.makeParkedCopy(); g.add(copy); g.userData.dist = 10.5; g.userData.h = 0.8; }
    else if (id === 'plane') { const v = PlaneVisual.parked(this.scene, c, 0, 0, 0, undefined, 'VT-GVP'); this.scene.remove(v.root); v.dust.points.visible = false; v.smoke.points.visible = false; v.setNight(false); g.add(v.root); g.userData.dist = 16; g.userData.h = 1.5; }
    else if (id === 'boat') { const b = new BoatVisual(this.scene, c); this.scene.remove(b.root); this.scene.remove(b.wake); b.root.visible = true; b.hull.rotation.set(0, 0, 0); g.add(b.root); g.userData.dist = 12; g.userData.h = 1.2; }
    g.visible = false; this.scene.add(g); return g;
  }
  show(id) { if (!id) return; if (!this.rigs[id]) this.rigs[id] = this.build(id); for (const [k, r] of Object.entries(this.rigs)) r.visible = k === id; this.current = this.rigs[id]; }
  render(now) {
    if (!this.active || !this.current) return; this.angle = now * 0.35;
    const d = this.current.userData.dist, hh = this.current.userData.h;
    this.camera.position.set(Math.sin(this.angle) * d, hh + d * 0.32, Math.cos(this.angle) * d); this.camera.lookAt(0, hh, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
