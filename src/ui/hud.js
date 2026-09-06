// All DOM UI: HUD, toasts, plot card, pause/missions/settings/teleport screens, debug overlay.
import { CONFIG, KMH } from '../config.js';
import { fmtTime } from '../game/missions.js';
import { describe, mailtoFor, availabilityOf } from '../game/plots.js';

const $ = (id) => document.getElementById(id);
export class UI {
  constructor(settings, audio) {
    this.settings = settings; this.audio = audio;
    this.el = {
      loading: $('loading'), loadBar: $('load-bar'), loadText: $('load-text'), title: $('title'), hud: $('hud'), speed: $('speed'), boost: $('boost-bar'), gear: $('gear'), hb: $('hb'),
      compass: $('compass-heading'), zone: $('zone'), nearest: $('nearest'), tod: $('tod-btn'), mute: $('mute-btn'), timer: $('mission-timer'), toast: $('toast'), card: $('plot-card'),
      controls: $('controls-card'), pause: $('pause'), missions: $('missions'), settingsEl: $('settings'), teleport: $('teleport'), tpInput: $('tp-input'), tpList: $('tp-list'), map: $('bigmap'), debug: $('debug'), wrong: $('wrongway'), arrow: $('mission-arrow'), complete: $('complete'), resume: $('resume-count'), error: $('fatal'),
    };
    this.toastTimer = 0; this.cardPlot = null; this.cardTimer = 0;
  }
  setLoading(p, text) { this.el.loadBar.style.width = `${Math.round(p * 100)}%`; if (text) this.el.loadText.textContent = text; }
  hideLoading() { this.el.loading.classList.add('hidden'); }
  fatal(msg) { this.el.error.hidden = false; this.el.error.querySelector('p').textContent = msg; }
  showTitle(best) { this.el.title.classList.remove('hidden'); $('best-lap').textContent = best ? `Best boundary lap: ${fmtTime(best)}` : ''; }
  hideTitle() { this.el.title.classList.add('hidden'); }
  showHud() { this.el.hud.classList.remove('hidden'); }
  toast(text, seconds = 4) { this.el.toast.textContent = text; this.el.toast.classList.add('show'); this.toastTimer = seconds; }
  setWrongWay(on) { this.el.wrong.classList.toggle('show', on); }
  showControls(seconds) { this.el.controls.classList.add('show'); clearTimeout(this._ct); if (seconds) this._ct = setTimeout(() => this.el.controls.classList.remove('show'), seconds * 1000); }
  hideControls() { this.el.controls.classList.remove('show'); }
  update(dt, car, world, missions, lighting, camMode) {
    const e = this.el;
    const kmh = Math.abs(car.speed) * KMH;
    e.speed.textContent = Math.round(kmh);
    e.boost.style.width = `${Math.round(car.boostCharge * 100)}%`; e.boost.classList.toggle('active', car.boosting);
    e.gear.textContent = car.speed < -0.3 ? 'R' : 'D'; e.hb.classList.toggle('on', car.handbrakeOn);
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
    const tgt = missions.target();
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
