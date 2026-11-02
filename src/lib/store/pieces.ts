import { create } from "zustand";
import { DEMO_PIECES } from "@/lib/music/demo-pieces";
import type { Piece, PracticeRecord } from "@/lib/music/types";
import { uid } from "@/lib/utils";
import {
  createPieceServer,
  deletePieceServer,
  getPiecesServer,
  recordPracticeServer,
  seedDemosServer,
  updatePieceServer,
} from "@/lib/server/pieces";

type PiecesState = {
  pieces: Piece[];
  hasSeeded: boolean;
  hydrated: boolean;
  setHydrated: () => void;
  loadFromServer: () => Promise<void>;
  addPiece: (
    input: Omit<Piece, "id" | "createdAt" | "updatedAt" | "history"> & {
      history?: PracticeRecord[];
    },
  ) => Piece;
  updatePiece: (id: string, patch: Partial<Piece>) => void;
  deletePiece: (id: string) => void;
  recordPractice: (id: string, rec: PracticeRecord) => void;
  seedDemos: () => void;
};

export const usePiecesStore = create<PiecesState>()((set, get) => ({
  pieces: DEMO_PIECES.map((d) => ({
    ...d,
    notes: d.notes.map((n) => ({ ...n })),
    history: [],
  })),
  hasSeeded: true,
  hydrated: false,
  setHydrated: () => set({ hydrated: true }),
  loadFromServer: async () => {
    try {
      const serverPieces = await getPiecesServer();
      if (Array.isArray(serverPieces) && serverPieces.length > 0) {
        set({ pieces: serverPieces, hydrated: true, hasSeeded: true });
      } else {
        set({ hydrated: true });
      }
    } catch (err) {
      console.error("Failed to load pieces from SQLite server:", err);
      set({ hydrated: true });
    }
  },
  addPiece: (input) => {
    const now = Date.now();
    const piece: Piece = {
      ...input,
      id: uid(),
      createdAt: now,
      updatedAt: now,
      history: input.history ?? [],
    };
    set({ pieces: [piece, ...get().pieces] });
    void createPieceServer({ data: piece }).catch((err) => {
      console.error("Failed to persist piece to SQLite on server:", err);
    });
    return piece;
  },
  updatePiece: (id, patch) => {
    set({
      pieces: get().pieces.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    });
    void updatePieceServer({ data: { id, patch } }).catch((err) => {
      console.error("Failed to update piece in SQLite on server:", err);
    });
  },
  deletePiece: (id) => {
    set({ pieces: get().pieces.filter((p) => p.id !== id) });
    void deletePieceServer({ data: id }).catch((err) => {
      console.error("Failed to delete piece from SQLite on server:", err);
    });
  },
  recordPractice: (id, rec) => {
    set({
      pieces: get().pieces.map((p) =>
        p.id === id
          ? { ...p, history: [rec, ...p.history].slice(0, 20), updatedAt: Date.now() }
          : p,
      ),
    });
    void recordPracticeServer({ data: { id, rec } }).catch((err) => {
      console.error("Failed to record practice to SQLite on server:", err);
    });
  },
  seedDemos: async () => {
    try {
      const pieces = await seedDemosServer();
      set({ pieces, hasSeeded: true });
    } catch (err) {
      console.error("Failed to seed demos on server:", err);
      set({
        pieces: [...DEMO_PIECES, ...get().pieces.filter((p) => p.source !== "demo")],
        hasSeeded: true,
      });
    }
  },
}));

export function usePiece(id: string | undefined) {
  return usePiecesStore((s) => s.pieces.find((p) => p.id === id));
}
