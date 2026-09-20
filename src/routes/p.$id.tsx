import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, useHydratePieces } from "@/components/app-shell";
import { PieceEditor, pieceToDraft, type Draft } from "@/components/piece-editor";
import { Button } from "@/components/ui/button";
import { usePiece, usePiecesStore } from "@/lib/store/pieces";

export const Route = createFileRoute("/p/$id")({ component: PiecePage });

function PiecePage() {
  const { id } = Route.useParams();
  const hydrated = useHydratePieces();
  const piece = usePiece(id);
  const updatePiece = usePiecesStore((s) => s.updatePiece);
  const deletePiece = usePiecesStore((s) => s.deletePiece);
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = draft ?? (piece ? pieceToDraft(piece) : null);

  if (!hydrated) {
    return (
      <AppShell>
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </AppShell>
    );
  }

  if (!piece || !current) {
    return (
      <AppShell>
        <p className="text-muted">找不到这首曲谱。</p>
        <Button asChild className="mt-4">
          <Link to="/">返回曲库</Link>
        </Button>
      </AppShell>
    );
  }

  function save() {
    if (!current) return;
    updatePiece(id, current);
    toast.success("已保存修改");
  }

  return (
    <AppShell
      compact
      right={
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/play/$id" params={{ id }}>
              <Play className="size-4" />
              练习
            </Link>
          </Button>
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="返回">
            <Link to="/">
              <ChevronLeft />
            </Link>
          </Button>
          <div>
            <p className="text-xs text-muted">编辑曲谱</p>
            <h1 className="font-serif text-2xl font-medium tracking-tight">{piece.title}</h1>
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-danger"
          onClick={() => {
            if (!window.confirm(`删除「${piece.title}」？`)) return;
            deletePiece(id);
            toast.success("已删除");
            void navigate({ to: "/" });
          }}
        >
          <Trash2 className="size-4" />
          删除
        </Button>
      </div>
      <PieceEditor draft={current} onChange={setDraft} onSave={save} saveLabel="保存修改" />
    </AppShell>
  );
}
