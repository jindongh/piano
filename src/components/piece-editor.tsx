import { useEffect, useRef, useState, type ReactNode } from "react";
import { Circle, Pause, Play, Square, Trash2, Undo, Usb } from "lucide-react";
import { toast } from "sonner";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { StaffView } from "@/components/staff-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { bindComputerKeys, bindMidi, type MidiStatus } from "@/lib/audio/input";
import { getPiano } from "@/lib/audio/piano";
import {
  alignLyricsToNotes,
  clearLyricsFromNotes,
  extractLyricsFromNotes,
  getMelodyNotes,
  tokenizeLyrics,
} from "@/lib/music/lyrics";
import { holdsToNotes, type MidiHold } from "@/lib/music/midi-capture";
import {
  DURATION_PRESETS,
  appendNote,
  appendRest,
  dropLast,
  parseNotation,
  serializeNotation,
} from "@/lib/music/notation";
import { CLEFS, KEYS, inferClef, midiToName, staffForMidi, totalBeats } from "@/lib/music/theory";
import type { ClefKind, Piece, PieceSource, ScoreNote, StaffId, TimeSig } from "@/lib/music/types";
import { cn } from "@/lib/utils";

export type Draft = {
  title: string;
  composer: string;
  key: string;
  timeSignature: TimeSig;
  tempo: number;
  notation: string;
  notes: ScoreNote[];
  imageThumb?: string;
  source: PieceSource;
  clef: ClefKind;
  lyricsText?: string;
};

export function emptyDraft(partial?: Partial<Draft>): Draft {
  return {
    title: "",
    composer: "",
    key: "C",
    timeSignature: { num: 4, den: 4 },
    tempo: 90,
    notation: "",
    notes: [],
    source: "editor",
    clef: "grand",
    lyricsText: "",
    ...partial,
  };
}

export function pieceToDraft(p: Piece): Draft {
  return {
    title: p.title,
    composer: p.composer,
    key: p.key,
    timeSignature: p.timeSignature,
    tempo: p.tempo,
    notation: p.notation,
    notes: p.notes,
    imageThumb: p.imageThumb,
    source: p.source,
    clef: p.clef ?? "treble",
    lyricsText: p.lyricsText || extractLyricsFromNotes(p.notes),
  };
}

const TIMES: TimeSig[] = [
  { num: 4, den: 4 },
  { num: 3, den: 4 },
  { num: 2, den: 4 },
  { num: 6, den: 8 },
  { num: 3, den: 8 },
];

const GRIDS: { label: string; beats: number }[] = [
  { label: "四", beats: 1 },
  { label: "八", beats: 0.5 },
  { label: "十六", beats: 0.25 },
];

export function PieceEditor({
  draft,
  onChange,
  onSave,
  saveLabel = "保存曲谱",
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  saveLabel?: string;
}) {
  const [beats, setBeats] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<Set<number>>(new Set());
  const [undo, setUndo] = useState<ScoreNote[][]>([]);
  const [midi, setMidi] = useState<MidiStatus>({ supported: true, connected: [] });
  const [recPhase, setRecPhase] = useState<"idle" | "count" | "rec">("idle");
  const [count, setCount] = useState(0);
  const [grid, setGrid] = useState(0.25);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [lyricsInput, setLyricsInput] = useState(() => draft.lyricsText || extractLyricsFromNotes(draft.notes));

  const draftRef = useRef(draft);
  const beatsRef = useRef(beats);
  const onChangeRef = useRef(onChange);
  const recPhaseRef = useRef(recPhase);
  const recStartRef = useRef(0);
  const liveRef = useRef(new Map<number, number>());
  const holdsRef = useRef<MidiHold[]>([]);
  const metroId = useRef(0);
  const gridRef = useRef(grid);
  draftRef.current = draft;
  beatsRef.current = beats;
  onChangeRef.current = onChange;
  recPhaseRef.current = recPhase;
  gridRef.current = grid;

  useEffect(() => {
    if (draft.lyricsText != null) {
      setLyricsInput(draft.lyricsText);
    } else {
      const extracted = extractLyricsFromNotes(draft.notes);
      if (extracted) setLyricsInput(extracted);
    }
  }, [draft.lyricsText, draft.notes]);

  function commit(notes: ScoreNote[], extra?: Partial<Draft>) {
    setUndo((u) => [...u.slice(-30), draft.notes]);
    onChange({
      ...draft,
      ...extra,
      notes,
      notation: serializeNotation(notes, extra?.timeSignature ?? draft.timeSignature),
    });
  }

  function handleApplyLyrics() {
    const tokens = tokenizeLyrics(lyricsInput);
    if (!tokens.length) {
      toast.error("请输入歌词文本");
      return;
    }
    const newNotes = alignLyricsToNotes(draft.notes, tokens);
    const melodyCount = getMelodyNotes(newNotes).length;
    const matchedCount = Math.min(tokens.length, melodyCount);
    commit(newNotes, { lyricsText: lyricsInput });
    toast.success(`已为 ${matchedCount} 个音符分配歌词`);
  }

  function handleClearLyrics() {
    const newNotes = clearLyricsFromNotes(draft.notes);
    setLyricsInput("");
    commit(newNotes, { lyricsText: "" });
    toast.success("已清空歌词");
  }

  function addPitch(midi: number, staff?: StaffId) {
    void getPiano()
      .resume()
      .then(() => getPiano().noteOn(midi, 0.8));
    window.setTimeout(() => getPiano().noteOff(midi), 280);
    const d = draftRef.current;
    commit(appendNote(d.notes, midi, beatsRef.current, staff ?? staffForMidi(midi, d.clef)));
  }

  function noteOn(midi: number, velocity = 0.85) {
    void getPiano().resume().then(() => getPiano().noteOn(midi, velocity));
    setActive((s) => new Set(s).add(midi));
    if (recPhaseRef.current === "rec") {
      liveRef.current.set(midi, performance.now() - recStartRef.current);
      return;
    }
    if (recPhaseRef.current === "count") return;
    addPitch(midi);
  }

  function noteOff(midi: number) {
    getPiano().noteOff(midi);
    setActive((s) => {
      const n = new Set(s);
      n.delete(midi);
      return n;
    });
    if (recPhaseRef.current !== "rec") return;
    const onMs = liveRef.current.get(midi);
    if (onMs == null) return;
    liveRef.current.delete(midi);
    holdsRef.current.push({ midi, onMs, offMs: performance.now() - recStartRef.current });
  }

  useEffect(() => {
    const stopKeys = bindComputerKeys({ onDown: (m, v) => noteOn(m, v), onUp: noteOff });
    let stopMidi = () => {};
    void bindMidi({ onDown: (m, v) => noteOn(m, v), onUp: noteOff }).then((r) => {
      setMidi(r.status);
      stopMidi = r.stop;
    });
    return () => {
      stopKeys();
      stopMidi();
      window.clearInterval(metroId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startMetronome() {
    window.clearInterval(metroId.current);
    const interval = (60 / draftRef.current.tempo) * 1000;
    let beat = 0;
    const num = draftRef.current.timeSignature.num;
    const click = () => {
      getPiano().click(beat % num === 0);
      beat++;
    };
    click();
    metroId.current = window.setInterval(click, interval);
  }

  async function startRecord() {
    await getPiano().resume();
    holdsRef.current = [];
    liveRef.current.clear();
    setRecPhase("count");
    const num = Math.max(2, draft.timeSignature.num);
    setCount(num);
    const interval = (60 / draft.tempo) * 1000;
    startMetronome();
    let n = num;
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(id);
        recStartRef.current = performance.now();
        setRecPhase("rec");
      } else setCount(n);
    }, interval);
  }

  function stopRecord() {
    window.clearInterval(metroId.current);
    getPiano().stopAll();
    if (recPhaseRef.current !== "rec") {
      setRecPhase("idle");
      liveRef.current.clear();
      holdsRef.current = [];
      return;
    }
    const now = performance.now() - recStartRef.current;
    for (const [midi, onMs] of liveRef.current) {
      holdsRef.current.push({ midi, onMs, offMs: now });
    }
    liveRef.current.clear();
    const notes = holdsToNotes(holdsRef.current, draft.tempo, gridRef.current);
    setRecPhase("idle");
    if (!notes.length) return;
    commit(notes, { source: "midi", clef: inferClef(notes) });
  }

  async function preview() {
    const piano = getPiano();
    await piano.resume();
    if (playing) {
      piano.stopAll();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const ctx = piano.audioContext!;
    const bps = draft.tempo / 60;
    const t0 = ctx.currentTime + 0.05;
    for (const n of draft.notes) {
      if (n.type === "note" && n.midi != null) {
        piano.schedule(n.midi, t0 + n.start / bps, (n.beats / bps) * 0.88);
      }
    }
    const total = (totalBeats(draft.notes) / bps) * 1000 + 80;
    window.setTimeout(() => setPlaying(false), total);
  }

  const tsValue = `${draft.timeSignature.num}/${draft.timeSignature.den}`;
  const canSave = draft.title.trim() && draft.notes.some((n) => n.type === "note");
  const kbStart = draft.clef === "treble" ? 60 : 36;
  const kbEnd = draft.clef === "bass" ? 64 : 84;
  const soundingNotes = draft.notes.filter((n) => n.type === "note" && n.midi != null);
  const selectedNote = draft.notes.find((n) => n.id === selectedNoteId);
  const lyricsCount = draft.notes.filter((n) => !!n.lyric).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-4">
        <div className="relative">
          <StaffView
            notes={draft.notes}
            timeSignature={draft.timeSignature}
            keySignature={draft.key}
            clef={draft.clef}
            selectedNoteId={selectedNoteId}
            onNoteClick={(id) => setSelectedNoteId((prev) => (prev === id ? null : id))}
            onPitchAppend={(midi, staff) => {
              if (recPhaseRef.current !== "idle") return;
              addPitch(midi, staff);
            }}
          />
          {recPhase === "count" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-paper/70">
              <span className="font-display text-6xl font-medium text-paper-fg tabular-nums">{count}</span>
            </div>
          )}
          {recPhase === "rec" && (
            <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 rounded-md bg-danger px-3 py-1 text-xs font-medium text-paper">
              <span className="size-2 animate-pulse rounded-full bg-paper" />
              正在录制 MIDI
            </div>
          )}
        </div>

        {selectedNote && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
            <span className="font-semibold text-fg">
              {selectedNote.midi ? midiToName(selectedNote.midi) : "休止符"}
              <span className="ml-1 font-normal text-muted">
                (第 {Math.floor(selectedNote.start + 1)} 拍，{selectedNote.beats} 拍)
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="note-lyric-input" className="text-xs text-muted">
                单音歌词:
              </Label>
              <Input
                id="note-lyric-input"
                value={selectedNote.lyric || ""}
                placeholder="填字 (按 Enter 跳至下一音)"
                className="h-7 w-28 text-xs font-serif"
                onChange={(e) => {
                  const val = e.target.value;
                  const updated = draft.notes.map((n) =>
                    n.id === selectedNote.id ? { ...n, lyric: val || undefined } : n,
                  );
                  commit(updated);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const idx = soundingNotes.findIndex((n) => n.id === selectedNote.id);
                    if (idx >= 0 && idx < soundingNotes.length - 1) {
                      setSelectedNoteId(soundingNotes[idx + 1]!.id);
                    }
                  }
                }}
                autoFocus
              />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={soundingNotes.findIndex((n) => n.id === selectedNote.id) <= 0}
                onClick={() => {
                  const idx = soundingNotes.findIndex((n) => n.id === selectedNote.id);
                  if (idx > 0) setSelectedNoteId(soundingNotes[idx - 1]!.id);
                }}
              >
                上一个
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={soundingNotes.findIndex((n) => n.id === selectedNote.id) >= soundingNotes.length - 1}
                onClick={() => {
                  const idx = soundingNotes.findIndex((n) => n.id === selectedNote.id);
                  if (idx >= 0 && idx < soundingNotes.length - 1) {
                    setSelectedNoteId(soundingNotes[idx + 1]!.id);
                  }
                }}
              >
                下一个
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted"
                onClick={() => setSelectedNoteId(null)}
              >
                完成
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setBeats(d.beats)}
              className={cn(
                "h-9 rounded-md px-3 text-xs font-medium",
                beats === d.beats ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
              )}
            >
              {d.label}
            </button>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => setBeats((b) => b * 1.5)}>
            附点
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => commit(appendRest(draft.notes, beats))}>
            休止
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const prev = undo.at(-1);
              if (!prev) return;
              setUndo((u) => u.slice(0, -1));
              onChange({
                ...draft,
                notes: prev,
                notation: serializeNotation(prev, draft.timeSignature),
              });
            }}
          >
            <Undo className="size-3.5" />
            撤销
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => commit(dropLast(draft.notes))}>
            <Trash2 className="size-3.5" />
            删末音
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void preview()}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "停止" : "试听"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
          <Usb className="size-4 text-muted" />
          <span className="text-xs text-muted">
            {!midi.supported
              ? "此浏览器不支持 MIDI"
              : midi.connected.length
                ? midi.connected[0]
                : "未连接 MIDI 键盘"}
          </span>
          {midi.error && <span className="text-xs text-danger">{midi.error}</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-subtle">量化</span>
            {GRIDS.map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setGrid(g.beats)}
                className={cn(
                  "h-8 rounded-md px-2 text-xs",
                  grid === g.beats ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
                )}
              >
                {g.label}
              </button>
            ))}
            {recPhase === "idle" ? (
              <Button type="button" size="sm" onClick={() => void startRecord()}>
                <Circle className="size-3.5 fill-danger text-danger" />
                MIDI 录制
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" onClick={stopRecord}>
                <Square className="size-3.5" />
                {recPhase === "count" ? "取消" : "停止并写入"}
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted">
          点谱、琴键、电脑键盘 A–L，或接 MIDI 键盘逐步录入。点击五线谱上的音符可填单音歌词。
        </p>
        <PianoKeyboard
          startMidi={kbStart}
          endMidi={kbEnd}
          active={active}
          onDown={(m) => noteOn(m)}
          onUp={noteOff}
        />

        <div className="space-y-2 rounded-xl bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="lyrics-text" className="text-xs font-semibold">
                歌词录入
              </Label>
              <span className="text-[11px] text-muted">
                {lyricsCount > 0
                  ? `已附歌词 ${lyricsCount} 处`
                  : "输入或粘贴整段歌词后点击一键匹配，或在五线谱上点击音符录入"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2.5 text-xs"
                onClick={handleApplyLyrics}
                disabled={!lyricsInput.trim() || !draft.notes.some((n) => n.type === "note")}
              >
                一键匹配到音符
              </Button>
              {lyricsCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted"
                  onClick={handleClearLyrics}
                >
                  清空歌词
                </Button>
              )}
            </div>
          </div>
          <Textarea
            id="lyrics-text"
            value={lyricsInput}
            placeholder="输入或粘贴整段歌词（支持中文单字匹配、英文空格/连字符分词，如：一闪一闪亮晶晶 满天都是小星星）"
            className="h-16 text-xs leading-relaxed font-serif"
            onChange={(e) => {
              const val = e.target.value;
              setLyricsInput(val);
              onChange({ ...draft, lyricsText: val });
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notation">记谱文本</Label>
          <Textarea
            id="notation"
            value={draft.notation}
            placeholder="C4 D4 E4/2 F4 | G4 G4 A4 A4 | G4/2　支持带歌词如 C4&quot;一&quot; D4&quot;闪&quot;"
            className="font-mono text-xs leading-relaxed"
            onChange={(e) => {
              const notation = e.target.value;
              const notes = parseNotation(notation, draft.clef);
              const extracted = extractLyricsFromNotes(notes);
              onChange({
                ...draft,
                notation,
                notes,
                lyricsText: extracted || draft.lyricsText,
              });
            }}
          />
        </div>
      </div>

      <aside className="space-y-4">
        {draft.imageThumb && (
          <img
            src={draft.imageThumb}
            alt="曲谱原图"
            className="w-full rounded-lg object-cover outline outline-1 -outline-offset-1 outline-fg/10"
          />
        )}
        <Field label="曲名">
          <Input
            value={draft.title}
            placeholder="未命名曲谱"
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
        </Field>
        <Field label="作曲 / 来源">
          <Input
            value={draft.composer}
            placeholder="未知"
            onChange={(e) => onChange({ ...draft, composer: e.target.value })}
          />
        </Field>
        <Field label="谱号">
          <Select value={draft.clef} onValueChange={(clef) => onChange({ ...draft, clef: clef as ClefKind })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLEFS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="调号">
          <Select value={draft.key} onValueChange={(key) => onChange({ ...draft, key })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="拍号">
          <Select
            value={tsValue}
            onValueChange={(v) => {
              const [num, den] = v.split("/").map(Number);
              const timeSignature = { num: num || 4, den: den || 4 };
              onChange({
                ...draft,
                timeSignature,
                notation: serializeNotation(draft.notes, timeSignature),
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMES.map((t) => (
                <SelectItem key={`${t.num}/${t.den}`} value={`${t.num}/${t.den}`}>
                  {t.num}/{t.den}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`速度 ${draft.tempo} BPM`}>
          <Input
            type="number"
            min={40}
            max={200}
            value={draft.tempo}
            onChange={(e) => onChange({ ...draft, tempo: Number(e.target.value) || 90 })}
          />
        </Field>
        <Button className="w-full" disabled={!canSave} onClick={onSave}>
          {saveLabel}
        </Button>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
