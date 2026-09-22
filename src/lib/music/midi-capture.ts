import { uid } from "../utils.ts";
import { staffForMidi } from "./theory.ts";
import type { ScoreNote } from "./types";

export type MidiHold = {
  midi: number;
  onMs: number;
  offMs: number;
};

export function quantizeBeats(sec: number, tempo: number, grid: number) {
  const beats = sec * (tempo / 60);
  const q = Math.round(beats / grid) * grid;
  return Math.max(0, Number(q.toFixed(4)));
}

export function holdsToNotes(holds: MidiHold[], tempo: number, grid = 0.25): ScoreNote[] {
  if (!holds.length) return [];
  const raw = holds
    .map((h) => {
      const start = quantizeBeats(h.onMs / 1000, tempo, grid);
      const end = quantizeBeats(h.offMs / 1000, tempo, grid);
      const beats = Math.max(grid, Number((end - start).toFixed(4)));
      return { midi: h.midi, start, beats };
    })
    .filter((n) => n.beats > 0)
    .sort((a, b) => a.start - b.start || a.midi - b.midi);

  return raw.map((n) => ({
    id: uid(),
    type: "note" as const,
    midi: n.midi,
    start: n.start,
    beats: n.beats,
    staff: staffForMidi(n.midi, "grand"),
  }));
}

type RawEv =
  | { tick: number; kind: "tempo"; us: number }
  | { tick: number; kind: "on"; midi: number }
  | { tick: number; kind: "off"; midi: number };

function ticksToMs(tick: number, tempoMap: { tick: number; us: number }[], tpq: number) {
  let ms = 0;
  let last = 0;
  let us = 500_000;
  for (const p of tempoMap) {
    if (p.tick >= tick) break;
    if (p.tick > last) {
      ms += ((p.tick - last) / tpq) * (us / 1000);
      last = p.tick;
    }
    us = p.us;
  }
  if (tick > last) ms += ((tick - last) / tpq) * (us / 1000);
  return ms;
}

/** Minimal Standard MIDI File (format 0/1) → notes. */
export function parseMidiFile(buffer: ArrayBuffer): { notes: ScoreNote[]; tempo: number } | { error: string } {
  const data = new Uint8Array(buffer);
  if (data.length < 14) return { error: "MIDI 文件太短" };
  const text = (i: number, n: number) => String.fromCharCode(...data.slice(i, i + n));
  if (text(0, 4) !== "MThd") return { error: "不是有效的 MIDI 文件" };

  const view = new DataView(buffer);
  const headerLen = view.getUint32(4);
  const format = view.getUint16(8);
  const ntrks = view.getUint16(10);
  const division = view.getUint16(12);
  if (format > 1) return { error: "暂不支持这种 MIDI 格式" };
  if (division & 0x8000) return { error: "暂不支持 SMPTE 时基" };
  const tpq = division || 96;

  const events: RawEv[] = [];
  let offset = 8 + headerLen;

  const readVar = (o: { i: number }) => {
    let v = 0;
    for (;;) {
      if (o.i >= data.length) return v;
      const b = data[o.i++]!;
      v = (v << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return v;
    }
  };

  for (let t = 0; t < ntrks && offset + 8 <= data.length; t++) {
    if (text(offset, 4) !== "MTrk") break;
    const len = view.getUint32(offset + 4);
    const start = offset + 8;
    const end = Math.min(data.length, start + len);
    const o = { i: start };
    let tick = 0;
    let running = 0;

    while (o.i < end) {
      tick += readVar(o);
      if (o.i >= end) break;
      let status = data[o.i]!;
      if (status < 0x80) {
        status = running;
      } else {
        o.i++;
        if (status < 0xf0) running = status;
      }
      const type = status & 0xf0;
      if (status === 0xff) {
        const meta = data[o.i++]!;
        const mlen = readVar(o);
        if (meta === 0x51 && mlen === 3) {
          const us = (data[o.i]! << 16) | (data[o.i + 1]! << 8) | data[o.i + 2]!;
          events.push({ tick, kind: "tempo", us });
        }
        o.i += mlen;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const slen = readVar(o);
        o.i += slen;
        continue;
      }
      if (type === 0x90 || type === 0x80) {
        const note = data[o.i++]!;
        const vel = data[o.i++] ?? 0;
        const on = type === 0x90 && vel > 0;
        events.push({ tick, kind: on ? "on" : "off", midi: note });
        continue;
      }
      if (type === 0xc0 || type === 0xd0) {
        o.i += 1;
        continue;
      }
      o.i += 2;
    }
    offset = end;
  }

  const tempoMap = events
    .filter((e): e is Extract<RawEv, { kind: "tempo" }> => e.kind === "tempo")
    .sort((a, b) => a.tick - b.tick)
    .map((e) => ({ tick: e.tick, us: e.us }));
  if (!tempoMap.length || tempoMap[0]!.tick !== 0) tempoMap.unshift({ tick: 0, us: 500_000 });

  const pending = new Map<number, number[]>();
  const rawHolds: { midi: number; onTick: number; offTick: number }[] = [];
  const timed = events
    .filter((e): e is Extract<RawEv, { kind: "on" | "off" }> => e.kind === "on" || e.kind === "off")
    .sort((a, b) => a.tick - b.tick || (a.kind === "off" ? -1 : 1));

  for (const ev of timed) {
    if (ev.kind === "on") {
      const q = pending.get(ev.midi) ?? [];
      q.push(ev.tick);
      pending.set(ev.midi, q);
    } else {
      const q = pending.get(ev.midi);
      const onTick = q?.shift();
      if (onTick != null) rawHolds.push({ midi: ev.midi, onTick, offTick: Math.max(onTick + 1, ev.tick) });
    }
  }
  for (const [midi, q] of pending) {
    for (const onTick of q) rawHolds.push({ midi, onTick, offTick: onTick + Math.max(1, tpq / 4) });
  }

  if (!rawHolds.length) return { error: "文件里没有音符" };

  const holds: MidiHold[] = rawHolds.map((h) => ({
    midi: h.midi,
    onMs: ticksToMs(h.onTick, tempoMap, tpq),
    offMs: Math.max(ticksToMs(h.offTick, tempoMap, tpq), ticksToMs(h.onTick, tempoMap, tpq) + 40),
  }));

  const lastUs = tempoMap[tempoMap.length - 1]!.us || 500_000;
  const tempo = Math.round(60_000_000 / lastUs);
  const notes = holdsToNotes(holds, tempo, 0.25);
  return { notes, tempo: Math.max(40, Math.min(200, tempo)) };
}
