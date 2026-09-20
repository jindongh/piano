import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, Trash2, Undo } from "lucide-react";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { StaffView } from "@/components/staff-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { bindComputerKeys } from "@/lib/audio/input";
import { getPiano } from "@/lib/audio/piano";
import {
  DURATION_PRESETS,
  appendNote,
  appendRest,
  dropLast,
  parseNotation,
  serializeNotation,
} from "@/lib/music/notation";
import { KEYS, totalBeats } from "@/lib/music/theory";
import type { Piece, PieceSource, ScoreNote, TimeSig } from "@/lib/music/types";
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
  };
}

const TIMES: TimeSig[] = [
  { num: 4, den: 4 },
  { num: 3, den: 4 },
  { num: 2, den: 4 },
  { num: 6, den: 8 },
  { num: 3, den: 8 },
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
  const draftRef = useRef(draft);
  const beatsRef = useRef(beats);
  const onChangeRef = useRef(onChange);
  draftRef.current = draft;
  beatsRef.current = beats;
  onChangeRef.current = onChange;

  function commit(notes: ScoreNote[]) {
    setUndo((u) => [...u.slice(-30), draft.notes]);
    onChange({
      ...draft,
      notes,
      notation: serializeNotation(notes, draft.timeSignature),
    });
  }

  function addPitch(midi: number) {
    void getPiano().resume().then(() => getPiano().noteOn(midi, 0.8));
    window.setTimeout(() => getPiano().noteOff(midi), 280);
    commit(appendNote(draftRef.current.notes, midi, beatsRef.current));
  }

  useEffect(() => {
    return bindComputerKeys({
      onDown: (midi) => {
        const d = draftRef.current;
        void getPiano().resume().then(() => getPiano().noteOn(midi, 0.85));
        setActive((s) => new Set(s).add(midi));
        setUndo((u) => [...u.slice(-30), d.notes]);
        const notes = appendNote(d.notes, midi, beatsRef.current);
        onChangeRef.current({
          ...d,
          notes,
          notation: serializeNotation(notes, d.timeSignature),
        });
      },
      onUp: (midi) => {
        getPiano().noteOff(midi);
        setActive((s) => {
          const n = new Set(s);
          n.delete(midi);
          return n;
        });
      },
    });
  }, []);

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-4">
        <StaffView notes={draft.notes} timeSignature={draft.timeSignature} keySignature={draft.key} onPitchAppend={addPitch} />
        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((d) => (
            <button key={d.label} type="button" onClick={() => setBeats(d.beats)} className={cn("h-9 rounded-md px-3 text-xs font-medium", beats === d.beats ? "bg-accent text-accent-fg" : "bg-elevated text-muted")}>
              {d.label}
            </button>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => setBeats((b) => b * 1.5)}> 附点 </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => commit(appendRest(draft.notes, beats))}> 休止 </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => {
            const prev = undo.at(-1);
            if (!prev) return;
            setUndo((u) => u.slice(0, -1));
            onChange({ ...draft, notes: prev, notation: serializeNotation(prev, draft.timeSignature) });
          }}>
            <Undo className="size-3.5" /> 撤销
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => commit(dropLast(draft.notes))}>
            <Trash2 className="size-3.5" /> 删末音
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void preview()}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "停止" : "试听"}
          </Button>
        </div>
        <p className="text-xs text-muted">点击五线谱或下方琴键录入。电脑键盘 A–L 对应 C4 起的白键。</p>
        <PianoKeyboard
          active={active}
          onDown={(m) => { setActive((s) => new Set(s).add(m)); addPitch(m); }}
          onUp={(m) => {
            getPiano().noteOff(m);
            setActive((s) => { const n = new Set(s); n.delete(m); return n; });
          }}
        />
        <div className="space-y-1.5">
          <Label htmlFor="notation">记谱文本</Label>
          <Textarea
            id="notation"
            value={draft.notation}
            placeholder="C4 D4 E4/2 F4 | G4 G4 A4 A4 | G4/2"
            className="font-mono text-xs leading-relaxed"
            onChange={(e) => {
              const notation = e.target.value;
              onChange({ ...draft, notation, notes: parseNotation(notation) });
            }}
          />
        </div>
      </div>
      <aside className="space-y-4">
        {draft.imageThumb && (
          <img src={draft.imageThumb} alt="曲谱原图" className="w-full rounded-lg object-cover outline outline-1 -outline-offset-1 outline-fg/10" />
        )}
        <Field label="曲名">
          <Input value={draft.title} placeholder="未命名曲谱" onChange={(e) => onChange({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="作曲 / 来源">
          <Input value={draft.composer} placeholder="未知" onChange={(e) => onChange({ ...draft, composer: e.target.value })} />
        </Field>
        <Field label="调号">
          <Select value={draft.key} onValueChange={(key) => onChange({ ...draft, key })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KEYS.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="拍号">
          <Select value={tsValue} onValueChange={(v) => {
            const [num, den] = v.split("/").map(Number);
            const timeSignature = { num: num || 4, den: den || 4 };
            onChange({ ...draft, timeSignature, notation: serializeNotation(draft.notes, timeSignature) });
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMES.map((t) => (<SelectItem key={`${t.num}/${t.den}`} value={`${t.num}/${t.den}`}>{t.num}/{t.den}</SelectItem>))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`速度 ${draft.tempo} BPM`}>
          <Input type="number" min={40} max={200} value={draft.tempo} onChange={(e) => onChange({ ...draft, tempo: Number(e.target.value) || 90 })} />
        </Field>
        <Button className="w-full" disabled={!canSave} onClick={onSave}>{saveLabel}</Button>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (<div className="space-y-1.5"><Label>{label}</Label>{children}</div>);
}
