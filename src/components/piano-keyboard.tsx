import { useMemo, type PointerEvent } from "react";
import { HINT_FOR_MIDI, isBlackKey, whiteKeyIndex } from "@/lib/music/theory";
import { cn } from "@/lib/utils";

type Props = {
  startMidi?: number;
  endMidi?: number;
  active: Set<number>;
  expected?: number | null;
  wrong?: Set<number>;
  showHints?: boolean;
  onDown: (midi: number) => void;
  onUp: (midi: number) => void;
  className?: string;
};

export function PianoKeyboard({
  startMidi = 60,
  endMidi = 84,
  active,
  expected,
  wrong,
  showHints = true,
  onDown,
  onUp,
  className,
}: Props) {
  const whites = useMemo(() => {
    const list: number[] = [];
    for (let m = startMidi; m <= endMidi; m++) if (!isBlackKey(m)) list.push(m);
    return list;
  }, [startMidi, endMidi]);

  const blacks = useMemo(() => {
    const list: number[] = [];
    for (let m = startMidi; m <= endMidi; m++) if (isBlackKey(m)) list.push(m);
    return list;
  }, [startMidi, endMidi]);

  const firstWhite = whiteKeyIndex(whites[0] ?? startMidi);

  function bind(midi: number) {
    return {
      onPointerDown: (e: PointerEvent) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown(midi);
      },
      onPointerUp: () => onUp(midi),
      onPointerCancel: () => onUp(midi),
    };
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="relative select-none" style={{ touchAction: "none", minWidth: `max(100%, ${whites.length * 32}px)` }}>
        <div className="flex h-36 w-full sm:h-40">
          {whites.map((midi) => {
            const on = active.has(midi);
            const isExp = expected === midi;
            const isWrong = wrong?.has(midi);
            const hint = HINT_FOR_MIDI[midi];
            return (
              <button
                key={midi}
                type="button"
                aria-label={`琴键 ${midi}`}
                className={cn(
                  "relative min-w-8 flex-1 rounded-b-md border border-border/80 bg-key-white text-key-white-fg",
                  "shadow-[inset_0_-6px_0_rgba(28,25,22,0.08)]",
                  "transition-[background-color,transform] duration-75",
                  on && "bg-key-active text-fg translate-y-px",
                  isWrong && "bg-key-wrong text-fg",
                  isExp && !on && "ring-2 ring-success ring-inset",
                )}
                {...bind(midi)}
              >
                {showHints && hint && (
                  <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-medium text-subtle">{hint}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-0">
          {blacks.map((midi) => {
            const idx = whiteKeyIndex(midi) - firstWhite;
            const left = (idx / whites.length) * 100;
            const w = (1 / whites.length) * 100 * 0.62;
            const on = active.has(midi);
            const isExp = expected === midi;
            const isWrong = wrong?.has(midi);
            const hint = HINT_FOR_MIDI[midi];
            return (
              <button
                key={midi}
                type="button"
                aria-label={`黑键 ${midi}`}
                className={cn(
                  "pointer-events-auto absolute top-0 h-[58%] rounded-b-sm bg-key-black text-key-black-fg",
                  "shadow-[inset_0_-8px_0_rgba(0,0,0,0.35)]",
                  "transition-[background-color,transform] duration-75",
                  on && "bg-key-active text-fg",
                  isWrong && "bg-key-wrong text-fg",
                  isExp && !on && "ring-2 ring-success",
                )}
                style={{ left: `calc(${left}% - ${w / 2}%)`, width: `${w}%` }}
                {...bind(midi)}
              >
                {showHints && hint && (
                  <span className="absolute inset-x-0 bottom-1.5 text-center text-[9px] font-medium opacity-80">{hint}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
