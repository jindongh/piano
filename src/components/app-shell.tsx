import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { usePiecesStore } from "@/lib/store/pieces";
import { cn } from "@/lib/utils";

export function useHydratePieces() {
  const hydrated = usePiecesStore((s) => s.hydrated);
  useEffect(() => {
    const unsub = usePiecesStore.persist.onFinishHydration(() => {
      const s = usePiecesStore.getState();
      if (!s.hasSeeded) s.seedDemos();
      s.setHydrated();
    });
    void usePiecesStore.persist.rehydrate();
    const t = window.setTimeout(() => {
      const s = usePiecesStore.getState();
      if (!s.hydrated) {
        if (!s.hasSeeded) s.seedDemos();
        s.setHydrated();
      }
    }, 400);
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, []);
  return hydrated;
}

export function AppShell({
  children,
  right,
  compact,
}: {
  children: ReactNode;
  right?: ReactNode;
  compact?: boolean;
}) {
  useHydratePieces();
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header
        className={cn(
          "sticky top-0 z-30 border-b border-border/80 bg-bg/90 backdrop-blur-sm",
          "px-4 sm:px-8",
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between gap-3",
            compact ? "h-14" : "h-16",
          )}
        >
          <Link to="/" className="group flex items-baseline gap-2.5 no-underline">
            <span className="font-serif text-xl font-medium tracking-tight text-fg sm:text-2xl">
              琴坊
            </span>
            <span className="font-display text-sm italic text-muted group-hover:text-fg">
              Ivory
            </span>
          </Link>
          {right}
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
    </div>
  );
}
