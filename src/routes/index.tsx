import { createFileRoute, Link } from "@tanstack/react-router";
import { Music2, Plus } from "lucide-react";
import { AppShell, useHydratePieces } from "@/components/app-shell";
import { PieceCard } from "@/components/piece-card";
import { Button } from "@/components/ui/button";
import { usePiecesStore } from "@/lib/store/pieces";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const hydrated = useHydratePieces();
  const pieces = usePiecesStore((s) => s.pieces);
  const seedDemos = usePiecesStore((s) => s.seedDemos);

  return (
    <AppShell
      right={
        <Button asChild>
          <Link to="/new">
            <Plus className="size-4" />
            录入曲谱
          </Link>
        </Button>
      }
    >
      <div className="stagger-in mb-8">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">曲库</p>
        <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight sm:text-4xl">今晚练哪一首</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          拍照、上传、在线录入或 MIDI 键盘录制。大谱表双手对照，练完给出评分与指导。
        </p>
      </div>

      {!hydrated && pieces.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : pieces.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-xl bg-surface p-8 shadow-[var(--shadow-border)]">
          <Music2 className="size-8 text-muted" />
          <div>
            <h2 className="font-serif text-xl">曲库是空的</h2>
            <p className="mt-1 text-sm text-muted">录入第一首谱，或载入示例曲目开始练习。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/new">录入曲谱</Link>
            </Button>
            <Button variant="secondary" onClick={() => seedDemos()}>
              载入示例曲谱
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pieces.map((p) => (
            <PieceCard key={p.id} piece={p} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
