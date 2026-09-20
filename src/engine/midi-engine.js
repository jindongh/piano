// MIDI Engine — handles Web MIDI API and keyboard fallback
import { midiToNote } from '../utils/note-utils.js';
import { showToast } from '../utils/toast.js';

class MidiEngine {
  constructor() {
    this.midiAccess = null;
    this.activeInput = null;
    this.listeners = { noteon: [], noteoff: [], connect: [], disconnect: [] };
    this.activeNotes = new Map(); // midi -> { velocity, timestamp }
    this.keyboardMap = this._buildKeyboardMap();
    this.keyboardEnabled = true;
    this._keydownHandler = this._onKeydown.bind(this);
    this._keyupHandler = this._onKeyup.bind(this);
  }

  on(event, fn) {
    if (this.listeners[event]) this.listeners[event].push(fn);
  }

  off(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    }
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  async init() {
    // Enable keyboard fallback
    document.addEventListener('keydown', this._keydownHandler);
    document.addEventListener('keyup', this._keyupHandler);

    // Try Web MIDI
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported');
      return false;
    }
    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = (e) => this._onStateChange(e);
      this._connectFirstInput();
      return true;
    } catch (err) {
      console.warn('MIDI access denied:', err);
      return false;
    }
  }

  _connectFirstInput() {
    if (!this.midiAccess) return;
    for (const input of this.midiAccess.inputs.values()) {
      this._connectInput(input);
      return;
    }
  }

  _connectInput(input) {
    if (this.activeInput) {
      this.activeInput.onmidimessage = null;
    }
    this.activeInput = input;
    input.onmidimessage = (e) => this._onMidiMessage(e);
    this._emit('connect', { name: input.name, id: input.id });
    showToast(`🎹 已连接: ${input.name}`, 'success');
  }

  _onStateChange(e) {
    const port = e.port;
    if (port.type !== 'input') return;
    if (port.state === 'connected') {
      this._connectInput(port);
    } else if (port.state === 'disconnected' && this.activeInput?.id === port.id) {
      this.activeInput = null;
      this._emit('disconnect', { name: port.name });
      showToast(`🎹 已断开: ${port.name}`, 'warning');
    }
  }

  _onMidiMessage(e) {
    const [status, note, velocity] = e.data;
    const command = status & 0xf0;
    if (command === 0x90 && velocity > 0) {
      this._noteOn(note, velocity, performance.now());
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this._noteOff(note, performance.now());
    }
  }

  _noteOn(midi, velocity, timestamp) {
    this.activeNotes.set(midi, { velocity, timestamp });
    const noteInfo = midiToNote(midi);
    this._emit('noteon', { ...noteInfo, velocity, timestamp });
  }

  _noteOff(midi, timestamp) {
    const noteData = this.activeNotes.get(midi);
    this.activeNotes.delete(midi);
    const noteInfo = midiToNote(midi);
    const duration = noteData ? timestamp - noteData.timestamp : 0;
    this._emit('noteoff', { ...noteInfo, timestamp, duration });
  }

  _buildKeyboardMap() {
    // QWERTY to MIDI: bottom row = C3-B3, top row = C4-B4
    const map = {};
    const lower = 'zsxdcvgbhnjm';
    const upper = 'q2w3er5t6y7ui';
    lower.split('').forEach((k, i) => { map[k] = 48 + i; }); // C3
    upper.split('').forEach((k, i) => { map[k] = 60 + i; }); // C4
    return map;
  }

  _onKeydown(e) {
    if (!this.keyboardEnabled || e.repeat) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const midi = this.keyboardMap[e.key.toLowerCase()];
    if (midi != null && !this.activeNotes.has(midi)) {
      this._noteOn(midi, 80, performance.now());
    }
  }

  _onKeyup(e) {
    if (!this.keyboardEnabled) return;
    const midi = this.keyboardMap[e.key.toLowerCase()];
    if (midi != null) {
      this._noteOff(midi, performance.now());
    }
  }

  getInputs() {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.inputs.values()).map(i => ({
      id: i.id, name: i.name, state: i.state
    }));
  }

  isConnected() {
    return this.activeInput != null;
  }

  getDeviceName() {
    return this.activeInput?.name || null;
  }

  destroy() {
    document.removeEventListener('keydown', this._keydownHandler);
    document.removeEventListener('keyup', this._keyupHandler);
    if (this.activeInput) this.activeInput.onmidimessage = null;
  }
}

export const midiEngine = new MidiEngine();
