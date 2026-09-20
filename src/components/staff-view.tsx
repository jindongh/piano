import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import {
  beatsPerBar,
  diatonicToMidi,
  keyAccidentals,
  pitchInKey,
  totalBeats,
} from "@/lib/music/theory";
import type { ScoreNote, TimeSig } from "@/lib/music/types";
import { cn } from "@/lib/utils";

export type NoteStatus = "ok" | "wrong" | "current";

type Props = {
  notes: ScoreNote[];
  timeSignature: TimeSig;
  keySignature?: string;
  cursorIndex?: number;
  statuses?: Record<string, NoteStatus>;
  onPitchAppend?: (midi: number) => void;
  onNoteClick?: (id: string) => void;
  compact?: boolean;
  className?: string;
};

const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34];
const FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];

export function StaffView({
  notes,
  timeSignature,
  keySignature = "C",
  cursorIndex,
  statuses,
  onPitchAppend,
  onNoteClick,
  compact,
  className,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const LINE_GAP = compact ? 8 : 12;
  const TOP_STEP = 38;
  const staffTop = compact ? 20 : 34;
  const height = compact ? 88 : 132;
  const beatW = compact ? 26 : 44;
  const leftPad = compact ? 46 : 78;
  const acc = keyAccidentals(keySignature);
  const accW = acc.letters.length * (compact ? 8 : 11);
  const contentStart = leftPad + accW + (compact ? 16 : 22);

  const yOf = (step: number) => staffTop + (TOP_STEP - step) * (LINE_GAP / 2);
  const bars = beatsPerBar(timeSignature);
  const beats = Math.max(bars * (compact ? 2 : 4), totalBeats(notes), bars);
  const width = contentStart + beats * beatW + 24;

  const sounding = useMemo(
    () => notes.filter((n) => n.type === "note" && n.midi != null),
    [notes],
  );

  useEffect(() => {
    if (cursorIndex == null || !scroller.current) return;
    const el = scroller.current.querySelector(`[data-cursor="${cursorIndex}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [cursorIndex]);

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!onPitchAppend) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    const step = Math.round(TOP_STEP - (loc.y - staffTop) / (LINE_GAP / 2));
    const midi = diatonicToMidi(step, 0);
    if (midi < 21 || midi > 108) return;
    onPitchAppend(midi);
  }

  const lines = [0, 1, 2, 3, 4].map((i) => staffTop + i * LINE_GAP);

  return (
    <div
      ref={scroller}
      className={cn(
        "overflow-x-auto rounded-xl bg-paper text-paper-fg shadow-[var(--shadow-border)]",
        className,
      )}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("block", onPitchAppend && "cursor-crosshair")}
        onClick={handleClick}
        role="img"
        aria-label="五线谱"
      >
        {lines.map((y) => (
          <line key={y} x1={12} x2={width - 8} y1={y} y2={y} stroke="currentColor" strokeWidth={1} opacity={0.72} />
        ))}
        <TrebleClef x={compact ? 6 : 10} y={staffTop - LINE_GAP * 0.35} scale={compact ? 0.62 : 0.9} />
        {acc.letters.map((_, i) => {
          const step = acc.kind === "#" ? SHARP_STEPS[i]! : FLAT_STEPS[i]!;
          const x = leftPad + i * (compact ? 8 : 11) - 10;
          return acc.kind === "#" ? (
            <Sharp key={i} x={x} y={yOf(step)} s={compact ? 0.7 : 1} />
          ) : (
            <Flat key={i} x={x} y={yOf(step)} s={compact ? 0.7 : 1} />
          );
        })}
        <text x={leftPad + accW + (compact ? 2 : 4)} y={staffTop + LINE_GAP * 1.15} fontSize={compact ? 13 : 20} fontFamily="Fraunces, Noto Serif SC, serif" fontWeight={600} fill="currentColor">
          {timeSignature.num}
        </text>
        <text x={leftPad + accW + (compact ? 2 : 4)} y={staffTop + LINE_GAP * 3.15} fontSize={compact ? 13 : 20} fontFamily="Fraunces, Noto Serif SC, serif" fontWeight={600} fill="currentColor">
          {timeSignature.den}
        </text>
        {Array.from({ length: Math.floor(beats / bars) + 1 }, (_, i) => {
          const x = contentStart + i * bars * beatW;
          return (
            <line key={`bar-${i}`} x1={x} x2={x} y1={staffTop} y2={staffTop + LINE_GAP * 4} stroke="currentColor" strokeWidth={i === 0 ? 1.6 : 1} opacity={0.55} />
          );
        })}
        {notes.map((n) => {
          const x = contentStart + n.start * beatW + beatW * n.beats * 0.35;
          if (n.type === "rest") {
            return <Rest key={n.id} x={x} y={staffTop + LINE_GAP * 1.5} beats={n.beats} gap={LINE_GAP} />;
          }
          if (n.midi == null) return null;
          const { step, accidental } = pitchInKey(n.midi, keySignature);
          const y = yOf(step);
          const soundIdx = sounding.findIndex((s) => s.id === n.id);
          const st = statuses?.[n.id];
          const isCurrent = cursorIndex != null && soundIdx === cursorIndex;
          const stemUp = step < 34;
          return (
            <g key={n.id} data-cursor={soundIdx >= 0 ? soundIdx : undefined} onClick={(e) => { e.stopPropagation(); onNoteClick?.(n.id); }} className={onNoteClick ? "cursor-pointer" : undefined}>
              <Ledgers step={step} x={x} yOf={yOf} />
              {(isCurrent || st === "current") && <circle cx={x} cy={y} r={compact ? 9 : 12} className="fill-success/25" />}
              {st === "ok" && <circle cx={x} cy={y} r={compact ? 8 : 11} className="fill-success/20" />}
              {st === "wrong" && <circle cx={x} cy={y} r={compact ? 8 : 11} className="fill-danger/25" />}
              {accidental !== 0 && <Accidental kind={accidental} x={x - (compact ? 11 : 14)} y={y} s={compact ? 0.7 : 1} />}
              <NoteHead x={x} y={y} beats={n.beats} stemUp={stemUp} gap={LINE_GAP} compact={!!compact} ink={st === "ok" ? "var(--color-success)" : st === "wrong" ? "var(--color-danger)" : "currentColor"} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Ledgers({ step, x, yOf }: { step: number; x: number; yOf: (s: number) => number }) {
  const topStep = 38;
  const botStep = 30;
  const lines: number[] = [];
  if (step < botStep) {
    for (let s = botStep - 2; s >= step - (step % 2 === 0 ? 0 : 1); s -= 2) lines.push(s);
  }
  if (step > topStep) {
    for (let s = topStep + 2; s <= step + (step % 2 === 0 ? 0 : 1); s += 2) lines.push(s);
  }
  return (
    <>
      {lines.map((s) => (
        <line key={s} x1={x - 9} x2={x + 9} y1={yOf(s)} y2={yOf(s)} stroke="currentColor" strokeWidth={1} opacity={0.7} />
      ))}
    </>
  );
}

function NoteHead({ x, y, beats, stemUp, gap, compact, ink }: { x: number; y: number; beats: number; stemUp: boolean; gap: number; compact: boolean; ink: string }) {
  const open = beats >= 2;
  const rx = compact ? 5.2 : 6.6;
  const ry = compact ? 3.6 : 4.5;
  const stemLen = gap * 3.1;
  const stemX = stemUp ? x + rx - 0.8 : x - rx + 0.8;
  const stemY2 = stemUp ? y - stemLen : y + stemLen;
  const flags = beats <= 0.26 ? 2 : beats <= 0.6 ? 1 : 0;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(-20 ${x} ${y})`} fill={open ? "none" : ink} stroke={ink} strokeWidth={open ? 1.5 : 1} />
      {beats < 3.5 && <line x1={stemX} y1={y} x2={stemX} y2={stemY2} stroke={ink} strokeWidth={1.2} />}
      {flags > 0 &&
        Array.from({ length: flags }, (_, i) => {
          const fy = stemUp ? stemY2 + i * 6 : stemY2 - i * 6;
          const dir = stemUp ? 1 : -1;
          return <path key={i} d={`M ${stemX} ${fy} c 8 ${4 * dir}, 11 ${12 * dir}, 6 ${16 * dir}`} fill="none" stroke={ink} strokeWidth={1.2} />;
        })}
    </g>
  );
}

function Rest({ x, y, beats, gap }: { x: number; y: number; beats: number; gap: number }) {
  if (beats >= 3.5) return <rect x={x - 6} y={y - gap * 0.15} width={12} height={gap * 0.45} fill="currentColor" />;
  if (beats >= 1.8) return <rect x={x - 6} y={y + gap * 0.35} width={12} height={gap * 0.45} fill="currentColor" />;
  return <path d={`M ${x - 3} ${y - 6} l 6 4 l -6 5 l 6 5`} fill="none" stroke="currentColor" strokeWidth={1.6} />;
}

function Sharp({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -3 -8 v 16 M 3 -9 v 16 M -5 -3 h 10 M -5 3 h 10" fill="none" stroke="currentColor" strokeWidth={1.4} />
    </g>
  );
}

function Flat({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -2 -10 v 16 c 8 -2 8 -10 0 -10" fill="none" stroke="currentColor" strokeWidth={1.4} />
    </g>
  );
}

function Accidental({ kind, x, y, s }: { kind: number; x: number; y: number; s: number }) {
  if (kind > 0) return <Sharp x={x} y={y} s={s} />;
  if (kind < 0)
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M -4 0 h 8 M 0 -4 v 8" fill="none" stroke="currentColor" strokeWidth={1.3} />
      </g>
    );
  return null;
}

function TrebleClef({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="currentColor">
      <path d="M18.2 8.4c-1.9 0-3.6 1.1-4.5 3.2-.7 1.6-1 3.6-1.1 5.8 1.4-.8 3.1-1.3 4.8-1.3 4.2 0 7.4 3.1 7.4 7.2 0 5.2-4.4 8.2-8.5 11.6-2.9 2.4-5.2 5.5-5.6 9.6-.2 1.8.3 3.6 1.5 5 .9 1.1 2.2 1.8 3.7 2.1-.4 2.8-.9 5.6-1.6 8.2-1.3 4.8-3.3 8.4-6.1 10.4-.5.4-.8 1-.8 1.6 0 .9.8 1.6 1.7 1.6.4 0 .8-.1 1.1-.4 3.6-2.6 6-6.9 7.4-12.7.7-2.8 1.2-5.8 1.5-8.8 1.4.4 2.9.6 4.3.6 4.6 0 8.4-3.5 8.4-8.1 0-5.6-4.6-9.3-10-9.3-1.5 0-3 .3-4.3.9.1-1.8.4-3.5.9-5 1.1-3.3 2.9-5.5 2.9-5.5l-2.1-1.1zm.6 12.6c-1.3 0-2.5.4-3.5 1.1.2-1.9.5-3.6.9-5.1.6-2.1 1.5-3.6 2.2-4.3.2 2.7.4 5.5.4 8.3zm-3.3 22.7c.4-2.7 1.5-5.1 3.2-7.1 2.8-3.3 6.3-5.8 6.3-9.4 0-2.2-1.8-4-4.1-4-1.4 0-2.7.6-3.6 1.6-.2 2.9-.5 6.5-1.8 12.9z" />
    </g>
  );
}
