import { midiToFreq } from "@/lib/music/theory";

type Voice = {
  midi: number;
  oscs: OscillatorNode[];
  noise?: AudioBufferSourceNode;
  gain: GainNode;
  released: boolean;
};

const PARTIALS = [1, 2, 3, 4, 5, 6, 7, 8];
const GAINS = [1, 0.42, 0.26, 0.14, 0.09, 0.055, 0.03, 0.016];
const B = 0.00018;

export class PianoEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private delay: DelayNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private voices = new Map<number, Voice[]>();
  private unlocked = false;

  get audioContext() {
    return this.ctx;
  }

  async resume() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    this.unlocked = true;
    return ctx;
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.55;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 14000;
    filter.Q.value = 0.4;

    const delay = ctx.createDelay(0.4);
    delay.delayTime.value = 0.038;
    const fb = ctx.createGain();
    fb.gain.value = 0.16;
    const wet = ctx.createGain();
    wet.gain.value = 0.18;

    filter.connect(master);
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.filter = filter;
    this.delay = delay;

    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    this.noiseBuf = buf;
    return ctx;
  }

  noteOn(midi: number, velocity = 0.82, when?: number) {
    if (!this.unlocked && !this.ctx) this.ensure();
    const ctx = this.ctx;
    const dest = this.filter;
    if (!ctx || !dest) return;
    const t = when ?? ctx.currentTime;
    const freq = midiToFreq(midi);
    const vel = Math.max(0.12, Math.min(1, velocity));

    const existing = this.voices.get(midi);
    if (existing?.length) {
      for (const v of existing) this.releaseVoice(v, t, 0.03);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.connect(dest);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    const bright = 900 + vel * 4800 + Math.max(0, midi - 48) * 18;
    lp.frequency.setValueAtTime(bright, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, bright * 0.35), t + 0.35);
    lp.Q.value = 0.85;
    lp.connect(gain);

    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < PARTIALS.length; i++) {
      const n = PARTIALS[i]!;
      const f = freq * n * Math.sqrt(1 + B * n * n);
      if (f > 14000) continue;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      const inharm = n === 1 ? 1 : 0.92 / Math.sqrt(n);
      g.gain.value = GAINS[i]! * inharm;
      o.connect(g);
      g.connect(lp);
      o.start(t);
      oscs.push(o);
    }

    let noise: AudioBufferSourceNode | undefined;
    if (this.noiseBuf) {
      noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.12 * vel, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      const nf = ctx.createBiquadFilter();
      nf.type = "highpass";
      nf.frequency.value = 800;
      noise.connect(nf);
      nf.connect(ng);
      ng.connect(lp);
      noise.start(t);
    }

    const peak = 0.22 + vel * 0.55;
    const decay = 0.55 + (1 - midi / 108) * 2.6;
    gain.gain.linearRampToValueAtTime(peak, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0008, peak * 0.28), t + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    const voice: Voice = { midi, oscs, noise, gain, released: false };
    const list = this.voices.get(midi) ?? [];
    list.push(voice);
    this.voices.set(midi, list);

    const killAt = (decay + 0.05) * 1000;
    window.setTimeout(() => this.disposeVoice(voice), killAt);
  }

  noteOff(midi: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const list = this.voices.get(midi);
    if (!list) return;
    for (const v of list) this.releaseVoice(v, ctx.currentTime, 0.12);
  }

  schedule(midi: number, start: number, dur: number, velocity = 0.78) {
    this.noteOn(midi, velocity, start);
    const ctx = this.ctx;
    if (!ctx) return;
    const off = start + Math.max(0.06, dur);
    window.setTimeout(() => this.noteOff(midi), Math.max(0, (off - ctx.currentTime) * 1000));
  }

  stopAll() {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const list of this.voices.values()) {
      for (const v of list) this.releaseVoice(v, ctx.currentTime, 0.04);
    }
  }

  click(accent = false, when?: number) {
    const ctx = this.ensure();
    const t = when ?? ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1680 : 980;
    o.type = "square";
    g.gain.setValueAtTime(accent ? 0.09 : 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.06);
  }

  private releaseVoice(v: Voice, t: number, rel: number) {
    if (v.released) return;
    v.released = true;
    try {
      const cur = v.gain.gain.value;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(Math.max(0.0001, cur), t);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t + rel);
    } catch {
      /* already gone */
    }
    window.setTimeout(() => this.disposeVoice(v), rel * 1000 + 40);
  }

  private disposeVoice(v: Voice) {
    for (const o of v.oscs) {
      try {
        o.stop();
        o.disconnect();
      } catch {
        /* */
      }
    }
    try {
      v.noise?.stop();
      v.noise?.disconnect();
    } catch {
      /* */
    }
    try {
      v.gain.disconnect();
    } catch {
      /* */
    }
    const list = this.voices.get(v.midi);
    if (list) {
      const next = list.filter((x) => x !== v);
      if (next.length) this.voices.set(v.midi, next);
      else this.voices.delete(v.midi);
    }
  }
}

let singleton: PianoEngine | null = null;

export function getPiano(): PianoEngine {
  if (!singleton) singleton = new PianoEngine();
  return singleton;
}
