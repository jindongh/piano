import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, useHydratePieces } from "@/components/app-shell";
import { PracticeRoom } from "@/components/practice-room";
import { Button } from "@/components/ui/button";
import { usePiece } from "@/lib/store/pieces";

export const Route = createFileRoute("/play/$id")({ component: PlayPage });

function PlayPage() {
  const { id } = Route.useParams();
  const hydrated = useHydratePieces();
  const piece = usePiece(id);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">载入曲谱…</div>
    );
  }

  if (!piece) {
    return (
      <AppShell>
        <p className="text-muted">找不到这首曲谱。</p>
        <Button asChild className="mt-4">
          <Link to="/">返回曲库</Link>
        </Button>
      </AppShell>
    );
  }

  return <PracticeRoom piece={piece} />;
}
