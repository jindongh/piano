import { COMPUTER_KEY_MAP } from "@/lib/music/theory";

export type MidiStatus = {
  supported: boolean;
  connected: string[];
  error?: string;
};

type Handlers = {
  onDown: (midi: number, velocity: number) => void;
  onUp: (midi: number) => void;
};

export function bindComputerKeys(handlers: Handlers) {
  const down = new Set<string>();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const midi = COMPUTER_KEY_MAP[e.key.toLowerCase()];
    if (midi == null) return;
    e.preventDefault();
    if (down.has(e.key)) return;
    down.add(e.key);
    handlers.onDown(midi, 0.85);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const midi = COMPUTER_KEY_MAP[e.key.toLowerCase()];
    if (midi == null) return;
    down.delete(e.key);
    handlers.onUp(midi);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}

export async function bindMidi(handlers: Handlers): Promise<{ status: MidiStatus; stop: () => void }> {
  if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
    return { status: { supported: false, connected: [] }, stop: () => {} };
  }
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    const inputs: MIDIInput[] = [];
    const onMessage = (ev: MIDIMessageEvent) => {
      const data = ev.data;
      if (!data || data.length < 2) return;
      const status = data[0]! & 0xf0;
      const note = data[1]!;
      const vel = data[2] ?? 0;
      if (status === 0x90 && vel > 0) handlers.onDown(note, vel / 127);
      else if (status === 0x80 || (status === 0x90 && vel === 0)) handlers.onUp(note);
    };
    const attach = () => {
      inputs.length = 0;
      access.inputs.forEach((input) => {
        input.onmidimessage = onMessage;
        inputs.push(input);
      });
    };
    attach();
    access.onstatechange = () => attach();
    return {
      status: { supported: true, connected: inputs.map((i) => i.name || i.id || "MIDI") },
      stop: () => {
        for (const i of inputs) i.onmidimessage = null;
      },
    };
  } catch (err) {
    return {
      status: {
        supported: true,
        connected: [],
        error: err instanceof Error ? err.message : "无法访问 MIDI",
      },
      stop: () => {},
    };
  }
}
