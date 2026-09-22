import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Keyboard, Pause, Play, RotateCcw, Usb } from "lucide-react";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { StaffView, type NoteStatus } from "@/components/staff-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { coachPractice } from "@/lib/ai/server";
import { bindComputerKeys, bindMidi, type MidiStatus } from "@/lib/audio/input";
import { getPiano } from "@/lib/audio/piano";
import { buildReport, expectedNotes, formatDuration, type SessionReport } from "@/lib/music/scoring";
import { totalBeats } from "@/lib/music/theory";
import type { Piece, PlayedEvent, PracticeMode } from "@/lib/music/types";
import { usePiecesStore } from "@/lib/store/pieces";
import { cn } from "@/lib/utils";

type Phase = "idle" | "count" | "playing" | "paused" | "done";

export function PracticeRoom({ piece }: { piece: Piece }) {
  const recordPractice = usePiecesStore((s) => s.recordPractice);
  const expected = useMemo(() => expectedNotes(piece.notes), [piece.notes]);
  const [mode, setMode] = useState<PracticeMode>("follow");
  const [speed, setSpeed] = useState(1);
  const [metro, setMetro] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState<Set<number>>(new Set());
  const [wrongKeys, setWrongKeys] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, NoteStatus>>({});
  const [report, setReport] = useState<SessionReport | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [midi, setMidi] = useState<MidiStatus>({ supported: true, connected: [] });
  const [elapsed, setElapsed] = useState(0);

  const hitRef = useRef(0);
  const wrongRef = useRef(0);
  const eventsRef = useRef<PlayedEvent[]>([]);
  const matchedRef = useRef<Set<number>>(new Set());
  const startRef = useRef(0);
  const pauseAcc = useRef(0);
  const cursorRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const modeRef = useRef(mode);
  const speedRef = useRef(speed);
  const metroRef = useRef(metro);
  const raf = useRef(0);
  const metroId = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    modeRef.current = mode;
    cursorRef.current = cursor;
  }, [mode, cursor]);
  useEffect(() => {
    speedRef.current = speed;
    metroRef.current = metro;
  }, [speed, metro]);

  const finish = useCallback(
    (durationSec: number) => {
      window.cancelAnimationFrame(raf.current);
      window.clearInterval(metroId.current);
      getPiano().stopAll();
      const built = buildReport({
        notes: piece.notes,
        events: eventsRef.current,
        mode: modeRef.current,
        tempo: piece.tempo * speedRef.current,
        durationSec,
        followedHits: hitRef.current,
        followedWrong: wrongRef.current,
      });
      setReport(built);
      setPhase("done");
      recordPractice(piece.id, {
        at: Date.now(),
        mode: modeRef.current,
        score: built.score,
        accuracy: built.accuracy,
        grade: built.grade,
        durationSec,
        wrongPitches: built.weakNotes.map((w) => w.midi),
      });
      void coachPractice({
        data: {
          title: piece.title,
          composer: piece.composer,
          score: built.score,
          accuracy: built.accuracy,
          timing: built.timing,
          mode: modeRef.current,
          weakNotes: built.weakNotes.map((w) => w.name),
          tips: built.tips,
        },
      }).then((r) => {
        if (r.ok && r.summary) setCoach(r.summary);
        if (r.ok && r.tips.length) {
          setReport((prev) => (prev ? { ...prev, tips: r.tips } : prev));
        }
      });
    },
    [piece, recordPractice],
  );

  const reset = useCallback(() => {
    window.cancelAnimationFrame(raf.current);
    window.clearInterval(metroId.current);
    getPiano().stopAll();
    hitRef.current = 0;
    wrongRef.current = 0;
    eventsRef.current = [];
    matchedRef.current = new Set();
    cursorRef.current = 0;
    pauseAcc.current = 0;
    setCursor(0);
    setStatuses({});
    setReport(null);
    setCoach(null);
    setElapsed(0);
    setWrongKeys(new Set());
    setPhase("idle");
  }, []);

  const tickPerform = useCallback(() => {
    const now = performance.now();
    const t = (now - startRef.current) / 1000;
    setElapsed(t);
    const bps = (piece.tempo * speedRef.current) / 60;
    const beat = t * bps;
    const total = totalBeats(piece.notes);
    let next = expected.findIndex((n, i) => !matchedRef.current.has(i) && n.start + n.beats > beat - 0.05);
    if (next < 0) next = expected.length;
    if (next !== cursorRef.current) {
      cursorRef.current = next;
      setCursor(next);
      const cur = expected[next];
      if (cur) setStatuses((s) => ({ ...s, [cur.id]: "current" }));
    }
    if (beat > total + 0.6) {
      finish(t);
      return;
    }
    raf.current = window.requestAnimationFrame(tickPerform);
  }, [expected, finish, piece.notes, piece.tempo]);

  function startMetronome() {
    window.clearInterval(metroId.current);
    if (!metroRef.current) return;
    const interval = (60 / (piece.tempo * speedRef.current)) * 1000;
    let beat = 0;
    const click = () => {
      getPiano().click(beat % piece.timeSignature.num === 0);
      beat++;
    };
    click();
    metroId.current = window.setInterval(click, interval);
  }

  async function beginPlay() {
    await getPiano().resume();
    startRef.current = performance.now() - pauseAcc.current * 1000;
    setPhase("playing");
    startMetronome();
    if (modeRef.current === "perform") {
      raf.current = window.requestAnimationFrame(tickPerform);
    } else {
      const first = expected[0];
      if (first) {
        const start = first.start;
        const groupIds = expected.filter((n) => Math.abs(n.start - start) <= 0.02).map((n) => n.id);
        setStatuses(Object.fromEntries(groupIds.map((id) => [id, "current" as const])));
      }
    }
  }

  async function start() {
    await getPiano().resume();
    reset();
    setPhase("count");
    setCount(3);
    let n = 3;
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(id);
        void beginPlay();
      } else setCount(n);
    }, 700);
  }

  function pause() {
    if (phase !== "playing") return;
    pauseAcc.current = (performance.now() - startRef.current) / 1000;
    window.cancelAnimationFrame(raf.current);
    window.clearInterval(metroId.current);
    getPiano().stopAll();
    setPhase("paused");
  }

  const onDown = useCallback(
    (midi: number, velocity = 0.85) => {
      void getPiano().resume().then(() => getPiano().noteOn(midi, velocity));
      setActive((s) => new Set(s).add(midi));
      if (phaseRef.current !== "playing") return;
      const t = performance.now() - startRef.current;

      if (modeRef.current === "follow") {
        const matched = matchedRef.current;
        let i = 0;
        while (i < expected.length && matched.has(i)) i++;
        if (i >= expected.length) return;
        const start = expected[i]!.start;
        const group: number[] = [];
        for (let j = i; j < expected.length; j++) {
          if (Math.abs((expected[j]!.start ?? 0) - start) > 0.02) break;
          if (!matched.has(j)) group.push(j);
        }
        const hitIdx = group.find((j) => expected[j]!.midi === midi);
        if (hitIdx != null) {
          matched.add(hitIdx);
          hitRef.current += 1;
          eventsRef.current.push({ midi, atMs: t, expectedIndex: hitIdx, status: "hit" });
          const hitNote = expected[hitIdx]!;
          const leftover = group.filter((j) => j !== hitIdx);
          setStatuses((s) => {
            const next = { ...s, [hitNote.id]: "ok" as const };
            leftover.forEach((j) => {
              next[expected[j]!.id] = "current";
            });
            if (leftover.length === 0) {
              let n = 0;
              while (n < expected.length && matched.has(n)) n++;
              if (n < expected.length) {
                const st = expected[n]!.start;
                for (let k = n; k < expected.length; k++) {
                  if (Math.abs(expected[k]!.start - st) > 0.02) break;
                  next[expected[k]!.id] = "current";
                }
              }
            }
            return next;
          });
          if (leftover.length === 0) {
            let n = 0;
            while (n < expected.length && matched.has(n)) n++;
            cursorRef.current = n;
            setCursor(n);
            if (n >= expected.length) finish(t / 1000);
          }
        } else {
          wrongRef.current += 1;
          eventsRef.current.push({ midi, atMs: t, status: "wrong" });
          setWrongKeys(new Set([midi]));
          window.setTimeout(() => setWrongKeys(new Set()), 180);
        }
        return;
      }

      const bps = (piece.tempo * speedRef.current) / 60;
      const beat = t / 1000 * bps;
      const windowBeats = 0.45;
      let best = -1;
      let bestDist = 99;
      expected.forEach((n, i) => {
        if (matchedRef.current.has(i) || n.midi !== midi) return;
        const d = Math.abs(n.start - beat);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      if (best >= 0 && bestDist <= windowBeats) {
        matchedRef.current.add(best);
        eventsRef.current.push({ midi, atMs: t, expectedIndex: best, status: "hit" });
        const n = expected[best]!;
        setStatuses((s) => ({ ...s, [n.id]: "ok" }));
        hitRef.current += 1;
      } else {
        eventsRef.current.push({ midi, atMs: t, status: best >= 0 ? "wrong" : "extra" });
        wrongRef.current += 1;
        setWrongKeys(new Set([midi]));
        window.setTimeout(() => setWrongKeys(new Set()), 180);
      }
    },
    [expected, finish, piece.tempo],
  );

  const onUp = useCallback((midi: number) => {
    getPiano().noteOff(midi);
    setActive((s) => {
      const n = new Set(s);
      n.delete(midi);
      return n;
    });
  }, []);

  useEffect(() => {
    const stopKeys = bindComputerKeys({ onDown, onUp });
    return () => {
      stopKeys();
      window.cancelAnimationFrame(raf.current);
      window.clearInterval(metroId.current);
    };
  }, [onDown, onUp]);

  async function connectMidi() {
    const { status, stop } = await bindMidi({ onDown, onUp });
    setMidi(status);
    return stop;
  }

  const hitCount = Object.values(statuses).filter((s) => s === "ok").length;
  const progress = expected.length === 0 ? 0 : Math.min(100, (hitCount / expected.length) * 100);
  const expectedMidis = (() => {
    if (phase !== "playing" || mode !== "follow") return null;
    const matched = matchedRef.current;
    let i = 0;
    while (i < expected.length && matched.has(i)) i++;
    if (i >= expected.length) return null;
    const start = expected[i]!.start;
    const set = new Set<number>();
    for (let j = i; j < expected.length; j++) {
      if (Math.abs(expected[j]!.start - start) > 0.02) break;
      if (!matched.has(j) && expected[j]!.midi != null) set.add(expected[j]!.midi!);
    }
    return set;
  })();
  const sounding = expected.map((n) => n.midi).filter((m): m is number => m != null);
  const lo = sounding.length ? Math.min(...sounding) : 48;
  const hi = sounding.length ? Math.max(...sounding) : 84;
  const kbStart = Math.max(36, lo - (lo % 12));
  const kbEnd = Math.min(96, Math.max(hi + 1, kbStart + 24));

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="返回">
            <Link to="/p/$id" params={{ id: piece.id }}>
              <ChevronLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg font-medium tracking-tight">{piece.title}</h1>
            <p className="text-xs text-muted">{piece.composer}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="paper" className="hidden sm:inline-flex">
            <Keyboard className="mr-1 size-3" />
            A–L 弹奏
          </Badge>
          {midi.connected.length > 0 && (
            <Badge variant="success">
              <Usb className="mr-1 size-3" />
              {midi.connected[0]}
            </Badge>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-3 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {(["follow", "perform"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={phase === "playing" || phase === "count"}
              onClick={() => setMode(m)}
              className={cn(
                "h-10 rounded-md px-3 text-sm font-medium",
                mode === m ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
              )}
            >
              {m === "follow" ? "跟弹" : "演奏"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMetro((v) => !v)}
            className={cn(
              "h-10 rounded-md px-3 text-sm",
              metro ? "bg-elevated text-fg" : "bg-elevated text-subtle",
            )}
          >
            节拍器 {metro ? "开" : "关"}
          </button>
          <div className="flex min-w-36 flex-1 items-center gap-2 sm:max-w-xs">
            <span className="text-xs text-muted tabular-nums">{Math.round(speed * 100)}%</span>
            <Slider
              min={0.5}
              max={1.2}
              step={0.05}
              value={[speed]}
              disabled={phase === "playing"}
              onValueChange={(v) => setSpeed(v[0] ?? 1)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void connectMidi()}>
            <Usb className="size-3.5" />
            MIDI
          </Button>
        </div>

        <div className="relative">
          <StaffView
            notes={piece.notes}
            timeSignature={piece.timeSignature}
            keySignature={piece.key}
            clef={piece.clef ?? "treble"}
            cursorIndex={phase === "playing" || phase === "paused" ? cursor : undefined}
            statuses={statuses}
          />
          {phase === "count" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-paper/70">
              <span className="font-display text-7xl font-medium text-paper-fg tabular-nums">{count}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1" />
          <span className="text-xs text-muted tabular-nums">
            {Math.min(hitCount, expected.length)}/{expected.length}
            {phase === "playing" && mode === "perform" ? ` · ${formatDuration(elapsed)}` : ""}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {phase === "idle" || phase === "done" ? (
            <Button onClick={() => void start()}>
              <Play className="size-4" />
              开始
            </Button>
          ) : phase === "paused" ? (
            <Button onClick={() => void beginPlay()}>
              <Play className="size-4" />
              继续
            </Button>
          ) : phase === "playing" ? (
            <Button variant="secondary" onClick={pause}>
              <Pause className="size-4" />
              暂停
            </Button>
          ) : null}
          <Button variant="ghost" onClick={reset}>
            <RotateCcw className="size-4" />
            重来
          </Button>
        </div>

        {report && phase === "done" && (
          <div className="stagger-in rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs tracking-wide text-muted">本课评分</p>
                <p className="font-display text-6xl font-medium leading-none tracking-tight">{report.grade}</p>
              </div>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <Stat label="总分" value={report.score} />
                <Stat label="准确" value={`${report.accuracy}%`} />
                <Stat label="节奏" value={`${report.timing}%`} />
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">
              命中 {report.hit} · 错音 {report.wrong} · 漏音 {report.missed}
              {report.extra ? ` · 多余 ${report.extra}` : ""}
            </p>
            {coach && <p className="mt-3 font-serif text-base text-fg">{coach}</p>}
            <ul className="mt-3 space-y-1.5">
              {report.tips.map((t) => (
                <li key={t} className="text-sm text-muted">
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void start()}>再练一次</Button>
              <Button asChild variant="secondary">
                <Link to="/">返回曲库</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-bg/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto max-w-6xl overflow-x-auto">
          <PianoKeyboard
            startMidi={kbStart}
            endMidi={kbEnd}
            active={active}
            expected={expectedMidis}
            wrong={wrongKeys}
            onDown={(m) => onDown(m)}
            onUp={onUp}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
