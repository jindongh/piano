// Music note utilities — convert between MIDI numbers, note names, and frequencies

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B', 'E#': 'F', 'B#': 'C' };

/**
 * Parse a note name like "C4", "F#3", "Bb5" and return { name, octave, midi }
 */
export function parseNote(noteStr) {
  if (typeof noteStr === 'number') return midiToNote(noteStr);
  const match = noteStr.match(/^([A-Ga-g][#b]?)(\d+)$/);
  if (!match) return null;
  let name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2]);
  if (ENHARMONIC[name]) name = ENHARMONIC[name];
  const noteIndex = NOTE_NAMES.indexOf(name);
  if (noteIndex === -1) return null;
  const midi = (octave + 1) * 12 + noteIndex;
  return { name, octave, midi, fullName: `${name}${octave}` };
}

/**
 * Convert MIDI number to note info
 */
export function midiToNote(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const name = NOTE_NAMES[noteIndex];
  return { name, octave, midi, fullName: `${name}${octave}` };
}

/**
 * Convert MIDI number to frequency (A4 = 440Hz)
 */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Check if a note name represents a black key
 */
export function isBlackKey(noteNameOrMidi) {
  const midi = typeof noteNameOrMidi === 'number' ? noteNameOrMidi : parseNote(noteNameOrMidi)?.midi;
  if (midi == null) return false;
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

/**
 * Duration name to beat fraction
 */
export function durationToBeats(duration) {
  const map = {
    'whole': 4, 'half': 2, 'quarter': 1, 'eighth': 0.5,
    '16th': 0.25, '32nd': 0.125, 'dotted-half': 3,
    'dotted-quarter': 1.5, 'dotted-eighth': 0.75
  };
  return map[duration] || 1;
}

/**
 * Convert beats to seconds given a tempo (BPM)
 */
export function beatsToSeconds(beats, bpm) {
  return (beats / bpm) * 60;
}

/**
 * Generate piano key range
 */
export function generateKeyRange(startMidi = 36, endMidi = 96) {
  const keys = [];
  for (let midi = startMidi; midi <= endMidi; midi++) {
    const note = midiToNote(midi);
    keys.push({ ...note, isBlack: isBlackKey(midi) });
  }
  return keys;
}

export { NOTE_NAMES };
