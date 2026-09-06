// Fully synthesised Web Audio mixer: no sample files, so nothing to download or credit.
export class AudioMixer {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.ready = false; this.muted = settings.get('muted');
    this._pending = [];
  }
  unlock() {
    if (this.ready) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      this.engineBus = ctx.createGain(); this.engineBus.connect(this.master);
      this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
      this.fxBus = ctx.createGain(); this.fxBus.connect(this.master);
      this._buildEngine(); this._buildPlane(); this._buildWind(); this._buildTyres(); this._buildAmbience();
      this.applyVolumes();
      this.ready = true;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { console.warn('audio unavailable', e); }
  }
  applyVolumes() {
    if (!this.ready) return;
    const s = this.settings;
    const m = this.muted ? 0 : s.get('master') / 100;
    this.master.gain.value = m * 0.8;
    this.engineBus.gain.value = s.get('engine') / 100;
    this.ambBus.gain.value = s.get('ambience') / 100;
    this.fxBus.gain.value = 1;
  }
  setMuted(m) { this.muted = m; this.settings.set('muted', m); this.applyVolumes(); }
  _noise(seconds = 2) {
    const ctx = this.ctx; const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return buf;
  }
  _buildEngine() {
    const ctx = this.ctx;
    this.engOsc = [ctx.createOscillator(), ctx.createOscillator(), ctx.createOscillator()];
    this.engOsc[0].type = 'sawtooth'; this.engOsc[1].type = 'square'; this.engOsc[2].type = 'triangle';
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 400; this.engFilter.Q.value = 2;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0.0;
    const mix = [0.25, 0.12, 0.3];
    this.engOsc.forEach((o, i) => { const g = ctx.createGain(); g.gain.value = mix[i]; o.connect(g); g.connect(this.engFilter); o.start(); });
    this.engFilter.connect(this.engGain); this.engGain.connect(this.engineBus);
    // Boost whoosh: bandpassed noise.
    this.boostSrc = ctx.createBufferSource(); this.boostSrc.buffer = this._noise(2); this.boostSrc.loop = true;
    this.boostFilter = ctx.createBiquadFilter(); this.boostFilter.type = 'bandpass'; this.boostFilter.frequency.value = 1200; this.boostFilter.Q.value = 0.8;
    this.boostGain = ctx.createGain(); this.boostGain.gain.value = 0;
    this.boostSrc.connect(this.boostFilter); this.boostFilter.connect(this.boostGain); this.boostGain.connect(this.engineBus); this.boostSrc.start();
  }
  // Piston-prop engine: low sawtooth/triangle fundamental with an amplitude-modulated noise "chop" at the blade-pass rate.
  _buildPlane() {
    const ctx = this.ctx;
    this.propOsc = [ctx.createOscillator(), ctx.createOscillator(), ctx.createOscillator()];
    this.propOsc[0].type = 'sawtooth'; this.propOsc[1].type = 'triangle'; this.propOsc[2].type = 'square';
    this.propFilter = ctx.createBiquadFilter(); this.propFilter.type = 'lowpass'; this.propFilter.frequency.value = 500; this.propFilter.Q.value = 1.2;
    this.propGain = ctx.createGain(); this.propGain.gain.value = 0;
    const mix = [0.3, 0.35, 0.08];
    this.propOsc.forEach((o, i) => { const g = ctx.createGain(); g.gain.value = mix[i]; o.connect(g); g.connect(this.propFilter); o.start(); });
    this.propFilter.connect(this.propGain); this.propGain.connect(this.engineBus);
    this.chopSrc = ctx.createBufferSource(); this.chopSrc.buffer = this._noise(2); this.chopSrc.loop = true;
    this.chopFilter = ctx.createBiquadFilter(); this.chopFilter.type = 'bandpass'; this.chopFilter.frequency.value = 900; this.chopFilter.Q.value = 0.7;
    this.chopGain = ctx.createGain(); this.chopGain.gain.value = 0;
    this.chopLfo = ctx.createOscillator(); this.chopLfo.type = 'sine'; this.chopLfo.frequency.value = 40; this.chopDepth = ctx.createGain(); this.chopDepth.gain.value = 0; this.chopLfo.connect(this.chopDepth); this.chopDepth.connect(this.chopGain.gain); this.chopLfo.start();
    this.chopSrc.connect(this.chopFilter); this.chopFilter.connect(this.chopGain); this.chopGain.connect(this.engineBus); this.chopSrc.start();
    this.hornOsc = ctx.createOscillator(); this.hornOsc.type = 'square'; this.hornOsc.frequency.value = 1200; this.hornGain = ctx.createGain(); this.hornGain.gain.value = 0; this.hornOsc.connect(this.hornGain); this.hornGain.connect(this.fxBus); this.hornOsc.start();
  }
  _buildWind() {
    const ctx = this.ctx;
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = this._noise(3); this.windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 600;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.fxBus); this.windSrc.start();
    // Gravel / off-road rumble
    this.gravelSrc = ctx.createBufferSource(); this.gravelSrc.buffer = this._noise(2); this.gravelSrc.loop = true;
    this.gravelFilter = ctx.createBiquadFilter(); this.gravelFilter.type = 'bandpass'; this.gravelFilter.frequency.value = 180; this.gravelFilter.Q.value = 1.2;
    this.gravelGain = ctx.createGain(); this.gravelGain.gain.value = 0;
    this.gravelSrc.connect(this.gravelFilter); this.gravelFilter.connect(this.gravelGain); this.gravelGain.connect(this.fxBus); this.gravelSrc.start();
  }
  _buildTyres() {
    const ctx = this.ctx;
    this.tyreSrc = ctx.createBufferSource(); this.tyreSrc.buffer = this._noise(2); this.tyreSrc.loop = true;
    this.tyreFilter = ctx.createBiquadFilter(); this.tyreFilter.type = 'bandpass'; this.tyreFilter.frequency.value = 2400; this.tyreFilter.Q.value = 6;
    this.tyreGain = ctx.createGain(); this.tyreGain.gain.value = 0;
    this.tyreSrc.connect(this.tyreFilter); this.tyreFilter.connect(this.tyreGain); this.tyreGain.connect(this.fxBus); this.tyreSrc.start();
  }
  _buildAmbience() {
    const ctx = this.ctx;
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.5; this.ambGain.connect(this.ambBus);
    this.ambMode = 'day';
    this._ambTimer = 0;
  }
  // Called every render frame with car telemetry.
  update(dt, t) {
    if (!this.ready) return;
    const ctx = this.ctx; const now = ctx.currentTime;
    if (t.mode === 'plane') return this._updatePlane(dt, t, now);
    this.propGain.gain.setTargetAtTime(0, now, 0.1); this.chopGain.gain.setTargetAtTime(0, now, 0.1); this.chopDepth.gain.setTargetAtTime(0, now, 0.1); this.hornGain.gain.setTargetAtTime(0, now, 0.05);
    const rpm = 0.15 + Math.min(1, Math.abs(t.speed) / 33.3) * 0.85 + t.throttle * 0.12;
    const f = 40 + rpm * 190;
    this.engOsc[0].frequency.setTargetAtTime(f, now, 0.05);
    this.engOsc[1].frequency.setTargetAtTime(f * 0.5, now, 0.05);
    this.engOsc[2].frequency.setTargetAtTime(f * 2.01, now, 0.05);
    this.engFilter.frequency.setTargetAtTime(300 + rpm * 1400 + t.throttle * 600, now, 0.08);
    this.engGain.gain.setTargetAtTime(0.18 + t.throttle * 0.12 + rpm * 0.05, now, 0.05);
    this.boostGain.gain.setTargetAtTime(t.boosting ? 0.35 : 0, now, 0.1);
    const sp = Math.min(1, Math.abs(t.speed) / 44);
    this.windGain.gain.setTargetAtTime(sp * sp * 0.5, now, 0.1);
    this.windFilter.frequency.setTargetAtTime(300 + sp * 1500, now, 0.1);
    this.gravelGain.gain.setTargetAtTime(t.offroad ? Math.min(0.5, Math.abs(t.speed) / 20) : 0, now, 0.1);
    this.gravelFilter.frequency.setTargetAtTime(t.hedge ? 900 : 180, now, 0.05);
    const slip = t.slip; // 0..1
    this.tyreGain.gain.setTargetAtTime(slip > 0.25 && Math.abs(t.speed) > 4 ? Math.min(0.5, slip) : 0, now, 0.05);
    this.tyreFilter.frequency.setTargetAtTime(1800 + slip * 1400, now, 0.05);
    // Ambience chirps
    this._ambTimer -= dt;
    if (this._ambTimer <= 0) {
      this._ambTimer = this.ambMode === 'night' ? 0.35 + Math.random() * 0.3 : 0.8 + Math.random() * 2.2;
      if (this.ambMode === 'night') this._cricket(); else this._bird();
    }
  }
  _updatePlane(dt, t, now) {
    this.engGain.gain.setTargetAtTime(0, now, 0.1); this.boostGain.gain.setTargetAtTime(0, now, 0.1); this.tyreGain.gain.setTargetAtTime(0, now, 0.1);
    const rpm = t.rpm; const f = 28 + rpm * 62;                      // 1700-5400 rpm equivalents
    this.propOsc[0].frequency.setTargetAtTime(f, now, 0.08); this.propOsc[1].frequency.setTargetAtTime(f * 2, now, 0.08); this.propOsc[2].frequency.setTargetAtTime(f * 0.5, now, 0.08);
    this.propFilter.frequency.setTargetAtTime(250 + rpm * 1500, now, 0.1);
    this.propGain.gain.setTargetAtTime(0.14 + rpm * 0.22, now, 0.08);
    this.chopLfo.frequency.setTargetAtTime(f * 2, now, 0.08); this.chopDepth.gain.setTargetAtTime(0.05 + rpm * 0.12, now, 0.1); this.chopGain.gain.setTargetAtTime(0.05 + rpm * 0.12, now, 0.1);
    this.chopFilter.frequency.setTargetAtTime(500 + rpm * 1400, now, 0.1);
    const sp = Math.min(1, t.speed / 70); this.windGain.gain.setTargetAtTime(sp * sp * 0.6, now, 0.1); this.windFilter.frequency.setTargetAtTime(300 + sp * 2200, now, 0.1);
    this.gravelGain.gain.setTargetAtTime(t.onGround ? Math.min(0.4, t.speed / 30) : 0, now, 0.1); this.gravelFilter.frequency.setTargetAtTime(220, now, 0.05);
    // Stall horn: warbling square wave.
    this.hornOsc.frequency.setTargetAtTime(1100 + Math.sin(now * 12) * 150, now, 0.02); this.hornGain.gain.setTargetAtTime(t.stalled ? 0.06 : 0, now, 0.03);
    this._ambTimer -= dt; if (this._ambTimer <= 0) { this._ambTimer = 2 + Math.random() * 3; if (t.onGround && this.ambMode !== 'night') this._bird(); }
  }
  squeal() { this._burst(0.35, 1800, 3, 0.4, 'bandpass'); this._burst(0.2, 200, 1, 0.5); }
  crash() { this._burst(1.6, 160, 0.8, 1.0); this._burst(0.5, 900, 0.8, 0.6, 'bandpass'); this._tone(50, 1.2, 'sine', 0.6, this.fxBus, 20); }
  setAmbience(mode) { this.ambMode = mode; }
  _tone(freq, dur, type, gain, bus, glide) {
    if (!this.ready) return;
    const ctx = this.ctx; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq; if (glide) o.frequency.exponentialRampToValueAtTime(glide, ctx.currentTime + dur);
    g.gain.value = 0; g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(bus); o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }
  _bird() { const base = 1800 + Math.random() * 1800; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) setTimeout(() => this._tone(base, 0.12, 'sine', 0.05, this.ambGain, base * 1.4), i * 140); }
  _cricket() { this._tone(4200, 0.08, 'square', 0.012, this.ambGain); }
  _burst(dur, freq, q, gain, type = 'lowpass') {
    if (!this.ready) return;
    const ctx = this.ctx; const s = ctx.createBufferSource(); s.buffer = this._noise(dur + 0.1);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain; g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(this.fxBus); s.start(); s.stop(ctx.currentTime + dur + 0.1);
  }
  thud(strength) { this._burst(0.25 + strength * 0.2, 120 + strength * 200, 1, Math.min(1, 0.2 + strength)); this._tone(60, 0.3, 'sine', 0.4 * Math.min(1, strength + 0.3), this.fxBus, 30); }
  bump() { this._burst(0.12, 250, 1.5, 0.35); }
  splash() { this._burst(1.2, 900, 0.7, 0.8, 'bandpass'); this._burst(0.6, 300, 1, 0.5); }
  rustle() { this._burst(0.3, 3000, 0.5, 0.25, 'highpass'); }
  chime() { [880, 1320, 1760].forEach((f, i) => setTimeout(() => this._tone(f, 0.5, 'sine', 0.25, this.fxBus), i * 90)); }
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.6, 'triangle', 0.3, this.fxBus), i * 130)); }
  click() { this._tone(1200, 0.05, 'square', 0.08, this.fxBus); }
  boostStart() { this._tone(200, 0.6, 'sawtooth', 0.15, this.fxBus, 900); }
}
