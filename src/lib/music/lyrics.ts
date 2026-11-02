import type { ScoreNote } from "./types";

/**
 * Punctuation characters to filter out when tokenizing lyrics.
 */
const PUNCTUATION_REGEX = /[，。！？；：“”‘’（）《》、\s,.!?;:"'(){}\[\]\-—_~]+/g;

/**
 * Splits raw lyric text into an array of syllables/words.
 * - CJK characters: 1 character = 1 syllable
 * - Latin words/syllables: split by spaces or hyphens (e.g. "Twin-kle lit-tle")
 * - Treats "-" or "~" or "_" between words as syllable dividers, but removes trailing/lonely punctuation.
 */
export function tokenizeLyrics(text: string): string[] {
  if (!text || !text.trim()) return [];

  const tokens: string[] = [];
  // First split into chunks by whitespace or punctuation while preserving words
  // Match CJK unified ideographs individually, or Latin/alphanumeric words/syllables
  const regex = /([\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af])|([a-zA-Z0-9'’]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      // CJK character
      tokens.push(match[1]);
    } else if (match[2]) {
      // Latin word or hyphenated piece
      tokens.push(match[2]);
    }
  }

  return tokens;
}

/**
 * Finds the primary melody notes (one note per distinct sounding start-time).
 * In grand staff scores or chords, prefers treble staff and higher pitch.
 */
export function getMelodyNotes(notes: ScoreNote[]): ScoreNote[] {
  const groups = new Map<number, ScoreNote[]>();
  for (const n of notes) {
    if (n.type !== "note" || n.midi == null) continue;
    if (!groups.has(n.start)) {
      groups.set(n.start, []);
    }
    groups.get(n.start)!.push(n);
  }

  const sortedStarts = Array.from(groups.keys()).sort((a, b) => a - b);
  const melodyNotes: ScoreNote[] = [];

  for (const start of sortedStarts) {
    const list = groups.get(start)!;
    // Prefer treble staff, then highest midi note
    list.sort((a, b) => {
      if (a.staff === "treble" && b.staff !== "treble") return -1;
      if (a.staff !== "treble" && b.staff === "treble") return 1;
      return (b.midi ?? 0) - (a.midi ?? 0);
    });
    melodyNotes.push(list[0]!);
  }

  return melodyNotes;
}

/**
 * Aligns an array of lyric tokens to notes.
 * Tokens are assigned to the primary melody notes at each distinct start beat.
 */
export function alignLyricsToNotes(notes: ScoreNote[], lyricTokens: string[]): ScoreNote[] {
  const melodyNotes = getMelodyNotes(notes);
  const noteLyricMap = new Map<string, string>();

  melodyNotes.forEach((note, idx) => {
    if (idx < lyricTokens.length && lyricTokens[idx]) {
      noteLyricMap.set(note.id, lyricTokens[idx]!);
    }
  });

  return notes.map((n) => {
    if (noteLyricMap.has(n.id)) {
      return { ...n, lyric: noteLyricMap.get(n.id) };
    }
    // Clear any previous lyric on this note
    if (n.lyric) {
      const copy = { ...n };
      delete copy.lyric;
      return copy;
    }
    return n;
  });
}

/**
 * Extracts a readable lyrics string from notes that already have lyrics.
 */
export function extractLyricsFromNotes(notes: ScoreNote[]): string {
  const melodyNotes = getMelodyNotes(notes);
  const tokens: string[] = [];

  for (const note of melodyNotes) {
    if (note.lyric && note.lyric.trim()) {
      tokens.push(note.lyric.trim());
    }
  }

  // Join CJK tokens without spaces or with spaces for Latin words
  const isAllCjk = tokens.every((t) => /^[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]$/.test(t));
  return isAllCjk ? tokens.join("") : tokens.join(" ");
}

/**
 * Clears lyric property from all notes.
 */
export function clearLyricsFromNotes(notes: ScoreNote[]): ScoreNote[] {
  return notes.map((n) => {
    if (!n.lyric) return n;
    const copy = { ...n };
    delete copy.lyric;
    return copy;
  });
}
