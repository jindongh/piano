import { Link, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { StaffView } from "@/components/staff-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Piece } from "@/lib/music/types";
import { usePiecesStore } from "@/lib/store/pieces";

const SOURCE: Record<Piece["source"], string> = {
  demo: "示例",
  upload: "上传",
  camera: "拍照",
  editor: "手写",
};

export function PieceCard({ piece }: { piece: Piece }) {
  const navigate = useNavigate();
  const deletePiece = usePiecesStore((s) => s.deletePiece);
  const last = piece.history[0];
  const noteCount = piece.notes.filter((n) => n.type === "note").length;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]">
      <Link to="/p/$id" params={{ id: piece.id }} className="block p-3 pb-0">
        <StaffView notes={piece.notes.slice(0, 24)} timeSignature={piece.timeSignature} keySignature={piece.key} compact />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to="/p/$id" params={{ id: piece.id }} className="block truncate font-serif text-lg font-medium tracking-tight text-fg no-underline">
              {piece.title}
            </Link>
            <p className="mt-0.5 truncate text-sm text-muted">{piece.composer}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="更多">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate({ to: "/p/$id", params: { id: piece.id } })}>
                <Pencil className="size-3.5" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-danger"
                onSelect={() => {
                  if (window.confirm(`删除「${piece.title}」？`)) deletePiece(piece.id);
                }}
              >
                <Trash2 className="size-3.5" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{SOURCE[piece.source]}</Badge>
          <Badge>
            {piece.timeSignature.num}/{piece.timeSignature.den}
          </Badge>
          <Badge>{noteCount} 音</Badge>
          {last && (
            <Badge variant={last.grade === "S" || last.grade === "A" ? "success" : "paper"}>
              最近 {last.grade} · {last.score}
            </Badge>
          )}
        </div>
        <Button asChild className="mt-auto w-full">
          <Link to="/play/$id" params={{ id: piece.id }}>
            <Play className="size-4" />
            开始练习
          </Link>
        </Button>
      </div>
    </article>
  );
}
