import { parseNotation } from "./notation";
import type { Piece } from "./types";

function demo(
  partial: Omit<Piece, "notes" | "history" | "createdAt" | "updatedAt"> & {
    notation: string;
  },
): Piece {
  return {
    ...partial,
    notes: parseNotation(partial.notation, partial.clef),
    history: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
}

export const DEMO_PIECES: Piece[] = [
  demo({
    id: "demo-twinkle",
    title: "小星星",
    composer: "传统童谣",
    source: "demo",
    tempo: 96,
    key: "C",
    clef: "treble",
    timeSignature: { num: 4, den: 4 },
    notation:
      "C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2 G4 G4 F4 F4 E4 E4 D4/2 G4 G4 F4 F4 E4 E4 D4/2 C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2",
  }),
  demo({
    id: "demo-hands",
    title: "小星星（双手）",
    composer: "传统童谣",
    source: "demo",
    tempo: 88,
    key: "C",
    clef: "grand",
    timeSignature: { num: 4, den: 4 },
    notation:
      "[C3,C4] [C3,C4] [G2,G4] [G2,G4] [C3,A4] [C3,A4] [G2,G4]/2 [C3,F4] [C3,F4] [G2,E4] [G2,E4] [C3,D4] [C3,D4] [G2,C4]/2 [C3,G4] [C3,G4] [G2,F4] [G2,F4] [C3,E4] [C3,E4] [G2,D4]/2 [C3,C4] [C3,C4] [G2,G4] [G2,G4] [C3,A4] [C3,A4] [C3,G4]/2",
  }),
  demo({
    id: "demo-ode",
    title: "欢乐颂",
    composer: "贝多芬",
    source: "demo",
    tempo: 108,
    key: "C",
    clef: "treble",
    timeSignature: { num: 4, den: 4 },
    notation:
      "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4/2. D4/8 D4/2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4/2. C4/8 C4/2 D4 D4 E4 C4 D4 E4/8 F4/8 E4 C4 D4 E4/8 F4/8 E4 D4 C4 D4 G3/2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4/2. C4/8 C4/2",
  }),
  demo({
    id: "demo-elise",
    title: "致爱丽丝",
    composer: "贝多芬",
    source: "demo",
    tempo: 72,
    key: "Am",
    clef: "treble",
    timeSignature: { num: 3, den: 8 },
    notation:
      "E5 D#5 E5 D#5 E5 B4 D5 C5 A4/2 R/8 C4 E4 A4 B4/2 R/8 E4 G#4 B4 C5/2 R/8 E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4/2 R/8 C4 E4 A4 B4/2 R/8 E4 C5 B4 A4/2",
  }),
  demo({
    id: "demo-farewell",
    title: "送别",
    composer: "李叔同",
    source: "demo",
    tempo: 76,
    key: "C",
    clef: "bass",
    timeSignature: { num: 4, den: 4 },
    notation:
      "E3 G3 G3/2 G3 A3 C4 A3 G3/2 E3 G3 A3 G3 E3 G3 D3/2 C3 E3 D3 C3 A2 C3 G2/2 E3 G3 G3/2 G3 A3 C4 A3 G3/2 E3 G3 A3 G3 C3 D3 C3/2",
  }),
];
