// North-up minimap drawn from layout.json on a canvas; full-screen map with plot labels.
export class Minimap {
  constructor(world, canvas, bigCanvas) {
    this.world = world; this.canvas = canvas; this.bigCanvas = bigCanvas;
    this.base = document.createElement('canvas'); this.base.width = this.base.height = 1536;
    this.drawBase(this.base.getContext('2d'), 1536, false);
    this.baseBig = document.createElement('canvas'); this.baseBig.width = this.baseBig.height = 3000;
    this.drawBase(this.baseBig.getContext('2d'), 3000, true);
    this.mode = 'north'; this.rings = []; this.availability = null;
    this.levels = [180, 260, 420, 650, 1000]; this.level = 2; this.mark = null; this.big = null;
  }
  zoomIn() { this.level = Math.max(0, this.level - 1); }
  zoomOut() { this.level = Math.min(this.levels.length - 1, this.level + 1); }
  // Convert a click on the big map canvas (client coords) to world metres, or null when outside the plan.
  bigToWorld(clientX, clientY) {
    if (!this.big) return null; const c = this.big.canvas; const r = c.getBoundingClientRect();
    const px = (clientX - r.left) * (c.width / r.width), py = (clientY - r.top) * (c.height / r.height);
    const x = (px - this.big.ox) / this.big.k, z = (py - this.big.oy) / this.big.k;
    if (x < 0 || z < 0 || x > 3000 || z > 3000) return null; return { x, z };
  }
  drawBase(g, size, labels) {
    const k = size / 3000; const L = this.world.L;
    g.fillStyle = '#1b2a1c'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#23331f'; g.fillRect(0, 0, size, size);
    const rect = (r, c) => { g.fillStyle = c; g.fillRect(r.x * k, r.y * k, r.w * k, r.h * k); };
    for (const f of L.farms) rect(f, '#2d5a3d');
    for (const p of L.parks) rect(p, '#3f8a4a');
    for (const v of L.villas) rect(v, '#8a7332');
    for (const t of L.townhouses) rect(t, '#2f7f78');
    for (const c of L.commercial) rect(c, '#6d4fb8');
    for (const a of L.amenities) { if (a.id === 'lake-district' || a.id === 'track') continue; rect(a, a.id === 'temple' ? '#b8862b' : a.id === 'stadium' ? '#7a5f8e' : a.id === 'school' ? '#b0a85e' : '#5c6470'); }
    g.fillStyle = '#2b6c8a'; g.beginPath(); L.lake.points.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.closePath(); g.fill();
    for (const r of L.roads) rect(r, r.kind === 'spine' ? '#c9c4b8' : r.kind === '25m' ? '#d8d3c8' : '#a9a49a');
    g.strokeStyle = '#c9a227'; g.lineWidth = Math.max(2, 3 * k); g.strokeRect(1, 1, size - 2, size - 2);
    if (labels) {
      g.fillStyle = '#f5f5f5'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `${Math.max(8, 9 * k)}px Inter, sans-serif`;
      for (const f of L.farms) g.fillText(f.n, (f.x + f.w / 2) * k, (f.y + f.h / 2) * k);
      g.font = `${Math.max(6, 7 * k)}px Inter, sans-serif`;
      for (const v of L.villas) g.fillText(v.n, (v.x + v.w / 2) * k, (v.y + v.h / 2) * k);
      g.font = `${Math.max(5, 5.5 * k)}px Inter, sans-serif`;
      for (const t of L.townhouses) g.fillText(t.n, (t.x + t.w / 2) * k, (t.y + t.h / 2) * k);
      g.font = `${Math.max(6, 7 * k)}px Inter, sans-serif`; for (const c of L.commercial) g.fillText(c.n, (c.x + c.w / 2) * k, (c.y + c.h / 2) * k);
      g.font = `bold ${14 * k}px Inter, sans-serif`; g.fillStyle = '#ffd35a';
      for (const a of L.amenities) { if (a.id === 'lake-district' || a.id === 'track') continue; g.fillText(a.name.split(' (')[0], (a.x + a.w / 2) * k, (a.y + a.h / 2) * k); }
      for (const p of L.parks) g.fillText('Park', (p.x + p.w / 2) * k, (p.y + p.h / 2) * k);
      g.fillText('Lake', (L.lake.bbox.x + L.lake.bbox.w / 2) * k, (L.lake.bbox.y + L.lake.bbox.h / 2) * k);
      g.fillText('East entry gate', 1500 * k, 2960 * k);
    }
  }
  draw(car, rings, target) {
    const c = this.canvas; const g = c.getContext('2d'); const W = c.width, H = c.height;
    const view = Math.max(this.levels[this.level], car.y ? Math.min(3200, car.y * 2.5) : 0); // metres across the minimap; wider with altitude
    const k = W / view; const kb = this.base.width / 3000;
    g.save(); g.clearRect(0, 0, W, H);
    g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#0a0f1c'; g.fillRect(0, 0, W, H);
    g.translate(W / 2, H / 2);
    if (this.mode === 'rotate') g.rotate(car.yaw);
    g.translate(-car.x * k, -car.z * k);
    g.drawImage(this.base, 0, 0, this.base.width, this.base.height, 0, 0, 3000 * k, 3000 * k);
    for (const r of rings || []) { g.fillStyle = r === target ? '#ffd35a' : 'rgba(201,162,39,0.6)'; g.beginPath(); g.arc(r.x * k, r.z * k, r === target ? 6 + 2 * Math.sin(performance.now() / 150) : 4, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // Car arrow
    g.save(); g.translate(W / 2, H / 2); g.rotate(this.mode === 'rotate' ? 0 : car.yaw);
    g.fillStyle = '#c9a227'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 4); g.lineTo(-6, 7); g.closePath(); g.fill(); g.restore();
    g.strokeStyle = 'rgba(201,162,39,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f5f5f5'; g.font = 'bold 11px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('N', W / 2, 14);
  }
  drawBig(car, rings, target) {
    const c = this.bigCanvas; const g = c.getContext('2d'); const size = Math.min(c.width, c.height); const k = size / 3000;
    g.clearRect(0, 0, c.width, c.height);
    const ox = (c.width - size) / 2, oy = (c.height - size) / 2; this.big = { canvas: c, ox, oy, k };
    g.drawImage(this.baseBig, ox, oy, size, size);
    for (const r of rings || []) { g.fillStyle = r === target ? '#ffd35a' : 'rgba(201,162,39,0.7)'; g.beginPath(); g.arc(ox + r.x * k, oy + r.z * k, 7, 0, Math.PI * 2); g.fill(); }
    g.save(); g.translate(ox + car.x * k, oy + car.z * k); g.rotate(car.yaw); g.fillStyle = '#ffd35a'; g.strokeStyle = '#0a0f1c'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 5); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
    if (this.mark) { const mx = ox + this.mark.x * k, my = oy + this.mark.z * k; g.save(); g.strokeStyle = '#ffd35a'; g.fillStyle = 'rgba(255,211,90,0.25)'; g.lineWidth = 2;
      g.beginPath(); g.arc(mx, my, 14, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.moveTo(mx - 22, my); g.lineTo(mx + 22, my); g.moveTo(mx, my - 22); g.lineTo(mx, my + 22); g.stroke(); g.restore(); }
  }
}
