// Piano Keyboard Component — interactive SVG piano
import { generateKeyRange, isBlackKey } from '../utils/note-utils.js';

export class PianoKeyboard {
  constructor(container, options = {}) {
    this.container = container;
    this.startMidi = options.startMidi || 48; // C3
    this.endMidi = options.endMidi || 84;   // C6
    this.showLabels = options.showLabels ?? true;
    this.onNoteOn = options.onNoteOn || null;
    this.onNoteOff = options.onNoteOff || null;
    this.keys = generateKeyRange(this.startMidi, this.endMidi);
    this.keyElements = new Map();
    this.activePointers = new Map();
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'piano-container';

    const keysDiv = document.createElement('div');
    keysDiv.className = 'piano-keys';

    // Separate white and black for proper layering
    const whiteKeys = this.keys.filter(k => !k.isBlack);
    const allKeysPositioned = [];

    // Calculate positions based on white key index
    let whiteIndex = 0;
    this.keys.forEach(key => {
      if (!key.isBlack) {
        allKeysPositioned.push({ ...key, whiteIndex: whiteIndex++ });
      }
    });

    // Create white keys first
    whiteKeys.forEach((key, i) => {
      const el = this._createKey(key, false);
      el.style.position = 'absolute';
      el.style.left = `${i * 40}px`;
      el.style.width = '40px';
      keysDiv.appendChild(el);
      this.keyElements.set(key.midi, el);
    });

    // Then black keys on top
    let wIdx = 0;
    this.keys.forEach(key => {
      if (!key.isBlack) {
        wIdx++;
      } else {
        const el = this._createKey(key, true);
        el.style.position = 'absolute';
        el.style.left = `${(wIdx - 1) * 40 + 27}px`;
        el.style.width = '26px';
        keysDiv.appendChild(el);
        this.keyElements.set(key.midi, el);
      }
    });

    keysDiv.style.width = `${whiteKeys.length * 40}px`;
    keysDiv.style.position = 'relative';

    wrapper.appendChild(keysDiv);
    this.container.appendChild(wrapper);

    // Center scroll
    const centerKey = Math.floor(whiteKeys.length / 2);
    wrapper.scrollLeft = Math.max(0, centerKey * 40 - wrapper.clientWidth / 2);
  }

  _createKey(key, isBlack) {
    const el = document.createElement('div');
    el.className = `piano-key ${isBlack ? 'black' : 'white'}`;
    el.dataset.midi = key.midi;
    el.dataset.note = key.fullName;

    if (this.showLabels && !isBlack && key.name === 'C') {
      const label = document.createElement('span');
      label.className = 'key-label';
      label.textContent = key.fullName;
      el.appendChild(label);
    }

    // Touch/mouse events
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, key.midi);
      this._activateKey(key.midi);
      if (this.onNoteOn) this.onNoteOn(key.midi, 80);
    });

    el.addEventListener('pointerup', (e) => {
      this.activePointers.delete(e.pointerId);
      this._deactivateKey(key.midi);
      if (this.onNoteOff) this.onNoteOff(key.midi);
    });

    el.addEventListener('pointerleave', (e) => {
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.delete(e.pointerId);
        this._deactivateKey(key.midi);
        if (this.onNoteOff) this.onNoteOff(key.midi);
      }
    });

    return el;
  }

  _activateKey(midi) {
    const el = this.keyElements.get(midi);
    if (el) el.classList.add('active');
  }

  _deactivateKey(midi) {
    const el = this.keyElements.get(midi);
    if (el) el.classList.remove('active');
  }

  /** Highlight a key externally (e.g. from MIDI input) */
  highlight(midi, className = 'active') {
    const el = this.keyElements.get(midi);
    if (el) el.classList.add(className);
  }

  /** Remove highlight */
  unhighlight(midi, className = 'active') {
    const el = this.keyElements.get(midi);
    if (el) el.classList.remove(className);
  }

  /** Clear all highlights */
  clearHighlights() {
    this.keyElements.forEach(el => {
      el.classList.remove('active', 'correct', 'wrong', 'expected');
    });
  }

  /** Show expected notes */
  showExpected(midiNotes) {
    midiNotes.forEach(midi => this.highlight(midi, 'expected'));
  }

  destroy() {
    this.container.innerHTML = '';
    this.keyElements.clear();
  }
}
