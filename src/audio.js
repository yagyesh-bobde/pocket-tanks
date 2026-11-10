// Small synthesized sounds, generated at runtime. No sampled game audio.
export class Audio {
  constructor(muted = false) {
    this.muted = muted;
    this.ctx = null;
    this.last = 0;
  }
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {}
    }
    this.ctx?.resume();
  }
  sound(kind, radius = 20) {
    if (this.muted || !this.ctx) return;
    const c = this.ctx,
      now = c.currentTime;
    if (kind === "blast" && now - this.last < 0.045) return;
    if (kind === "blast") this.last = now;
    const osc = c.createOscillator(),
      gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    let duration = 0.12;
    if (kind === "fire") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
      duration = 0.2;
    } else if (kind === "blast") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(90 + radius, now);
      osc.frequency.exponentialRampToValueAtTime(24, now + 0.28);
      duration = 0.32;
    } else if (kind === "turn") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(660, now + 0.07);
      duration = 0.16;
    } else if (kind === "end") {
      osc.type = "triangle";
      [440, 554, 660, 880].forEach((f, i) =>
        osc.frequency.setValueAtTime(f, now + i * 0.12),
      );
      duration = 0.6;
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(kind === "tick" ? 120 : 650, now);
      duration = 0.04;
    }
    gain.gain.setValueAtTime(kind === "blast" ? 0.1 : 0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }
}
