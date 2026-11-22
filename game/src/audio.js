// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, siren, gunshots, pickups, UI clicks and a small synthwave loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let musicTimer = null;
  let musicStep = 0;
  let skidSrc = null;
  let skidGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
  }

  // A tiny looped groove: bass line, hats and a pad, scheduled a bar ahead.
  const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3, 55, 0, 55, 65.4, 73.4, 65.4, 58.3, 49];
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]];

  function scheduleBar() {
    if (!ctx || muted) return;
    const stepDur = 0.22;
    const barStart = ctx.currentTime + 0.05;
    for (let step = 0; step < 16; step += 1) {
      const t = barStart + step * stepDur;
      const bass = BASS[step];
      if (bass) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = bass;
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
        osc.connect(gain).connect(master);
        osc.start(t);
        osc.stop(t + stepDur);
      }
      if (step % 2 === 0) {
        const hat = ctx.createBufferSource();
        hat.buffer = noiseBuffer(0.03);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(step % 4 === 0 ? 0.06 : 0.035, t);
        hg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        hat.connect(hp).connect(hg).connect(master);
        hat.start(t);
      }
      if (step === 0) {
        const chord = CHORDS[musicStep % CHORDS.length];
        for (const freq of chord) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 900;
          gain.gain.setValueAtTime(0.03, t);
          gain.gain.linearRampToValueAtTime(0.05, t + 0.5);
          gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 16);
          osc.connect(lp).connect(gain).connect(master);
          osc.start(t);
          osc.stop(t + stepDur * 16);
        }
        musicStep += 1;
      }
    }
  }

  return {
    unlock() {
      resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) this.siren(false);
    },
    isMuted() {
      return muted;
    },
    startMusic() {
      resume();
      if (!ctx || musicTimer) return;
      scheduleBar();
      musicTimer = window.setInterval(scheduleBar, 16 * 0.22 * 1000);
    },
    stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    click() {
      blip(660, 0.06, 'square', 0.12);
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.22);
      window.setTimeout(() => blip(1318, 0.12, 'sine', 0.2), 70);
    },
    cash() {
      blip(1046, 0.08, 'triangle', 0.2);
      window.setTimeout(() => blip(1568, 0.14, 'triangle', 0.18), 80);
    },
    missionOk() {
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.16, 'triangle', 0.22), i * 110));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => window.setTimeout(() => blip(f, 0.2, 'sawtooth', 0.14), i * 140));
    },
    shot() {
      noiseBurst(0.14, 0.5, 2400);
      blip(160, 0.1, 'square', 0.25, 60);
    },
    enemyShot() {
      noiseBurst(0.1, 0.2, 1600);
    },
    hit() {
      blip(220, 0.08, 'square', 0.2, 110);
    },
    thud() {
      noiseBurst(0.2, 0.35, 300);
      blip(90, 0.18, 'sine', 0.3, 45);
    },
    horn() {
      blip(220, 0.25, 'square', 0.16);
      blip(277, 0.25, 'square', 0.12);
    },
    steal() {
      blip(440, 0.07, 'square', 0.14);
      window.setTimeout(() => blip(587, 0.1, 'square', 0.14), 70);
    },
    // Continuous engine hum; call every frame with speed 0..1 (0 = off).
    engine(speed01) {
      if (!ensure()) return;
      if (speed01 <= 0.01) {
        if (engineOsc) {
          try { engineOsc.stop(); } catch { /* already stopped */ }
          engineOsc = null;
          engineGain = null;
          engineFilter = null;
        }
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 700;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.05;
        engineOsc.connect(engineFilter).connect(engineGain).connect(master);
        engineOsc.start();
      }
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 145, t, 0.08);
      engineFilter.frequency.setTargetAtTime(400 + speed01 * 1400, t, 0.1);
      engineGain.gain.setTargetAtTime(0.04 + speed01 * 0.07, t, 0.1);
    },
    // Two-tone police siren loop.
    siren(on) {
      if (on === sirenOn) return;
      sirenOn = on;
      if (!on) {
        if (sirenOsc) {
          try { sirenOsc.stop(); } catch { /* already stopped */ }
          sirenOsc = null;
          sirenGain = null;
        }
        return;
      }
      if (!ensure()) return;
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.045;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      const flip = () => {
        if (!sirenOsc) return;
        sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 700 : 950;
      };
      sirenOsc._flipTimer = window.setInterval(flip, 380);
      const oldStop = sirenOsc.stop.bind(sirenOsc);
      sirenOsc.stop = () => {
        window.clearInterval(sirenOsc._flipTimer);
        oldStop();
      };
    },
    // Tyre skid loop while drifting.
    skid(on) {
      if (!ensure()) return;
      if (!on) {
        if (skidSrc) {
          try { skidSrc.stop(); } catch { /* already stopped */ }
          skidSrc = null;
          skidGain = null;
        }
        return;
      }
      if (skidSrc) return;
      skidSrc = ctx.createBufferSource();
      skidSrc.buffer = noiseBuffer(1);
      skidSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      skidGain = ctx.createGain();
      skidGain.gain.value = 0.06;
      skidSrc.connect(bp).connect(skidGain).connect(master);
      skidSrc.start();
    },
  };
}
