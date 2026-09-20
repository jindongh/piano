import { gradeFromScore, midiToName } from "./theory";
import type { Grade, PlayedEvent, PracticeMode, ScoreNote } from "./types";

export type SessionReport = {
  score: number;
  accuracy: number;
  timing: number;
  grade: Grade;
  hit: number;
  missed: number;
  wrong: number;
  extra: number;
  total: number;
  weakNotes: { name: string; midi: number; misses: number }[];
  tips: string[];
};

export function expectedNotes(notes: ScoreNote[]) {
  return notes.filter((n) => n.type === "note" && n.midi != null);
}

export function buildReport(opts: {
  notes: ScoreNote[];
  events: PlayedEvent[];
  mode: PracticeMode;
  tempo: number;
  durationSec: number;
  followedHits?: number;
  followedWrong?: number;
}): SessionReport {
  const expected = expectedNotes(opts.notes);
  const total = expected.length || 1;
  const hits = opts.events.filter((e) => e.status === "hit");
  const wrongs = opts.events.filter((e) => e.status === "wrong");
  const extras = opts.events.filter((e) => e.status === "extra");

  let hit = hits.length;
  let wrong = wrongs.length;
  if (opts.mode === "follow") {
    hit = opts.followedHits ?? hit;
    wrong = opts.followedWrong ?? wrong;
  }

  const missed = Math.max(0, expected.length - hit);
  const accuracy = Math.max(0, Math.min(100, (hit / total) * 100));

  let timing = 100;
  if (opts.mode === "perform" && hits.length) {
    const bps = opts.tempo / 60;
    const errors: number[] = [];
    for (const e of hits) {
      if (e.expectedIndex == null) continue;
      const n = expected[e.expectedIndex];
      if (!n) continue;
      const expectedMs = (n.start / bps) * 1000;
      errors.push(Math.abs(e.atMs - expectedMs));
    }
    const avg = errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : 0;
    timing = Math.max(0, 100 - avg / 8);
  }

  const fluencyPenalty = Math.min(35, wrong * 4 + extras.length * 2 + missed * 6);
  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        opts.mode === "follow"
          ? accuracy * 0.8 + Math.max(0, 100 - fluencyPenalty) * 0.2
          : accuracy * 0.55 + timing * 0.3 + Math.max(0, 100 - extras.length * 4) * 0.15,
      ),
    ),
  );

  const missCount = new Map<number, number>();
  if (opts.mode === "follow") {
    for (const e of wrongs) missCount.set(e.midi, (missCount.get(e.midi) ?? 0) + 1);
  } else {
    const hitSet = new Set(hits.map((h) => h.expectedIndex));
    expected.forEach((n, i) => {
      if (!hitSet.has(i) && n.midi != null) {
        missCount.set(n.midi, (missCount.get(n.midi) ?? 0) + 1);
      }
    });
  }
  const weakNotes = [...missCount.entries()]
    .map(([midi, misses]) => ({ midi, name: midiToName(midi), misses }))
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 4);

  const tips = localTips({
    mode: opts.mode,
    accuracy,
    timing,
    missed,
    wrong,
    weakNotes,
    tempo: opts.tempo,
  });

  return {
    score,
    accuracy: Math.round(accuracy),
    timing: Math.round(timing),
    grade: gradeFromScore(score),
    hit,
    missed,
    wrong,
    extra: extras.length,
    total: expected.length,
    weakNotes,
    tips,
  };
}

function localTips(p: {
  mode: PracticeMode;
  accuracy: number;
  timing: number;
  missed: number;
  wrong: number;
  tempo: number;
  weakNotes: { name: string; misses: number }[];
}): string[] {
  const tips: string[] = [];
  if (p.accuracy < 70) {
    tips.push("先把速度降到 60–70%，用「跟弹」把每个音看清楚再下键。");
  }
  if (p.wrong > 4) {
    tips.push("错音偏多：弹下去之前在心里默念音名，确认指法再出手。");
  }
  if (p.mode === "perform" && p.timing < 75) {
    tips.push("节奏不稳。打开节拍器，只打拍子唱谱，再动手。");
  }
  if (p.weakNotes.length) {
    tips.push(`反复单独练 ${p.weakNotes.map((w) => w.name).join("、")}，左右手分开、慢速三遍。`);
  }
  if (p.accuracy >= 90 && p.mode === "follow") {
    tips.push("音已经很准了。切到「演奏」模式，把节拍练稳。");
  }
  if (p.accuracy >= 90 && p.timing >= 85) {
    tips.push("完成度很高。试着把速度提高 8–10 BPM，保持放松的手腕。");
  }
  if (!tips.length) {
    tips.push("继续保持慢练习惯：正确比速度更重要。");
  }
  return tips.slice(0, 4);
}

export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
