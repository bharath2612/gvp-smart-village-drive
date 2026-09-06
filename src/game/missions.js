// Three missions with checkpoint rings. Rings are translucent gold cylinders with a light beam.
import * as THREE from 'three';

export function defineMissions(world) {
  const L = world.L;
  const gate = { x: 1500, z: 2975 };
  const spineW = 1490, spineE = 1509;
  const lake = L.lake.bbox;
  return [
    { id: 'tour', name: 'Gate to lake tour', desc: 'Up the spine, past the school and stadium, the temple, then the lake ring.', ordered: true,
      rings: [
        { x: spineW, z: 2700, text: 'The 30 m central spine runs 3 km north to south with a planted median.' },
        { x: spineW, z: 2250, text: 'Town houses (504) sit either side of the spine here, 20 x 15 m each.' },
        { x: 1700, z: 2027, text: 'School (5.2 ha) and the 4.2 ha stadium are to the east.' },
        { x: 2062, z: 2200, text: 'Turn towards the lake district: temple, parking, fire station and water treatment.' },
        { x: 2174, z: 2135, text: 'The temple sits on a 200 x 200 m lot at the corner of the lake district.' },
        { x: lake.x - 15, z: lake.y + lake.h / 2, text: 'The lake: 46 ha of water, 84.6 ha with the green belt. Mission complete.' },
      ] },
    { id: 'parks', name: 'All four parks', desc: 'Visit the four 5 ha parks in any order. Timer runs.', ordered: false,
      rings: L.parks.map((p) => ({ x: p.x + p.w / 2, z: p.y + p.h / 2, text: `${p.id}: ${p.w.toFixed(0)} x ${p.h.toFixed(0)} m` })) },
    { id: 'sky', name: 'Sky tour', desc: 'Charter plane only: fly the rings from the airstrip over the spine, stadium, temple and lake, then back over runway 27.', ordered: true, plane: true,
      rings: [
        { x: 1100, z: 3180, y: 60, text: 'Climb out over runway 09 and turn north over the wall.' },
        { x: 1500, z: 2600, y: 140, text: 'The 30 m spine below runs the full 3 km north to south.' },
        { x: 1700, z: 2100, y: 160, text: 'School and cricket stadium: 5.2 ha and 4.2 ha.' },
        { x: 2174, z: 2135, y: 170, text: 'Temple on its 200 x 200 m lot; the lake district beyond.' },
        { x: lake.x + lake.w / 2, z: lake.y + lake.h / 2, y: 180, text: '46 ha of water. Circle the lake and head back south.' },
        { x: 2400, z: 1200, y: 220, text: 'Four 5 ha parks are spread across the plan; the farms fill the west.' },
        { x: 900, z: 1500, y: 240, text: 'Farm plots: 564 of them, one hectare each.' },
        { x: 1300, z: 2700, y: 150, text: 'Line up for runway 27: fly east of the strip and turn in.' },
        { x: 1450, z: 3180, y: 60, text: 'Over the threshold of 27. Land whenever you like. Mission complete.' },
      ] },
    { id: 'lap', name: 'Boundary lap', desc: 'Clockwise lap of the 25 m boundary road from the gate. Best time is saved.', ordered: true, timed: true, lap: true,
      rings: [
        { x: 1500 - 1, z: 2987, text: 'Start line' },
        { x: 800, z: 2987 }, { x: 12.5, z: 2987 }, { x: 12.5, z: 1500 }, { x: 12.5, z: 12.5 }, { x: 1500, z: 12.5 }, { x: 2987, z: 12.5 }, { x: 2987, z: 1500 }, { x: 2987, z: 2987 }, { x: 2250, z: 2987 },
        { x: 1500 + 1, z: 2987, text: 'Finish' },
      ] },
  ];
}

export class Missions {
  constructor(scene, world, settings, audio, ui) {
    this.scene = scene; this.world = world; this.settings = settings; this.audio = audio; this.ui = ui;
    this.defs = defineMissions(world);
    this.active = null; this.time = 0; this.done = new Set(); this.next = 0; this.meshes = [];
    this.ringGeo = new THREE.CylinderGeometry(6, 6, 10, 32, 1, true);
    this.beamGeo = new THREE.CylinderGeometry(1.2, 2.5, 200, 12, 1, true);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    this.wrongWay = 0; this.lastProgress = null;
  }
  start(id) {
    this.abandon();
    const m = this.defs.find((d) => d.id === id); if (!m) return;
    this.active = m; this.time = 0; this.done = new Set(); this.next = 0;
    m.rings.forEach((r, i) => {
      const g = new THREE.Group(); g.position.set(r.x, 0, r.z);
      const ring = new THREE.Mesh(this.ringGeo, this.ringMat.clone()); ring.position.y = r.y ? r.y : 5; if (r.y) { ring.scale.set(2.5, 2.5, 2.5); ring.rotation.x = Math.PI / 2; } g.add(ring);
      const beam = new THREE.Mesh(this.beamGeo, this.beamMat); beam.position.y = r.y ? r.y / 2 : 100; if (r.y) beam.scale.y = r.y / 200; g.add(beam);
      this.scene.add(g); this.meshes.push(g); r.mesh = g; r.ringMat = ring.material;
    });
    this.updateVisibility();
    this.ui.toast(`${m.name}: ${m.desc}`);
  }
  abandon() { for (const g of this.meshes) this.scene.remove(g); this.meshes = []; this.active = null; }
  updateVisibility() {
    const m = this.active; if (!m) return;
    m.rings.forEach((r, i) => { const pending = !this.done.has(i); const isNext = m.ordered ? i === this.next : pending; r.mesh.visible = pending; r.ringMat.opacity = isNext ? 0.6 : 0.25; });
  }
  target() { const m = this.active; if (!m) return null; if (m.ordered) return m.rings[this.next] || null; let best = null, bd = Infinity; m.rings.forEach((r, i) => { if (this.done.has(i)) return; const d = Math.hypot(r.x - this._cx, r.z - this._cz); if (d < bd) { bd = d; best = r; } }); return best; }
  update(dt, car) {
    const m = this.active; if (!m) return;
    this.time += dt; this._cx = car.x; this._cz = car.z;
    const t = performance.now() / 1000;
    for (const g of this.meshes) if (g.visible) g.children[0].rotation.z = t * 0.8;
    m.rings.forEach((r, i) => {
      if (this.done.has(i)) return;
      if (m.ordered && i !== this.next) return;
      const hit = r.y ? Math.hypot(car.x - r.x, (car.y || 0) - r.y, car.z - r.z) < 18 : Math.hypot(car.x - r.x, car.z - r.z) < 7;
      if (hit) {
        this.done.add(i); if (m.ordered) this.next = i + 1;
        this.audio.chime(); if (r.text) this.ui.toast(r.text, 5);
        this.updateVisibility();
      }
    });
    // Wrong-way check for the lap: progress along the clockwise loop must increase.
    if (m.lap) {
      const prog = this.lapProgress(car.x, car.z);
      if (this.lastProgress !== null) { const d = prog - this.lastProgress; if (d < -0.0005 && Math.abs(d) < 0.5) this.wrongWay += Math.abs(car.speed) * dt; else if (d > 0) this.wrongWay = Math.max(0, this.wrongWay - 20 * dt); }
      this.lastProgress = prog;
      this.ui.setWrongWay(this.wrongWay > 100);
    }
    if (this.done.size === m.rings.length) this.complete();
  }
  lapProgress(x, z) {
    // Clockwise on screen from the gate (bottom, heading left/west): bottom edge -> left -> top -> right -> bottom.
    const S = 3000; let d;
    if (z > S - 60 && x <= 1500) d = 1500 - x; else if (x < 60 && z > 60) d = 1500 + (S - z); else if (z < 60 && x < S - 60) d = 1500 + S + x; else if (x > S - 60) d = 1500 + 2 * S + z; else d = 1500 + 3 * S + (S - x);
    return d / (4 * S);
  }
  complete() {
    const m = this.active; const time = this.time;
    let best = null;
    if (m.timed) { best = this.settings.get('bestLap'); if (!best || time < best) { best = time; this.settings.set('bestLap', time); } }
    this.audio.fanfare();
    this.ui.missionComplete(m, time, best);
    this.abandon();
  }
}
export const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
