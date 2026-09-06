// 2D static collider grid (50 m cells). Colliders are axis-aligned rectangles in the XZ plane.
export class ColliderGrid {
  constructor(cell = 50) { this.cell = cell; this.map = new Map(); this.list = []; }
  add(x0, z0, x1, z1, tag = 'solid', ref = null) {
    const c = { x0, z0, x1, z1, tag, ref, id: this.list.length };
    this.list.push(c);
    const gx0 = Math.floor(x0 / this.cell), gx1 = Math.floor(x1 / this.cell), gz0 = Math.floor(z0 / this.cell), gz1 = Math.floor(z1 / this.cell);
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) { const k = gx * 4096 + gz; let l = this.map.get(k); if (!l) { l = []; this.map.set(k, l); } l.push(c); }
    return c;
  }
  addRect(r, tag, ref) { return this.add(r.x, r.y, r.x + r.w, r.y + r.h, tag, ref); }
  near(x, z) {
    // 3x3 neighbourhood so a car on a cell boundary sees everything.
    const gx = Math.floor(x / this.cell), gz = Math.floor(z / this.cell);
    const out = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = this.map.get((gx + i) * 4096 + (gz + j)); if (l) for (const c of l) out.push(c); }
    return out;
  }
}
