export type ScoreNote = {
  id: string;
  type: "note" | "rest";
  midi?: number;
  /** Length in quarter-note beats */
  beats: number;
  /** Start position in quarter-note beats */
  start: number;
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

export type PieceSource = "upload" | "camera" | "editor" | "demo";

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
  history: PracticeRecord[];
};

export type PlayedEvent = {
  midi: number;
  atMs: number;
  expectedIndex?: number;
  status: "hit" | "wrong" | "extra";
};
