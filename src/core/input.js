// Keyboard -> intent struct sampled once per render frame. Actions fire once per key press.
export class Input {
  constructor() {
    this.keys = new Set();
    this.throttle = 0; this.brake = 0; this.steer = 0; this.handbrake = false; this.boost = false;
    this.pitch = 0; this.roll = 0; this.yaw = 0; this.invertPitch = false;
    this.actions = {};
    this.enabled = true;
    this.invertSteer = false;
    this.mouse = { dx: 0, dy: 0, down: false, wheel: 0 };
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    const canvas = document.getElementById('gl');
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.down = true; } });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    window.addEventListener('mousemove', (e) => { if (this.mouse.down) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    // Trackpad pinch (ctrl+wheel) and Safari gestures must never zoom the page: it pushes the HUD off-screen.
    window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
  }
  on(action, fn) { (this.actions[action] ||= []).push(fn); return this; }
  fire(action, e) { (this.actions[action] || []).forEach((fn) => fn(e)); }
  onKey(e, down) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.code;
    if (down && !e.repeat) {
      const map = { KeyC: 'camera', KeyR: 'reset', KeyN: 'timeOfDay', KeyT: 'teleport', KeyM: 'map', Tab: 'missions', KeyX: 'mute', Escape: 'pause', Backquote: 'debug', KeyH: 'help', Enter: 'confirm', KeyE: 'swap', KeyB: 'boat', KeyF: 'fly', KeyV: 'flaps' };
      if (map[k]) { this.fire(map[k], e); if (k === 'Tab') e.preventDefault(); }
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(k)) e.preventDefault();
    if (down) this.keys.add(k); else this.keys.delete(k);
  }
  clear() { this.keys.clear(); this.mouse.down = false; }
  sample() {
    const k = this.keys;
    const has = (...codes) => codes.some((c) => k.has(c));
    const on = this.enabled;
    this.throttle = on && has('KeyW', 'ArrowUp') ? 1 : 0;
    this.brake = on && has('KeyS', 'ArrowDown') ? 1 : 0;
    let s = 0; if (on && has('KeyA', 'ArrowLeft')) s -= 1; if (on && has('KeyD', 'ArrowRight')) s += 1;
    this.steer = this.invertSteer ? -s : s;
    this.handbrake = on && has('Space');
    this.boost = on && has('ShiftLeft', 'ShiftRight');
    // Flight axes: arrows pitch/roll (pilot convention: down arrow pulls the nose up), A/D rudder.
    let p = 0; if (on && has('ArrowDown')) p += 1; if (on && has('ArrowUp')) p -= 1;
    this.pitch = this.invertPitch ? -p : p;
    let r = 0; if (on && has('ArrowRight')) r += 1; if (on && has('ArrowLeft')) r -= 1;
    this.roll = r;
    let y = 0; if (on && has('KeyD')) y += 1; if (on && has('KeyA')) y -= 1;
    this.yaw = y;
    this.throttleUp = on && has('KeyW'); this.throttleDown = on && has('KeyS');
  }
}
