import assert from "node:assert/strict";
import { test } from "node:test";
import { holdsToNotes, parseMidiFile, quantizeBeats } from "./midi-capture.ts";

function vlq(n: number): number[] {
  if (n === 0) return [0];
  const bytes: number[] = [];
  bytes.unshift(n & 0x7f);
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
}

function u32(n: number) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function track(events: number[]) {
  const body = [...events, 0, 0xff, 0x2f, 0];
  return [0x4d, 0x54, 0x72, 0x6b, ...u32(body.length), ...body];
}

function smf(tracks: number[][], format = 0, tpq = 96) {
  const n = tracks.length;
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, (n >> 8) & 0xff, n & 0xff, (tpq >> 8) & 0xff, tpq & 0xff];
  return new Uint8Array([...header, ...tracks.flat()]).buffer;
}

test("quantizeBeats snaps to the grid", () => {
  assert.equal(quantizeBeats(0.5, 120, 0.25), 1);
  assert.equal(quantizeBeats(0.12, 120, 0.25), 0.25);
});

test("holdsToNotes builds a two-hand chord", () => {
  const notes = holdsToNotes(
    [
      { midi: 48, onMs: 0, offMs: 500 },
      { midi: 60, onMs: 0, offMs: 500 },
    ],
    120,
    0.25,
  );
  assert.equal(notes.length, 2);
  assert.equal(notes[0]!.staff, "bass");
  assert.equal(notes[1]!.staff, "treble");
  assert.equal(notes[0]!.start, notes[1]!.start);
});

test("parseMidiFile reads format 0 quarters at 120bpm", () => {
  const tpq = 96;
  const events = [
    ...vlq(0),
    0xff,
    0x51,
    0x03,
    0x07,
    0xa1,
    0x20, // 500_000 µs
    ...vlq(0),
    0x90,
    60,
    80,
    ...vlq(tpq),
    0x80,
    60,
    0,
    ...vlq(0),
    0x90,
    64,
    80,
    ...vlq(tpq),
    0x80,
    64,
    0,
  ];
  const parsed = parseMidiFile(smf([track(events)]));
  if ("error" in parsed) throw new Error(parsed.error);
  assert.equal(parsed.tempo, 120);
  assert.equal(parsed.notes.length, 2);
  assert.equal(parsed.notes[0]!.midi, 60);
  assert.equal(parsed.notes[1]!.midi, 64);
  assert.equal(parsed.notes[0]!.start, 0);
  assert.equal(parsed.notes[1]!.start, 1);
  assert.equal(parsed.notes[0]!.beats, 1);
});

test("parseMidiFile format 1 uses tempo from track 0", () => {
  const tpq = 96;
  const tempoTrack = [...vlq(0), 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20];
  const noteTrack = [...vlq(0), 0x90, 48, 90, ...vlq(tpq * 2), 0x80, 48, 0];
  const parsed = parseMidiFile(smf([track(tempoTrack), track(noteTrack)], 1, tpq));
  if ("error" in parsed) throw new Error(parsed.error);
  assert.equal(parsed.tempo, 120);
  assert.equal(parsed.notes[0]!.midi, 48);
  assert.equal(parsed.notes[0]!.staff, "bass");
  assert.equal(parsed.notes[0]!.beats, 2);
});

test("parseMidiFile rejects garbage", () => {
  const parsed = parseMidiFile(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]).buffer);
  assert.ok("error" in parsed);
});
