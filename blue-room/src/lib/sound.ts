/** Optional ambient sound, synthesised with the Web Audio API (no audio files, no network).
 *  It never starts by itself: `start()` must be called from a user gesture. */
class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private lfos: OscillatorNode[] = [];
  private volume = 0.35;
  on = false;

  private build() {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // brown-ish noise buffer, looped
    const len = ctx.sampleRate * 6;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    const make = (freq: number, q: number, lfoRate: number, lfoDepth: number, gainBase: number) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = Math.random() * 2;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gainBase;
      const lfo = ctx.createOscillator(); lfo.frequency.value = lfoRate;
      const depth = ctx.createGain(); depth.gain.value = lfoDepth;
      lfo.connect(depth); depth.connect(g.gain); depth.connect(f.frequency);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(); lfo.start();
      this.nodes.push(src, f, g, depth); this.lfos.push(lfo);
    };
    // slow swells (waves) + a softer, faster shimmer layer
    make(420, 0.7, 0.085, 0.22, 0.42);
    make(900, 0.4, 0.13, 0.12, 0.16);
    this.ctx = ctx; this.master = master;
  }

  async start(volume: number) {
    this.volume = volume;
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    const t = this.ctx!.currentTime;
    this.master!.gain.cancelScheduledValues(t);
    this.master!.gain.setTargetAtTime(volume * 0.8, t, 0.9);
    this.on = true;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.master && this.on) this.master.gain.setTargetAtTime(v * 0.8, this.ctx.currentTime, 0.15);
  }

  stop() {
    this.on = false;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.35);
    const ctx = this.ctx;
    setTimeout(() => { if (!this.on) ctx.suspend().catch(() => {}); }, 1400);
  }
}

export const ambient = new Ambient();
export const soundSupported = () => typeof AudioContext !== 'undefined';
