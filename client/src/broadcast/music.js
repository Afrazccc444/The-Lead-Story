// Original news-theme music, synthesised live with the Web Audio API
// (no recordings, so nothing to license). Built from:
//   a low drone that opens up, a ticking pulse that speeds up, timpani-style
//   hits, a brass-like D-minor stab, a cymbal swell and a quiet music bed.

export function createMusic() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  master.gain.value = 0.8;
  master.connect(comp).connect(ctx.destination);

  let noiseBuffer = null;
  function noise() {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  function env(gainNode, t, attack, peak, decay, sustain = 0.0001) {
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + attack + decay);
  }

  /** Deep drum hit: falling sine + a burst of filtered noise. */
  function timpani(t, gain = 0.9, freq = 62) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.8, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
    env(g, t, 0.005, gain, 1.6);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 1.8);

    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const ng = ctx.createGain();
    env(ng, t, 0.002, gain * 0.35, 0.25);
    n.connect(f).connect(ng).connect(master);
    n.start(t);
    n.stop(t + 0.4);
  }

  /** Short bright tick for the pulse. */
  function tick(t, gain = 0.12) {
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    env(g, t, 0.001, gain, 0.05);
    n.connect(f).connect(g).connect(master);
    n.start(t);
    n.stop(t + 0.08);
  }

  /** Brass-like chord: detuned saws through an opening low-pass filter. */
  function brass(t, freqs, length = 2.4, gain = 0.16) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.18);
    f.frequency.exponentialRampToValueAtTime(900, t + length);
    const g = ctx.createGain();
    env(g, t, 0.04, gain, length, 0.0001);
    f.connect(g).connect(master);
    for (const freq of freqs) {
      for (const detune of [-7, 0, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        o.detune.value = detune;
        o.connect(f);
        o.start(t);
        o.stop(t + length + 0.1);
      }
    }
  }

  /** Rising cymbal swell. */
  function swell(t, length = 2) {
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2000, t);
    f.frequency.exponentialRampToValueAtTime(9000, t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + length);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.15);
    n.connect(f).connect(g).connect(master);
    n.start(t);
    n.stop(t + length + 0.2);
  }

  /** Low drone that slowly opens up. */
  function drone(t, length) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(140, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + length * 0.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 1.5);
    g.gain.setValueAtTime(0.18, t + length - 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    f.connect(g).connect(master);
    for (const [freq, type] of [
      [36.71, 'sawtooth'],
      [73.42, 'sawtooth'],
      [110, 'triangle'],
    ]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = Math.random() * 8 - 4;
      o.connect(f);
      o.start(t);
      o.stop(t + length + 0.1);
    }
  }

  const D_MINOR = [146.83, 174.61, 220, 293.66]; // D3 F3 A3 D4
  const B_FLAT = [116.54, 146.83, 174.61, 233.08]; // Bb2 D3 F3 Bb3

  let bed = null;

  return {
    /** The ~8.5 s opening theme. Resolves when the big final hit lands. */
    playIntro() {
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + 0.05;
      drone(t0, 8.6);
      // Pulse that accelerates: quarter notes, then eighths, then sixteenths.
      let t = t0 + 0.5;
      for (let i = 0; i < 6; i++, t += 0.5) tick(t, 0.08);
      for (let i = 0; i < 8; i++, t += 0.25) tick(t, 0.1);
      for (let i = 0; i < 12; i++, t += 0.125) tick(t, 0.13);
      timpani(t0 + 0.5, 0.7);
      timpani(t0 + 2.5, 0.8);
      timpani(t0 + 4.5, 0.85, 58);
      brass(t0 + 4.5, B_FLAT, 1.4, 0.1);
      swell(t0 + 5.2, 1.7);
      // The big moment.
      timpani(t0 + 6.9, 1, 55);
      timpani(t0 + 6.9, 0.7, 82);
      brass(t0 + 6.9, D_MINOR, 2.6, 0.2);
      return new Promise((resolve) => setTimeout(resolve, 7300));
    },

    /** Short transition hit between stories. */
    sting() {
      const t = ctx.currentTime + 0.02;
      timpani(t, 0.55);
      brass(t, D_MINOR, 1.1, 0.08);
    },

    /** Quiet rhythmic bed under the anchor. */
    startBed(level = 0.05) {
      if (bed) return;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 2);
      g.connect(master);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      f.connect(g);
      const o1 = ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.value = 73.42;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 110;
      // Gentle breathing movement.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.25;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain).connect(f.frequency);
      [o1, o2].forEach((o) => o.connect(f));
      [o1, o2, lfo].forEach((o) => o.start());
      bed = { g, nodes: [o1, o2, lfo] };
    },

    stopBed() {
      if (!bed) return;
      const { g, nodes } = bed;
      bed = null;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
      nodes.forEach((n) => n.stop(ctx.currentTime + 1.1));
    },

    setVolume(v) {
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.05);
    },

    suspend() {
      return ctx.suspend();
    },

    resume() {
      return ctx.resume();
    },

    close() {
      try {
        ctx.close();
      } catch {
        /* already closed */
      }
    },
  };
}
