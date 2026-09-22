export type ClefKind = "treble" | "bass" | "grand";
export type StaffId = "treble" | "bass";

export type ScoreNote = {
  id: string;
  type: "note" | "rest";
  midi?: number;
  /** Length in quarter-note beats */
  beats: number;
  /** Start position in quarter-note beats */
  start: number;
  /** Which staff to draw on in a grand-staff score */
  staff?: StaffId;
};

export type TimeSig = { num: number; den: number };

export type PracticeMode = "follow" | "perform";

export type Grade = "S" | "A" | "B" | "C" | "D";

export type PracticeRecord = {
  at: number;
  mode: PracticeMode;
  score: number;
  accuracy: number;
  grade: Grade;
  durationSec: number;
  wrongPitches: number[];
};

export type PieceSource = "upload" | "camera" | "editor" | "demo" | "midi";

export type Piece = {
  id: string;
  title: string;
  composer: string;
  createdAt: number;
  updatedAt: number;
  source: PieceSource;
  imageThumb?: string;
  notation: string;
  notes: ScoreNote[];
  timeSignature: TimeSig;
  tempo: number;
  key: string;
  clef: ClefKind;
  history: PracticeRecord[];
};

export type PlayedEvent = {
  midi: number;
  atMs: number;
  expectedIndex?: number;
  status: "hit" | "wrong" | "extra";
};
