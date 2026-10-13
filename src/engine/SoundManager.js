export class SoundManager {
  constructor(saveManager) {
    this.saveManager = saveManager;
    this.ctx = null;
    this.bgmTimer = null;
    this.currentTheme = null;
    this.stepIndex = 0;
  }

  ensureContext() {
    if (!this.saveManager.data.soundEnabled && !this.saveManager.data.musicEnabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTone(freq, duration = 0.12, type = 'triangle', gainVal = 0.14, slideTo = null, delay = 0) {
    if (!this.saveManager.data.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    }

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(gainVal, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  jump(isDouble = false) {
    if (isDouble) {
      this.playTone(340, 0.14, 'sine', 0.16, 680);
      this.playTone(520, 0.12, 'triangle', 0.12, 880, 0.05);
    } else {
      this.playTone(220, 0.15, 'sine', 0.16, 460);
    }
  }

  dive() {
    this.playTone(380, 0.18, 'sawtooth', 0.12, 160);
    this.playTone(520, 0.1, 'triangle', 0.1, 740, 0.04);
  }

  groundPound() {
    this.playTone(130, 0.28, 'sawtooth', 0.22, 42);
    this.playTone(90, 0.25, 'square', 0.16, 35, 0.03);
  }

  coin() {
    this.playTone(987.77, 0.08, 'sine', 0.14);
    this.playTone(1318.51, 0.22, 'triangle', 0.15, null, 0.07);
  }

  attack() {
    this.playTone(220, 0.08, 'sawtooth', 0.14, 620);
    this.playTone(440, 0.09, 'triangle', 0.12, 180, 0.02);
  }

  enemyDefeat() {
    // Deep bass punch + bright impact crunch
    this.playTone(135, 0.16, 'sawtooth', 0.22, 42);
    this.playTone(340, 0.1, 'square', 0.16, 680, 0.02);
    this.playTone(680, 0.15, 'triangle', 0.16, 960, 0.06);
  }
  hurt() {
    this.playTone(210, 0.18, 'sawtooth', 0.18, 95);
    this.playTone(150, 0.22, 'square', 0.15, 70, 0.08);
  }

  bounce() {
    this.playTone(240, 0.24, 'sine', 0.18, 760);
  }

  switchPress() {
    this.playTone(440, 0.09, 'square', 0.12);
    this.playTone(660, 0.14, 'triangle', 0.14, null, 0.08);
  }

  cageBreak() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'triangle', 0.16, null, idx * 0.08);
    });
  }

  uiClick() {
    this.playTone(620, 0.05, 'triangle', 0.1, 780);
  }

  startMusic(theme = 'hub') {
    this.currentTheme = theme;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (!this.saveManager.data.musicEnabled) return;

    const melodies = {
      hub: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23],
      meadow: [329.63, 392.0, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0],
      snow: [293.66, 369.99, 440.0, 587.33, 554.37, 440.0, 369.99, 329.63],
      temple: [220.0, 261.63, 293.66, 311.13, 293.66, 261.63, 220.0, 196.0]
    };

    const seq = melodies[theme] || melodies.hub;
    this.stepIndex = 0;

    this.bgmTimer = setInterval(() => {
      if (!this.saveManager.data.musicEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const note = seq[this.stepIndex % seq.length];
      this.stepIndex++;
      this.playMusicNote(note, 0.28);
    }, 360);
  }

  playMusicNote(freq, duration) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0005, start);
    gain.gain.linearRampToValueAtTime(0.032, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0005, start + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  stopMusic() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}
