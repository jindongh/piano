import { uid } from "@/lib/utils";
import { beatsPerBar, midiToName, nameToMidi } from "./theory";
import type { ScoreNote, TimeSig } from "./types";

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

type TokenPitch = { midi: number; beats: number } | { rest: true; beats: number };

function parsePitchToken(token: string): TokenPitch | null {
  const rest = /^(?:R|r)(\/\d+\.*)?$/.exec(token);
  if (rest) return { rest: true, beats: parseDuration(rest[1]) };
  const m = /^([A-G][#b]?(?:-?\d))(\/\d+\.*)?$/.exec(token);
  if (!m) return null;
  const midi = nameToMidi(m[1]!);
  if (midi == null) return null;
  return { midi, beats: parseDuration(m[2]) };
}

export function parseNotation(input: string): ScoreNote[] {
  const tokens = input.replace(/\n/g, " ").split(/\s+/).filter((t) => t && t !== "|" && t !== "||" && t !== "/");
  const notes: ScoreNote[] = [];
  let t = 0;
  for (const raw of tokens) {
    if (raw.startsWith("[")) {
      const close = raw.indexOf("]");
      if (close < 0) continue;
      const inner = raw.slice(1, close);
      const durPart = raw.slice(close + 1);
      const beats = parseDuration(durPart || undefined);
      for (const p of inner.split(/[,]+/)) {
        const midi = nameToMidi(p.trim());
        if (midi == null) continue;
        notes.push({ id: `n${notes.length}`, type: "note", midi, beats, start: t });
      }
      t += beats;
      continue;
    }
    const parsed = parsePitchToken(raw);
    if (!parsed) continue;
    if ("rest" in parsed) {
      notes.push({ id: `n${notes.length}`, type: "rest", beats: parsed.beats, start: t });
    } else {
      notes.push({ id: `n${notes.length}`, type: "note", midi: parsed.midi, beats: parsed.beats, start: t });
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
    if (sounding.length > 1) {
      tokens.push(`[${sounding.map((n) => midiToName(n.midi!)).join(",")}]${dur}`);
    } else if (sounding.length === 1) {
      tokens.push(`${midiToName(sounding[0]!.midi!)}${dur}`);
    } else if (rest) {
      tokens.push(`R${dur || "/4"}`);
    }
  }
  return tokens.join(" ");
}

export function appendNote(notes: ScoreNote[], midi: number, beats: number): ScoreNote[] {
  const lastEnd = notes.reduce((m, n) => Math.max(m, n.start + n.beats), 0);
  return [...notes, { id: uid(), type: "note", midi, beats, start: lastEnd }];
}

export function appendRest(notes: ScoreNote[], beats: number): ScoreNote[] {
  const lastEnd = notes.reduce((m, n) => Math.max(m, n.start + n.beats), 0);
  return [...notes, { id: uid(), type: "rest", beats, start: lastEnd }];
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
