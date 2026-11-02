import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DEMO_PIECES } from "../music/demo-pieces";
import type { Piece, PracticeRecord } from "../music/types";

interface PieceRow {
  id: string;
  title: string;
  composer: string;
  key: string;
  time_signature: string;
  tempo: number;
  notation: string;
  notes: string;
  image_thumb: string | null;
  source: string;
  clef: string;
  created_at: number;
  updated_at: number;
  history: string;
  lyrics_text?: string | null;
}

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "piano.db");
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency and write performance
  db.pragma("journal_mode = WAL");

  // Create pieces table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pieces (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      composer TEXT NOT NULL DEFAULT '',
      key TEXT NOT NULL DEFAULT 'C',
      time_signature TEXT NOT NULL DEFAULT '{"num":4,"den":4}',
      tempo INTEGER NOT NULL DEFAULT 90,
      notation TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '[]',
      image_thumb TEXT,
      source TEXT NOT NULL DEFAULT 'editor',
      clef TEXT NOT NULL DEFAULT 'treble',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      history TEXT NOT NULL DEFAULT '[]',
      lyrics_text TEXT NOT NULL DEFAULT ''
    );
  `);

  // Migrate table if lyrics_text column is not yet present
  try {
    db.exec("ALTER TABLE pieces ADD COLUMN lyrics_text TEXT NOT NULL DEFAULT ''");
  } catch {}

  // Seed demo pieces if the table is completely empty
  const countRow = db.prepare("SELECT COUNT(*) as count FROM pieces").get() as { count: number };
  if (!countRow || countRow.count === 0) {
    const insert = db.prepare(`
      INSERT INTO pieces (
        id, title, composer, key, time_signature, tempo,
        notation, notes, image_thumb, source, clef,
        created_at, updated_at, history, lyrics_text
      ) VALUES (
        @id, @title, @composer, @key, @time_signature, @tempo,
        @notation, @notes, @image_thumb, @source, @clef,
        @created_at, @updated_at, @history, @lyrics_text
      )
    `);

    const insertMany = db.transaction((pieces: Piece[]) => {
      for (const p of pieces) {
        insert.run({
          id: p.id,
          title: p.title,
          composer: p.composer || "",
          key: p.key || "C",
          time_signature: JSON.stringify(p.timeSignature || { num: 4, den: 4 }),
          tempo: p.tempo || 90,
          notation: p.notation || "",
          notes: JSON.stringify(p.notes || []),
          image_thumb: p.imageThumb || null,
          source: p.source || "demo",
          clef: p.clef || "treble",
          created_at: p.createdAt || Date.now(),
          updated_at: p.updatedAt || Date.now(),
          history: JSON.stringify(p.history || []),
          lyrics_text: p.lyricsText || "",
        });
      }
    });

    insertMany(DEMO_PIECES);
  } else {
    // Sync demo pieces with lyrics if they exist without lyrics
    for (const d of DEMO_PIECES) {
      if (!d.lyricsText) continue;
      const existing = db.prepare("SELECT notes, lyrics_text FROM pieces WHERE id = ?").get(d.id) as
        | { notes: string; lyrics_text: string }
        | undefined;
      if (existing && (!existing.lyrics_text || existing.lyrics_text.length === 0)) {
        db.prepare("UPDATE pieces SET notes = ?, lyrics_text = ? WHERE id = ?").run(
          JSON.stringify(d.notes),
          d.lyricsText,
          d.id,
        );
      }
    }
  }

  dbInstance = db;
  return dbInstance;
}

function rowToPiece(row: PieceRow): Piece {
  let timeSignature = { num: 4, den: 4 };
  try {
    timeSignature = JSON.parse(row.time_signature);
  } catch {}

  let notes = [];
  try {
    notes = JSON.parse(row.notes);
  } catch {}

  let history = [];
  try {
    history = JSON.parse(row.history);
  } catch {}

  return {
    id: row.id,
    title: row.title,
    composer: row.composer,
    key: row.key,
    timeSignature,
    tempo: row.tempo,
    notation: row.notation,
    notes,
    imageThumb: row.image_thumb || undefined,
    source: row.source as Piece["source"],
    clef: (row.clef || "treble") as Piece["clef"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    history,
    lyricsText: row.lyrics_text || undefined,
  };
}

export function getAllPieces(): Piece[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM pieces ORDER BY updated_at DESC").all() as PieceRow[];
  return rows.map(rowToPiece);
}

export function getPieceById(id: string): Piece | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM pieces WHERE id = ?").get(id) as PieceRow | undefined;
  if (!row) return null;
  return rowToPiece(row);
}

export function insertPiece(piece: Piece): Piece {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pieces (
      id, title, composer, key, time_signature, tempo,
      notation, notes, image_thumb, source, clef,
      created_at, updated_at, history, lyrics_text
    ) VALUES (
      @id, @title, @composer, @key, @time_signature, @tempo,
      @notation, @notes, @image_thumb, @source, @clef,
      @created_at, @updated_at, @history, @lyrics_text
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      composer = excluded.composer,
      key = excluded.key,
      time_signature = excluded.time_signature,
      tempo = excluded.tempo,
      notation = excluded.notation,
      notes = excluded.notes,
      image_thumb = excluded.image_thumb,
      source = excluded.source,
      clef = excluded.clef,
      updated_at = excluded.updated_at,
      history = excluded.history,
      lyrics_text = excluded.lyrics_text
  `);

  stmt.run({
    id: piece.id,
    title: piece.title,
    composer: piece.composer || "",
    key: piece.key || "C",
    time_signature: JSON.stringify(piece.timeSignature || { num: 4, den: 4 }),
    tempo: piece.tempo || 90,
    notation: piece.notation || "",
    notes: JSON.stringify(piece.notes || []),
    image_thumb: piece.imageThumb || null,
    source: piece.source || "editor",
    clef: piece.clef || "treble",
    created_at: piece.createdAt || Date.now(),
    updated_at: piece.updatedAt || Date.now(),
    history: JSON.stringify(piece.history || []),
    lyrics_text: piece.lyricsText || "",
  });

  return piece;
}

export function updatePieceInDb(id: string, patch: Partial<Piece>): Piece | null {
  const db = getDatabase();
  const existing = getPieceById(id);
  if (!existing) return null;

  const updated: Piece = {
    ...existing,
    ...patch,
    id,
    updatedAt: Date.now(),
  };

  const stmt = db.prepare(`
    UPDATE pieces SET
      title = @title,
      composer = @composer,
      key = @key,
      time_signature = @time_signature,
      tempo = @tempo,
      notation = @notation,
      notes = @notes,
      image_thumb = @image_thumb,
      source = @source,
      clef = @clef,
      updated_at = @updated_at,
      history = @history,
      lyrics_text = @lyrics_text
    WHERE id = @id
  `);

  stmt.run({
    id,
    title: updated.title,
    composer: updated.composer || "",
    key: updated.key || "C",
    time_signature: JSON.stringify(updated.timeSignature || { num: 4, den: 4 }),
    tempo: updated.tempo || 90,
    notation: updated.notation || "",
    notes: JSON.stringify(updated.notes || []),
    image_thumb: updated.imageThumb || null,
    source: updated.source || "editor",
    clef: updated.clef || "treble",
    updated_at: updated.updatedAt,
    history: JSON.stringify(updated.history || []),
    lyrics_text: updated.lyricsText || "",
  });

  return updated;
}

export function deletePieceFromDb(id: string): boolean {
  const db = getDatabase();
  const res = db.prepare("DELETE FROM pieces WHERE id = ?").run(id);
  return res.changes > 0;
}

export function recordPracticeInDb(id: string, rec: PracticeRecord): boolean {
  const piece = getPieceById(id);
  if (!piece) return false;
  const history = [rec, ...(piece.history || [])].slice(0, 20);
  updatePieceInDb(id, { history });
  return true;
}

export function seedDemoPiecesInDb(): Piece[] {
  const db = getDatabase();
  const existing = getAllPieces();
  const demoIds = new Set(DEMO_PIECES.map((d) => d.id));
  const userPieces = existing.filter((p) => !demoIds.has(p.id) && p.source !== "demo");

  db.exec("DELETE FROM pieces");

  for (const d of DEMO_PIECES) {
    insertPiece(d);
  }
  for (const u of userPieces) {
    insertPiece(u);
  }

  return getAllPieces();
}
