// Tiny observable settings store persisted in localStorage (falls back to memory in private mode).
const DEFAULTS = {
  quality: 'auto', timeOfDay: 'day', master: 80, engine: 70, ambience: 60, chaseDistance: 'normal', invertSteer: false,
  minimapMode: 'north', muted: false, bestLap: null, seenControls: false,
};
const KEY = 'svd-settings-v1';
export class Settings {
  constructor() {
    this.data = { ...DEFAULTS };
    this.listeners = [];
    try { const raw = localStorage.getItem(KEY); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (_) { /* private mode */ }
    const q = new URLSearchParams(location.search);
    if (q.get('quality')) this.data.quality = q.get('quality');
    if (q.get('tod')) this.data.timeOfDay = q.get('tod');
  }
  get(k) { return this.data[k]; }
  set(k, v) { this.data[k] = v; this.save(); this.listeners.forEach((fn) => fn(k, v)); }
  onChange(fn) { this.listeners.push(fn); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (_) { /* ignore */ } }
}
