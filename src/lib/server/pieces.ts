import { createServerFn } from "@tanstack/react-start";
import type { Piece, PracticeRecord } from "../music/types";

export const getPiecesServer = createServerFn({ method: "GET" }).handler(async () => {
  const { getAllPieces } = await import("./db");
  return getAllPieces();
});

export const getPieceServer = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getPieceById } = await import("./db");
    return getPieceById(id);
  });

export const createPieceServer = createServerFn({ method: "POST" })
  .validator((piece: Piece) => piece)
  .handler(async ({ data: piece }) => {
    const { insertPiece } = await import("./db");
    return insertPiece(piece);
  });

export const updatePieceServer = createServerFn({ method: "POST" })
  .validator((payload: { id: string; patch: Partial<Piece> }) => payload)
  .handler(async ({ data }) => {
    const { updatePieceInDb } = await import("./db");
    return updatePieceInDb(data.id, data.patch);
  });

export const deletePieceServer = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { deletePieceFromDb } = await import("./db");
    return deletePieceFromDb(id);
  });

export const recordPracticeServer = createServerFn({ method: "POST" })
  .validator((payload: { id: string; rec: PracticeRecord }) => payload)
  .handler(async ({ data }) => {
    const { recordPracticeInDb } = await import("./db");
    return recordPracticeInDb(data.id, data.rec);
  });

export const seedDemosServer = createServerFn({ method: "POST" }).handler(async () => {
  const { seedDemoPiecesInDb } = await import("./db");
  return seedDemoPiecesInDb();
});
