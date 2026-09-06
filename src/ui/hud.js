// All DOM UI: HUD, toasts, plot card, pause/missions/settings/teleport screens, debug overlay.
import { CONFIG, KMH } from '../config.js';
import { fmtTime } from '../game/missions.js';
import { describe, mailtoFor, availabilityOf } from '../game/plots.js';
import { drawFlightDial } from '../plane/hud.js';

const $ = (id) => document.getElementById(id);
export class UI {
  constructor(settings, audio) {
    this.settings = settings; this.audio = audio;
    this.el = {
      loading: $('loading'), loadBar: $('load-bar'), loadText: $('load-text'), title: $('title'), hud: $('hud'), gauge: $('gauge'), gear: $('gear'), hb: $('hb'),
      compass: $('compass-heading'), zone: $('zone'), nearest: $('nearest'), tod: $('tod-btn'), mute: $('mute-btn'), timer: $('mission-timer'), toast: $('toast'), card: $('plot-card'),
      controls: $('controls-card'), pause: $('pause'), missions: $('missions'), settingsEl: $('settings'), teleport: $('teleport'), tpInput: $('tp-input'), tpList: $('tp-list'), map: $('bigmap'), debug: $('debug'), wrong: $('wrongway'), arrow: $('mission-arrow'), complete: $('complete'), resume: $('resume-count'), error: $('fatal'),
    };
    this.toastTimer = 0; this.cardPlot = null; this.cardTimer = 0;
    this.needle = 0; this.gaugeDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.el.gauge.width = 220 * this.gaugeDpr; this.el.gauge.height = 220 * this.gaugeDpr;
  }
  // Analogue speedometer: 270-degree sweep, 0 to 200 km/h, red zone from 140, gold needle, boost arc inside.
  drawGauge(kmh, boost, boosting, dt) {
    const c = this.el.gauge, g = c.getContext('2d'), d = this.gaugeDpr, S = 220, cx = S / 2, cy = S / 2 + 6, R = 92;
    const MAX = 200, a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
    const ang = (v) => a0 + sweep * Math.min(Math.max(v / MAX, 0), 1);
    this.needle += (kmh - this.needle) * Math.min(1, dt * 10);
    g.save(); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(cx, cy, R + 12, 0, Math.PI * 2); g.fillStyle = 'rgba(8,12,22,0.78)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(201,162,39,0.45)'; g.stroke();
    g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, R, a0, a0 + sweep); g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 6; g.stroke();
    g.beginPath(); g.arc(cx, cy, R, ang(140), a0 + sweep); g.strokeStyle = 'rgba(220,60,50,0.75)'; g.lineWidth = 6; g.stroke();
    for (let v = 0; v <= MAX; v += 10) {
      const a = ang(v), major = v % 20 === 0; const r1 = R - 9, r2 = major ? R - 22 : R - 15;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.strokeStyle = v >= 140 ? 'rgba(255,120,110,0.9)' : 'rgba(245,245,245,0.85)'; g.lineWidth = major ? 2.2 : 1; g.stroke();
      if (v % 40 === 0) { g.fillStyle = 'rgba(245,245,245,0.9)'; g.font = '600 12px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), cx + Math.cos(a) * (R - 34), cy + Math.sin(a) * (R - 34)); }
    }
    // Boost arc (inner).
    g.beginPath(); g.arc(cx, cy, R - 46, a0, a0 + sweep); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 4; g.stroke();
    g.beginPath(); g.arc(cx, cy, R - 46, a0, a0 + sweep * boost); g.strokeStyle = boosting ? '#ffffff' : '#c9a227'; g.lineWidth = 4; g.stroke();
    // Digital readout.
    g.fillStyle = '#f5f5f5'; g.font = '600 30px "Playfair Display", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(Math.round(kmh)), cx, cy + 34);
    g.fillStyle = 'rgba(245,245,245,0.6)'; g.font = '500 9px Inter, sans-serif'; g.fillText('K M / H', cx, cy + 54);
    g.fillStyle = 'rgba(201,162,39,0.85)'; g.font = '500 9px Inter, sans-serif'; g.fillText('BOOST', cx, cy - 22);
    // Needle.
    const na = ang(this.needle);
    g.shadowColor = 'rgba(201,162,39,0.6)'; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(cx + Math.cos(na + Math.PI) * 14, cy + Math.sin(na + Math.PI) * 14); g.lineTo(cx + Math.cos(na) * (R - 12), cy + Math.sin(na) * (R - 12));
    g.strokeStyle = '#e0b62f'; g.lineWidth = 3; g.stroke(); g.shadowBlur = 0;
    g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fillStyle = '#0a0f1c'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#c9a227'; g.stroke();
    g.restore();
  }
  setLoading(p, text) { this.el.loadBar.style.width = `${Math.round(p * 100)}%`; if (text) this.el.loadText.textContent = text; }
  hideLoading() { this.el.loading.classList.add('hidden'); }
  fatal(msg) { this.el.error.hidden = false; this.el.error.querySelector('p').textContent = msg; }
  showTitle(best) { this.el.title.classList.remove('hidden'); $('best-lap').textContent = best ? `Best boundary lap: ${fmtTime(best)}` : ''; }
  hideTitle() { this.el.title.classList.add('hidden'); }
  showHud() { this.el.hud.classList.remove('hidden'); }
  toast(text, seconds = 4) { this.el.toast.textContent = text; this.el.toast.classList.add('show'); this.toastTimer = seconds; }
  showBoatPrompt(text, btn) { const el = $('boat-prompt'); if (!text) { el.classList.remove('show'); return; } $('boat-text').textContent = text; $('boat-btn').textContent = btn || 'Yes · B'; el.classList.add('show'); }
  showSwapPrompt(text) { const el = $('swap-prompt'); if (!text) { el.classList.remove('show'); return; } $('swap-text').textContent = text; el.classList.add('show'); }
  setWrongWay(on) { this.el.wrong.classList.toggle('show', on); }
  showFlyPrompt(text, btn) { const el = $('fly-prompt'); if (!text) { el.classList.remove('show'); return; } $('fly-prompt-text').textContent = text; $('fly-prompt-btn').textContent = btn || 'Yes · F'; el.classList.add('show'); }
  setControlsMode(mode) { this.mode = mode; this.hideControls(); }
  showControls(seconds) { const el = this.mode === 'plane' ? $('controls-card-plane') : this.el.controls; el.classList.add('show'); clearTimeout(this._ct); if (seconds) this._ct = setTimeout(() => el.classList.remove('show'), seconds * 1000); }
  hideControls() { this.el.controls.classList.remove('show'); $('controls-card-plane').classList.remove('show'); }
  banner(text, cls = 'warn') { const b = $('flight-banner'); if (!text) { b.classList.remove('show'); return; } b.textContent = text; b.className = `${cls} show`; }
  update(dt, car, world, missions, lighting, camMode) {
    const e = this.el;
    const kmh = Math.abs(car.speed) * KMH;
    if (car.isPlane) {
      drawFlightDial(this.el.gauge, this.gaugeDpr, car, this, dt);
      e.gear.textContent = car.onGround ? (car.brakes ? 'BRK' : 'GND') : 'AIR'; e.hb.classList.toggle('on', car.brakes && car.onGround); e.hb.textContent = car.flaps ? `FLAPS ${car.flaps}°` : 'FLAPS UP';
      $('alt-readout').textContent = `ALT ${Math.round(car.y)} m · VS ${car.vs >= 0 ? '+' : ''}${car.vs.toFixed(1)} m/s · ${Math.round(kmh)} km/h`;
      if (car.stalled) this.banner('STALL · NOSE DOWN, POWER UP', 'warn');
      else if (car.autopilot) this.banner('AUTOPILOT · RETURNING TO GVP SMART VILLAGE', 'info');
      else if (car.boundaryT > 0) this.banner(`RETURN TO GVP SMART VILLAGE · ${Math.ceil(car.boundaryT)}`, 'warn');
      else if (car.ceilingWarn) this.banner('CEILING · ENGINE LOSING POWER', 'info');
      else this.banner(null);
    } else {
      this.drawGauge(kmh, car.boostCharge, car.boosting, dt);
      e.gear.textContent = car.speed < -0.3 ? 'R' : 'D'; e.hb.classList.toggle('on', car.handbrakeOn); e.hb.textContent = 'HANDBRAKE'; $('alt-readout').textContent = ''; this.banner(null);
    }
    const deg = ((car.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    e.compass.textContent = `${dirs[Math.round(deg / 45) % 8]} ${Math.round(deg)}°`;
    e.zone.textContent = world.zoneOf(car.x, car.z);
    e.tod.textContent = { day: '☀ Day', sunset: '🌅 Sunset', night: '🌙 Night' }[lighting.name];
    e.mute.textContent = this.audio.muted ? '🔇' : '🔊';
    $('cam-mode').textContent = camMode;
    if (missions.active) { e.timer.textContent = `${missions.active.name} · ${fmtTime(missions.time)} · ${missions.done.size}/${missions.active.rings.length}`; e.timer.classList.add('show'); } else e.timer.classList.remove('show');
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) e.toast.classList.remove('show'); }
    // Mission arrow
    const tgt = missions.target() || this.waypoint;
    if (tgt) { const ang = Math.atan2(tgt.x - car.x, -(tgt.z - car.z)) - car.yaw; e.arrow.style.transform = `rotate(${ang}rad)`; e.arrow.classList.add('show'); $('mission-dist').textContent = `${Math.round(Math.hypot(tgt.x - car.x, tgt.z - car.z))} m`; }
    else e.arrow.classList.remove('show');
  }
  updateNearest(car, world) {
    const near = world.plotsNear(car.x, car.z, CONFIG.ui.nearestRadius).filter((n) => n.plot.type !== 'park' || n.dist === 0);
    let best = null;
    if (near.length) {
      // Prefer the plot the car faces; tie-break by distance. Hysteresis keeps the current pick if still close.
      const f = car.forward();
      let bs = -Infinity;
      for (const n of near) { const dx = n.plot.cx - car.x, dz = n.plot.cy - car.z; const facing = (dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1); const score = facing * 8 - n.dist + (this.lastNearest === n.plot ? 6 : 0); if (score > bs) { bs = score; best = n; } }
    }
    this.lastNearest = best ? best.plot : null;
    const p = this.lastNearest;
    this.el.nearest.textContent = p ? (p.type === 'villa' ? `Premium villa ${p.n} · 30 × 30 m · linked farm ${p.n}` : p.type === 'townhouse' ? `Town house ${p.n} · 20 × 15 m` : p.type === 'farm' ? `Farm plot ${p.n} · 1 ha · house faces ${p.facing === 'N' ? 'north' : 'south'}` : p.type === 'commercial' ? `Commercial plot ${p.n} · 40 × 25 m` : p.name || p.kind) : 'Open road';
    return best;
  }
  showCard(p, world) {
    if (this.cardPlot === p) return;
    this.cardPlot = p;
    const d = describe(p, world);
    const av = availabilityOf(p.id);
    const sellable = ['villa', 'townhouse', 'farm', 'commercial'].includes(p.type);
    this.el.card.innerHTML = `<div class="card-type ${p.type}">${p.kind}</div><h2>${d.title}</h2>
      <ul>${d.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
      ${d.price ? `<div class="price">${d.price}</div><div class="note">${d.note}</div>` : ''}
      ${sellable ? `<div class="avail ${av}">${av[0].toUpperCase() + av.slice(1)}</div><a class="btn gold" href="${mailtoFor(d, p)}">Express interest</a>` : ''}
      <div class="hint">Throttle or Esc closes</div>`;
    this.el.card.classList.add('show');
  }
  hideCard() { this.cardPlot = null; this.el.card.classList.remove('show'); }
  missionComplete(m, time, best) {
    $('complete-title').textContent = `${m.name} complete`;
    $('complete-body').innerHTML = `Time ${fmtTime(time)}${best ? `<br>Best ${fmtTime(best)}` : ''}`;
    this.el.complete.classList.add('show');
  }
  hideComplete() { this.el.complete.classList.remove('show'); }
  showResume(n) { this.el.resume.textContent = n; this.el.resume.classList.toggle('show', n > 0); }
  debug(lines) { this.el.debug.textContent = lines.join('\n'); }
}
