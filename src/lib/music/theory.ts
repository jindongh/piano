import type { ClefKind, StaffId } from "./types";

const SEMI: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const STEP_TO_PC = [0, 2, 4, 5, 7, 9, 11];
const PC_TO_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const PC_ACC = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const KEYS = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "F",
  "Bb",
  "Eb",
  "Am",
  "Em",
  "Dm",
  "Gm",
] as const;

export type KeyName = (typeof KEYS)[number];

export const CLEFS: { id: ClefKind; label: string }[] = [
  { id: "treble", label: "高音谱号" },
  { id: "bass", label: "低音谱号" },
  { id: "grand", label: "大谱表" },
];

/** Treble: F5…E4; bass: A3…G2. */
export const STAFF_RANGE = {
  treble: { topStep: 38, botStep: 30, midStep: 34, sharp: [38, 35, 39, 36, 33, 37, 34], flat: [34, 37, 33, 36, 32, 35, 31] },
  bass: { topStep: 26, botStep: 18, midStep: 22, sharp: [24, 28, 25, 29, 26, 30, 27], flat: [27, 23, 26, 22, 25, 21, 24] },
} as const;

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"] as const;
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"] as const;

const KEY_ACCIDENTALS: Record<string, { kind: "#" | "b"; count: number }> = {
  C: { kind: "#", count: 0 },
  Am: { kind: "#", count: 0 },
  G: { kind: "#", count: 1 },
  Em: { kind: "#", count: 1 },
  D: { kind: "#", count: 2 },
  Bm: { kind: "#", count: 2 },
  A: { kind: "#", count: 3 },
  F: { kind: "b", count: 1 },
  Dm: { kind: "b", count: 1 },
  Bb: { kind: "b", count: 2 },
  Gm: { kind: "b", count: 2 },
  Eb: { kind: "b", count: 3 },
  E: { kind: "#", count: 4 },
};

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

export function nameToMidi(name: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const letter = m[1]!;
  const acc = m[2];
  const oct = Number(m[3]);
  let midi = (oct + 1) * 12 + SEMI[letter]!;
  if (acc === "#") midi += 1;
  if (acc === "b") midi -= 1;
  return midi;
}

export function midiToDiatonic(midi: number) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return { step: oct * 7 + PC_TO_STEP[pc]!, accidental: PC_ACC[pc]! };
}

export function diatonicToMidi(step: number, accidental = 0) {
  const oct = Math.floor(step / 7);
  const deg = ((step % 7) + 7) % 7;
  return (oct + 1) * 12 + STEP_TO_PC[deg]! + accidental;
}

export function keyAccidentals(key: string): { kind: "#" | "b"; letters: string[] } {
  const info = KEY_ACCIDENTALS[key] ?? { kind: "#" as const, count: 0 };
  const order = info.kind === "#" ? SHARP_ORDER : FLAT_ORDER;
  return { kind: info.kind, letters: order.slice(0, info.count).map(String) };
}

export function pitchInKey(midi: number, key: string): { step: number; accidental: 0 | 1 | -1 | 2 | -2 } {
  const { step, accidental } = midiToDiatonic(midi);
  const { kind, letters } = keyAccidentals(key);
  const letter = "CDEFGAB"[((step % 7) + 7) % 7]!;
  const keyHas = letters.includes(letter);
  if (kind === "#" && keyHas) {
    if (accidental === 1) return { step, accidental: 0 };
    if (accidental === 0) return { step, accidental: -1 };
  }
  if (kind === "b" && keyHas) {
    const pc = ((midi % 12) + 12) % 12;
    const naturalPc = STEP_TO_PC[((step % 7) + 7) % 7]!;
    const written = pc - naturalPc;
    if (written === -1) return { step, accidental: 0 };
    if (written === 0) return { step, accidental: 1 };
  }
  return { step, accidental: accidental as 0 | 1 };
}

export function beatsPerBar(time: { num: number; den: number }) {
  return time.num * (4 / time.den);
}

export function totalBeats(notes: { start: number; beats: number }[]) {
  if (!notes.length) return 0;
  return Math.max(...notes.map((n) => n.start + n.beats));
}

export function isBlackKey(midi: number) {
  const pc = ((midi % 12) + 12) % 12;
  return [1, 3, 6, 8, 10].includes(pc);
}

export function whiteKeyIndex(midi: number) {
  let count = 0;
  for (let m = 12; m < midi; m++) {
    if (!isBlackKey(m)) count++;
  }
  return count;
}

export function staffForMidi(midi: number, clef: ClefKind = "grand"): StaffId {
  if (clef === "treble") return "treble";
  if (clef === "bass") return "bass";
  return midi >= 60 ? "treble" : "bass";
}

export function inferClef(notes: { midi?: number; type: string }[]): ClefKind {
  const sounding = notes.filter((n) => n.type === "note" && n.midi != null).map((n) => n.midi!);
  if (!sounding.length) return "grand";
  const hasHigh = sounding.some((m) => m >= 60);
  const hasLow = sounding.some((m) => m < 60);
  if (hasHigh && hasLow) return "grand";
  if (hasLow) return "bass";
  return "treble";
}

export const COMPUTER_KEY_MAP: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
  o: 73,
  l: 74,
  p: 75,
  ";": 76,
  "'": 77,
};

export const HINT_FOR_MIDI: Record<number, string> = Object.fromEntries(
  Object.entries(COMPUTER_KEY_MAP).map(([k, v]) => [v, k.toUpperCase()]),
);

export function gradeFromScore(score: number): "S" | "A" | "B" | "C" | "D" {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}
