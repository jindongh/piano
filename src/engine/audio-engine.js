// Audio Engine — Tone.js based piano synth with metronome
import * as Tone from 'tone';

class AudioEngine {
  constructor() {
    this.synth = null;
    this.metronome = null;
    this.metronomeLoop = null;
    this.isReady = false;
    this.volume = -6; // dB
  }

  async init() {
    if (this.isReady) return;
    await Tone.start();

    // Piano synth — polyphonic with nice envelope
    this.synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 16,
      voice: Tone.Synth,
      options: {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 1.2 },
        volume: this.volume
      }
    }).toDestination();

    // Metronome click
    this.metronome = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 6,
      oscillator: { type: 'square4' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
      volume: -12
    }).toDestination();

    this.isReady = true;
  }

  playNote(noteFullName, duration = '8n', velocity = 0.7) {
    if (!this.synth) return;
    this.synth.triggerAttackRelease(noteFullName, duration, undefined, velocity);
  }

  noteOn(noteFullName, velocity = 0.7) {
    if (!this.synth) return;
    this.synth.triggerAttack(noteFullName, undefined, velocity);
  }

  noteOff(noteFullName) {
    if (!this.synth) return;
    this.synth.triggerRelease(noteFullName);
  }

  startMetronome(bpm = 120, beatsPerMeasure = 4) {
    this.stopMetronome();
    Tone.getTransport().bpm.value = bpm;
    let beatCount = 0;
    this.metronomeLoop = new Tone.Loop((time) => {
      const isDownbeat = beatCount % beatsPerMeasure === 0;
      this.metronome.triggerAttackRelease(isDownbeat ? 'C5' : 'C4', '32n', time);
      beatCount++;
    }, '4n');
    this.metronomeLoop.start(0);
    Tone.getTransport().start();
  }

  stopMetronome() {
    if (this.metronomeLoop) {
      this.metronomeLoop.stop();
      this.metronomeLoop.dispose();
      this.metronomeLoop = null;
    }
    Tone.getTransport().stop();
  }

  setTempo(bpm) {
    Tone.getTransport().bpm.value = bpm;
  }

  setVolume(db) {
    this.volume = db;
    if (this.synth) this.synth.volume.value = db;
  }

  dispose() {
    this.stopMetronome();
    if (this.synth) { this.synth.dispose(); this.synth = null; }
    if (this.metronome) { this.metronome.dispose(); this.metronome = null; }
    this.isReady = false;
  }
}

export const audioEngine = new AudioEngine();
