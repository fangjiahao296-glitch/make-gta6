// Solara Bay — synthesized sound and music. WebAudio only, no audio files.
// Everything is guarded: no context exists until the first user gesture.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // Short blip: frequency sweep.
  blip(freqA, freqB, dur, type = 'sine', vol = 0.25) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freqA, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  // Noise burst (gunshot, impact).
  noise(dur, vol = 0.4, lowpass = 1800) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  shot() { this.noise(0.16, 0.5, 2600); this.blip(220, 55, 0.12, 'square', 0.18); }
  enemyShot() { this.noise(0.12, 0.22, 1400); }
  hit() { this.blip(320, 140, 0.09, 'triangle', 0.3); }
  pickup() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, f, 0.16, 'sine', 0.25), i * 90)); }
  horn() { this.blip(370, 370, 0.22, 'sawtooth', 0.16); this.blip(466, 466, 0.22, 'sawtooth', 0.12); }
  missionDone() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, f, 0.22, 'triangle', 0.28), i * 110)); }
  busted() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, f * 0.9, 0.3, 'sawtooth', 0.2), i * 160)); }

  // Continuous engine hum while driving; call every frame with speed 0..1.
  engine(speed, on) {
    if (!on) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      return;
    }
    if (!this.ensure()) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 700;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speed * 130, t, 0.05);
      this.engineGain.gain.setTargetAtTime(0.05 + speed * 0.06, t, 0.08);
    } catch (e) { /* ignore */ }
  }

  siren(on) {
    if (!on) {
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      return;
    }
    if (!this.ensure()) return;
    try {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.7;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 320;
        lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
        this.sirenOsc.frequency.value = 850;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start(); lfo.start();
      }
      this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.1);
    } catch (e) { /* ignore */ }
  }

  // Tiny bass-and-hat loop. 8 steps, ~132 bpm.
  startMusic() {
    if (this.musicTimer || !this.ensure()) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      try {
        const step = this.musicStep % 8;
        const f = bass[step];
        if (f) this.blip(f, f, 0.2, 'triangle', 0.22);
        if (step % 2 === 0) this.noise(0.03, 0.05, 6000);
        this.musicStep++;
      } catch (e) { /* ignore */ }
    }, 227);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
