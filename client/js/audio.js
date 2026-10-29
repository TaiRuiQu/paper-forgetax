// Tiny synthesizer: no audio files, every sound is generated with WebAudio.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.enabled = true;
    this.volume = 0.65;
    this.ambience = null;
    this.crackleTimer = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    this.noiseBuffer = buffer;
  }

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.03);
    if (!this.enabled) this.stopAmbience();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
  }

  tone({ freq = 440, dur = 0.15, type = 'sine', gain = 0.12, slideTo = null, delay = 0, attack = 0.005 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.15, gain = 0.15, freq = 1200, q = 0.7, type = 'bandpass', delay = 0 }) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  bellNote(freq, delay, gain = 0.1, dur = 1.6) {
    this.tone({ freq, dur, type: 'sine', gain, delay, attack: 0.002 });
    this.tone({ freq: freq * 2.01, dur: dur * 0.6, type: 'sine', gain: gain * 0.35, delay });
    this.tone({ freq: freq * 2.98, dur: dur * 0.35, type: 'sine', gain: gain * 0.16, delay });
  }

  play(name) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    switch (name) {
      case 'click':
        this.tone({ freq: 540, dur: 0.04, type: 'square', gain: 0.025 });
        break;
      case 'hover':
        this.tone({ freq: 880, dur: 0.025, type: 'sine', gain: 0.012 });
        break;
      case 'error':
        this.tone({ freq: 130, dur: 0.16, type: 'sawtooth', gain: 0.06 });
        this.tone({ freq: 98, dur: 0.2, type: 'square', gain: 0.04, delay: 0.06 });
        break;
      case 'hammer':
        this.noise({ dur: 0.18, gain: 0.22, freq: 700, q: 0.8 });
        this.tone({ freq: 86, dur: 0.22, type: 'sine', gain: 0.22, slideTo: 42 });
        this.tone({ freq: 1600, dur: 0.06, type: 'triangle', gain: 0.05 });
        break;
      case 'success':
        this.tone({ freq: 523, dur: 0.12, type: 'square', gain: 0.06 });
        this.tone({ freq: 784, dur: 0.2, type: 'triangle', gain: 0.07, delay: 0.08 });
        break;
      case 'great':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.28, type: 'triangle', gain: 0.075, delay: i * 0.07 }));
        this.noise({ dur: 0.3, gain: 0.06, freq: 3200, type: 'highpass', delay: 0.05 });
        break;
      case 'hold':
        this.tone({ freq: 196, dur: 0.18, type: 'triangle', gain: 0.08, slideTo: 180 });
        this.noise({ dur: 0.1, gain: 0.05, freq: 400 });
        break;
      case 'damage':
        this.tone({ freq: 220, dur: 0.24, type: 'sawtooth', gain: 0.08, slideTo: 70 });
        this.noise({ dur: 0.2, gain: 0.12, freq: 500 });
        break;
      case 'break':
        this.noise({ dur: 0.55, gain: 0.22, freq: 900, q: 0.4 });
        this.tone({ freq: 120, dur: 0.45, type: 'sawtooth', gain: 0.15, slideTo: 35 });
        this.tone({ freq: 300, dur: 0.3, type: 'square', gain: 0.05, slideTo: 100 });
        break;
      case 'protect':
        this.tone({ freq: 880, dur: 0.2, type: 'triangle', gain: 0.06 });
        this.tone({ freq: 1320, dur: 0.25, type: 'sine', gain: 0.04, delay: 0.05 });
        break;
      case 'frenzy':
        this.tone({ freq: 220, dur: 0.5, type: 'sawtooth', gain: 0.07, slideTo: 880 });
        this.noise({ dur: 0.6, gain: 0.05, freq: 2200, type: 'highpass' });
        break;
      case 'frenzy-end':
        this.tone({ freq: 660, dur: 0.4, type: 'triangle', gain: 0.06, slideTo: 220 });
        break;
      case 'coin':
        this.tone({ freq: 1320, dur: 0.08, type: 'square', gain: 0.045 });
        this.tone({ freq: 1760, dur: 0.16, type: 'sine', gain: 0.04, delay: 0.05 });
        break;
      case 'buy':
        this.tone({ freq: 660, dur: 0.09, type: 'square', gain: 0.045 });
        this.tone({ freq: 990, dur: 0.16, type: 'square', gain: 0.04, delay: 0.08 });
        break;
      case 'heat':
        this.noise({ dur: 0.7, gain: 0.1, freq: 380, q: 0.5 });
        this.tone({ freq: 80, dur: 0.5, type: 'sine', gain: 0.06, slideTo: 60 });
        break;
      case 'bell':
        this.bellNote(392, 0, 0.12, 2.2);
        this.bellNote(523, 0.06, 0.08, 2);
        this.bellNote(784, 0.12, 0.05, 1.6);
        this.noise({ dur: 0.15, gain: 0.08, freq: 2600, type: 'highpass' });
        break;
      case 'achievement':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.bellNote(f, i * 0.11, 0.05, 1.3));
        break;
      case 'day':
        this.tone({ freq: 110, dur: 0.9, type: 'sine', gain: 0.1, slideTo: 80 });
        this.tone({ freq: 220, dur: 0.7, type: 'triangle', gain: 0.04 });
        break;
      case 'rewind':
        this.tone({ freq: 800, dur: 0.05, type: 'square', gain: 0.04 });
        this.tone({ freq: 500, dur: 0.08, type: 'square', gain: 0.04, delay: 0.06 });
        this.tone({ freq: 250, dur: 0.22, type: 'triangle', gain: 0.05, delay: 0.12 });
        break;
      case 'death':
        this.tone({ freq: 140, dur: 1.4, type: 'sawtooth', gain: 0.09, slideTo: 40 });
        this.noise({ dur: 1.1, gain: 0.06, freq: 300 });
        break;
      case 'victory':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.bellNote(f, i * 0.14, 0.055, 1.8));
        break;
      default:
        break;
    }
  }

  startAmbience() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || this.ambience) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.025;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    this.ambience = { src, gain };
    this.crackleTimer = setInterval(() => {
      if (!this.enabled || document.hidden) return;
      if (Math.random() < 0.5) {
        this.noise({ dur: 0.03 + Math.random() * 0.06, gain: 0.01 + Math.random() * 0.02, freq: 900 + Math.random() * 1600, q: 2 });
      }
    }, 1400);
  }

  stopAmbience() {
    if (this.crackleTimer) clearInterval(this.crackleTimer);
    this.crackleTimer = null;
    if (this.ambience) {
      try { this.ambience.src.stop(); } catch { /* ignore */ }
      this.ambience = null;
    }
  }
}
