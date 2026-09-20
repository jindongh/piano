import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEMO_PIECES } from "@/lib/music/demo-pieces";
import type { Piece, PracticeRecord } from "@/lib/music/types";
import { uid } from "@/lib/utils";

type PiecesState = {
  pieces: Piece[];
  hasSeeded: boolean;
  hydrated: boolean;
  setHydrated: () => void;
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

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const usePiecesStore = create<PiecesState>()(
  persist(
    (set, get) => ({
      pieces: DEMO_PIECES.map((d) => ({
        ...d,
        notes: d.notes.map((n) => ({ ...n })),
        history: [],
      })),
      hasSeeded: true,
      hydrated: true,
      setHydrated: () => set({ hydrated: true }),
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
        return piece;
      },
      updatePiece: (id, patch) =>
        set({
          pieces: get().pieces.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
          ),
        }),
      deletePiece: (id) => set({ pieces: get().pieces.filter((p) => p.id !== id) }),
      recordPractice: (id, rec) =>
        set({
          pieces: get().pieces.map((p) =>
            p.id === id
              ? { ...p, history: [rec, ...p.history].slice(0, 20), updatedAt: Date.now() }
              : p,
          ),
        }),
      seedDemos: () =>
        set({
          pieces: [...DEMO_PIECES, ...get().pieces.filter((p) => p.source !== "demo")],
          hasSeeded: true,
        }),
    }),
    {
      name: "ivory-atelier-pieces-v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage : localStorage,
      ),
      partialize: (s) => ({ pieces: s.pieces, hasSeeded: s.hasSeeded }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (!state.hasSeeded) {
            state.pieces = DEMO_PIECES.map((d) => ({
              ...d,
              notes: d.notes.map((n) => ({ ...n })),
              history: [],
            }));
            state.hasSeeded = true;
          }
          state.setHydrated();
          return;
        }
        usePiecesStore.getState().setHydrated();
      },
    },
  ),
);

export function usePiece(id: string | undefined) {
  return usePiecesStore((s) => s.pieces.find((p) => p.id === id));
}
