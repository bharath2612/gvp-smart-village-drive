// Flight instruments drawn on canvases: the HUD flight dial (airspeed arc, artificial horizon, altitude, VS, throttle)
// and the cockpit panel texture (airspeed, attitude, altimeter, heading).
import { KMH } from '../config.js';
import { clamp } from '../util/math.js';

const R2D = 180 / Math.PI;
function horizon(g, cx, cy, r, pitch, roll, pxPerDeg, ladder = true) {
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  g.translate(cx, cy); g.rotate(-roll); const off = pitch * R2D * pxPerDeg;
  g.fillStyle = '#3b7fd6'; g.fillRect(-r * 3, -r * 3 + off, r * 6, r * 3); g.fillStyle = '#7a5a34'; g.fillRect(-r * 3, off, r * 6, r * 3);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-r * 2, off); g.lineTo(r * 2, off); g.stroke();
  if (ladder) { g.font = `500 ${Math.max(7, r * 0.18)}px Inter, sans-serif`; g.fillStyle = 'rgba(255,255,255,0.85)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const d of [-30, -20, -10, 10, 20, 30]) { const yy = off - d * pxPerDeg; const w = (Math.abs(d) % 20 === 0 ? 0.42 : 0.26) * r; g.beginPath(); g.moveTo(-w, yy); g.lineTo(w, yy); g.stroke(); g.fillText(String(Math.abs(d)), w + r * 0.16, yy); } }
  g.restore();
  // Fixed aircraft symbol and bank pointer.
  g.strokeStyle = '#c9a227'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - r * 0.7, cy); g.lineTo(cx - r * 0.22, cy); g.lineTo(cx - r * 0.1, cy + r * 0.12); g.lineTo(cx, cy); g.lineTo(cx + r * 0.1, cy + r * 0.12); g.lineTo(cx + r * 0.22, cy); g.lineTo(cx + r * 0.7, cy); g.stroke();
  g.save(); g.translate(cx, cy); g.rotate(-roll); g.fillStyle = '#c9a227'; g.beginPath(); g.moveTo(0, -r + 2); g.lineTo(-5, -r + 11); g.lineTo(5, -r + 11); g.closePath(); g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
  for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) { const a = -Math.PI / 2 + b * Math.PI / 180; const l = b % 30 === 0 ? 7 : 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * (r + l), cy + Math.sin(a) * (r + l)); g.stroke(); }
}

// HUD dial: 220 x 220 CSS pixels at the given device pixel ratio.
export function drawFlightDial(c, d, p, needleState, dt) {
  const g = c.getContext('2d'), S = 220, cx = S / 2, cy = S / 2 + 6, R = 92;
  const kmh = p.speed * KMH; const MAX = 300, a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  const ang = (v) => a0 + sweep * clamp(v / MAX, 0, 1);
  needleState.needle += (kmh - needleState.needle) * Math.min(1, dt * 10);
  g.save(); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, S, S);
  g.beginPath(); g.arc(cx, cy, R + 12, 0, Math.PI * 2); g.fillStyle = 'rgba(8,12,22,0.78)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(201,162,39,0.45)'; g.stroke();
  g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy, R, a0, a0 + sweep); g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 6; g.stroke();
  g.beginPath(); g.arc(cx, cy, R, ang(90), ang(160)); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 6; g.stroke();   // flap range
  g.beginPath(); g.arc(cx, cy, R, ang(100), ang(240)); g.strokeStyle = 'rgba(95,174,122,0.8)'; g.lineWidth = 3; g.stroke();     // normal range
  g.beginPath(); g.arc(cx, cy, R, ang(260), a0 + sweep); g.strokeStyle = 'rgba(220,60,50,0.8)'; g.lineWidth = 6; g.stroke();     // never exceed
  for (let v = 0; v <= MAX; v += 10) {
    const a = ang(v), major = v % 20 === 0; const r1 = R - 9, r2 = major ? R - 20 : R - 14;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    g.strokeStyle = v >= 260 ? 'rgba(255,120,110,0.9)' : 'rgba(245,245,245,0.85)'; g.lineWidth = major ? 2 : 1; g.stroke();
    if (v % 60 === 0) { g.fillStyle = 'rgba(245,245,245,0.9)'; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), cx + Math.cos(a) * (R - 31), cy + Math.sin(a) * (R - 31)); }
  }
  horizon(g, cx, cy - 4, 34, p.pitch, p.roll, 1.4);
  // Altitude, vertical speed, throttle.
  g.fillStyle = '#f5f5f5'; g.font = '600 20px "Playfair Display", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${Math.round(p.y)} m`, cx, cy + 50);
  g.fillStyle = 'rgba(245,245,245,0.6)'; g.font = '500 9px Inter, sans-serif'; g.fillText(`${Math.round(p.y * 3.281)} FT · ${Math.round(kmh)} KM/H`, cx, cy + 66);
  const vs = clamp(p.vs, -12, 12); g.fillStyle = vs > 0.3 ? '#7fd49a' : vs < -0.3 ? '#ffb070' : 'rgba(245,245,245,0.7)'; g.font = '600 10px Inter, sans-serif'; g.textAlign = 'left'; g.fillText(`${vs > 0 ? '▲' : vs < 0 ? '▼' : '•'} ${Math.abs(p.vs).toFixed(1)} m/s`, cx - 62, cy + 30);
  g.textAlign = 'right'; g.fillStyle = 'rgba(245,245,245,0.85)'; g.fillText(`THR ${Math.round(p.throttle * 100)}%`, cx + 62, cy + 30);
  g.beginPath(); g.arc(cx, cy, R - 46, a0, a0 + sweep); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.arc(cx, cy, R - 46, a0, a0 + sweep * p.throttle); g.strokeStyle = p.ceilingWarn ? '#ff8a8a' : '#c9a227'; g.lineWidth = 3; g.stroke();
  if (p.flaps) { g.textAlign = 'center'; g.fillStyle = '#c9a227'; g.font = '600 9px Inter, sans-serif'; g.fillText(`FLAPS ${p.flaps}°`, cx, cy - 52); }
  if (p.stalled) { g.fillStyle = '#ff6b6b'; g.font = '700 11px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('STALL', cx, cy - 63); }
  // Airspeed needle.
  const na = ang(needleState.needle);
  g.shadowColor = 'rgba(201,162,39,0.6)'; g.shadowBlur = 8;
  g.beginPath(); g.moveTo(cx + Math.cos(na) * (R - 24), cy + Math.sin(na) * (R - 24)); g.lineTo(cx + Math.cos(na) * (R - 8), cy + Math.sin(na) * (R - 8)); g.strokeStyle = '#e0b62f'; g.lineWidth = 3.5; g.stroke(); g.shadowBlur = 0;
  g.restore();
}

// Cockpit panel texture: four round instruments on a dark panel.
export function drawPanel(c, p) {
  const g = c.getContext('2d'); const W = c.width, H = c.height;
  g.fillStyle = '#1a1d22'; g.fillRect(0, 0, W, H);
  const dial = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = '#0b0d10'; g.fill(); g.strokeStyle = '#5a6068'; g.lineWidth = 3; g.stroke(); };
  const needle = (x, y, r, a, w = 3, col = '#f5f5f5') => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); };
  const r = 40, y = H / 2 + 8; const xs = [70, 190, 320, 440];
  // Airspeed 0-300 km/h.
  dial(xs[0], y, r); const kmh = p.speed * KMH; for (let v = 0; v <= 300; v += 30) { const a = Math.PI * 0.75 + Math.PI * 1.5 * v / 300; g.strokeStyle = v >= 260 ? '#ff6b6b' : '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(xs[0] + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6)); g.lineTo(xs[0] + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1)); g.stroke(); }
  needle(xs[0], y, r - 8, Math.PI * 0.75 + Math.PI * 1.5 * clamp(kmh / 300, 0, 1)); g.fillStyle = '#aaa'; g.font = '10px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('KM/H', xs[0], y + 20);
  // Attitude.
  dial(xs[1], y, r); horizon(g, xs[1], y, r - 3, p.pitch, p.roll, 1.2, false);
  // Altimeter: long needle per 100 m, short per 1000 m.
  dial(xs[2], y, r); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(xs[2] + Math.cos(a) * (r - 7), y + Math.sin(a) * (r - 7)); g.lineTo(xs[2] + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1)); g.stroke(); g.fillStyle = '#ddd'; g.font = '9px Inter, sans-serif'; g.fillText(String(i), xs[2] + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14) + 3); }
  needle(xs[2], y, r - 18, -Math.PI / 2 + (p.y / 1000) * Math.PI * 2, 4); needle(xs[2], y, r - 8, -Math.PI / 2 + ((p.y % 100) / 100) * Math.PI * 2, 2);
  g.fillStyle = '#aaa'; g.font = '10px Inter, sans-serif'; g.fillText(`${Math.round(p.y)} m`, xs[2], y + 24);
  // Heading: rotating rose with a fixed lubber line.
  dial(xs[3], y, r); g.save(); g.translate(xs[3], y); g.rotate(-p.yaw); g.fillStyle = '#ddd'; g.font = 'bold 10px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 30) { const a = -Math.PI / 2 + d * Math.PI / 180; const lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d]; if (lab) g.fillText(lab, Math.cos(a) * (r - 12), Math.sin(a) * (r - 12)); else { g.strokeStyle = '#bbb'; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6)); g.lineTo(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1)); g.stroke(); } }
  g.restore(); g.fillStyle = '#c9a227'; g.beginPath(); g.moveTo(xs[3], y - r + 2); g.lineTo(xs[3] - 5, y - r + 12); g.lineTo(xs[3] + 5, y - r + 12); g.closePath(); g.fill();
  // Status strip.
  g.fillStyle = '#c9a227'; g.font = 'bold 12px Inter, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(`THR ${Math.round(p.throttle * 100)}%   FLAPS ${p.flaps}°   VS ${p.vs >= 0 ? '+' : ''}${p.vs.toFixed(1)}`, 14, 22);
  if (p.stalled) { g.fillStyle = '#ff5050'; g.textAlign = 'right'; g.fillText('STALL', W - 14, 22); }
  if (p.brakes && p.onGround) { g.fillStyle = '#ff9a50'; g.textAlign = 'right'; g.fillText('BRAKES', W - 90, 22); }
}
