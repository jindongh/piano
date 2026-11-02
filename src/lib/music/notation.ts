import { uid } from "@/lib/utils";
import { beatsPerBar, midiToName, nameToMidi, staffForMidi } from "./theory";
import type { ClefKind, ScoreNote, StaffId, TimeSig } from "./types";

function parseDuration(raw: string | undefined): number {
  if (!raw) return 1;
  const m = /^\/(\d+)(\.*)$/.exec(raw);
  if (!m) return 1;
  const denom = Number(m[1]);
  if (![1, 2, 4, 8, 16, 32].includes(denom)) return 1;
  let beats = 4 / denom;
  for (let i = 0; i < (m[2]?.length ?? 0); i++) beats *= 1.5;
  return beats;
}

function durationToken(beats: number): string {
  const dotted = beats / 1.5;
  const map: Record<number, string> = {
    4: "/1",
    2: "/2",
    1: "",
    0.5: "/8",
    0.25: "/16",
    0.125: "/32",
  };
  if (map[beats] !== undefined) return map[beats]!;
  if (map[dotted] !== undefined) {
    const base = map[dotted]!;
    return (base || "/4") + ".";
  }
  if (Math.abs(beats - 3) < 0.01) return "/2.";
  if (Math.abs(beats - 1.5) < 0.01) return "/4.";
  if (Math.abs(beats - 0.75) < 0.01) return "/8.";
  return "";
}

type TokenPitch =
  | { midi: number; beats: number; lyric?: string }
  | { rest: true; beats: number; lyric?: string };

function parsePitchToken(token: string): TokenPitch | null {
  const rest = /^(?:R|r)(\/\d+\.*)?(?:"([^"]*)"|\(([^)]*)\))?$/.exec(token);
  if (rest) return { rest: true, beats: parseDuration(rest[1]), lyric: rest[2] ?? rest[3] };

  const m = /^([A-G][#b]?(?:-?\d))(\/\d+\.*)?(?:"([^"]*)"|\(([^)]*)\))?$/.exec(token);
  if (!m) return null;
  const midi = nameToMidi(m[1]!);
  if (midi == null) return null;
  const lyric = m[3] ?? m[4];
  return { midi, beats: parseDuration(m[2]), lyric: lyric || undefined };
}

function withStaff(midi: number, beats: number, start: number, id: string, lyric?: string): ScoreNote {
  return { id, type: "note", midi, beats, start, staff: staffForMidi(midi, "grand"), lyric };
}

export function parseNotation(input: string, _clef: ClefKind = "grand"): ScoreNote[] {
  const tokens = input
    .replace(/\n/g, " ")
    .split(/\s+/)
    .filter((t) => t && t !== "|" && t !== "||" && t !== "/");
  const notes: ScoreNote[] = [];
  let t = 0;
  for (const raw of tokens) {
    if (raw.startsWith("[")) {
      const close = raw.indexOf("]");
      if (close < 0) continue;
      const inner = raw.slice(1, close);
      const after = raw.slice(close + 1);
      const mAfter = /^(\/\d+\.*)?(?:"([^"]*)"|\(([^)]*)\))?$/.exec(after);
      const durPart = mAfter?.[1];
      const lyric = mAfter?.[2] ?? mAfter?.[3] ?? undefined;
      const beats = parseDuration(durPart || undefined);
      const pitches = inner.split(/[,]+/).map((p) => p.trim()).filter(Boolean);
      pitches.forEach((p, idx) => {
        const midi = nameToMidi(p);
        if (midi == null) return;
        // Attach lyric to the last (typically melody/top) note in chord
        const noteLyric = idx === pitches.length - 1 ? lyric : undefined;
        notes.push(withStaff(midi, beats, t, `n${notes.length}`, noteLyric));
      });
      t += beats;
      continue;
    }
    const parsed = parsePitchToken(raw);
    if (!parsed) continue;
    if ("rest" in parsed) {
      notes.push({
        id: `n${notes.length}`,
        type: "rest",
        beats: parsed.beats,
        start: t,
        staff: _clef === "bass" ? "bass" : "treble",
        lyric: parsed.lyric,
      });
    } else {
      notes.push(withStaff(parsed.midi, parsed.beats, t, `n${notes.length}`, parsed.lyric));
    }
    t += parsed.beats;
  }
  return notes;
}

export function serializeNotation(notes: ScoreNote[], time?: TimeSig): string {
  if (!notes.length) return "";
  const bar = time ? beatsPerBar(time) : 4;
  const groups = new Map<number, ScoreNote[]>();
  const starts: number[] = [];
  for (const n of notes) {
    if (!groups.has(n.start)) {
      groups.set(n.start, []);
      starts.push(n.start);
    }
    groups.get(n.start)!.push(n);
  }
  starts.sort((a, b) => a - b);
  const tokens: string[] = [];
  let nextBar = bar;
  for (const start of starts) {
    while (start >= nextBar - 0.001) {
      tokens.push("|");
      nextBar += bar;
    }
    const g = groups.get(start)!;
    const sounding = g.filter((n) => n.type === "note" && n.midi != null);
    const rest = g.find((n) => n.type === "rest");
    const beats = g[0]?.beats ?? 1;
    const dur = durationToken(beats);
    const lyric = g.find((n) => n.lyric)?.lyric;
    const lyricStr = lyric ? `"${lyric}"` : "";

    if (sounding.length > 1) {
      const chord = sounding.map((n) => midiToName(n.midi!)).join(",");
      tokens.push(`[${chord}]${dur}${lyricStr}`);
    } else if (sounding.length === 1) {
      tokens.push(`${midiToName(sounding[0]!.midi!)}${dur}${lyricStr}`);
    } else if (rest) {
      tokens.push(`R${dur || "/4"}${lyricStr}`);
    }
  }
  return tokens.join(" ");
}

export function appendNote(
  notes: ScoreNote[],
  midi: number,
  beats: number,
  staff?: StaffId,
  lyric?: string,
): ScoreNote[] {
  const lastEnd = notes.reduce((m, n) => Math.max(m, n.start + n.beats), 0);
  return [
    ...notes,
    {
      id: uid(),
      type: "note",
      midi,
      beats,
      start: lastEnd,
      staff: staff ?? staffForMidi(midi, "grand"),
      lyric,
    },
  ];
}

export function appendRest(notes: ScoreNote[], beats: number, staff: StaffId = "treble"): ScoreNote[] {
  const lastEnd = notes.reduce((m, n) => Math.max(m, n.start + n.beats), 0);
  return [...notes, { id: uid(), type: "rest", beats, start: lastEnd, staff }];
}

export function dropLast(notes: ScoreNote[]): ScoreNote[] {
  if (!notes.length) return notes;
  const lastStart = Math.max(...notes.map((n) => n.start));
  return notes.filter((n) => n.start !== lastStart);
}

export const DURATION_PRESETS: { label: string; beats: number }[] = [
  { label: "全", beats: 4 },
  { label: "二", beats: 2 },
  { label: "四", beats: 1 },
  { label: "八", beats: 0.5 },
  { label: "十六", beats: 0.25 },
];
