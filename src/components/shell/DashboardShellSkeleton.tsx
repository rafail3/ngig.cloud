import { Skeleton } from "@/components/ui/skeleton";

// Static placeholder for <DashboardShell>, shown as the <Suspense> fallback
// while the panel's per-request data (auth + admin gate) streams in. Mirrors the
// real frame (full-height w-64 column, h-16 header over a lifted panel) so the
// swap is seamless. Same zinc tokens as the shell, themed for light/dark by the
// globals.css remap. The blocks are the shared Skeleton so every loading surface
// pulses alike.
export function DashboardShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-[var(--surface-chrome)] text-zinc-50">
      {/* Navigation column */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col md:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Skeleton className="h-10 w-32 rounded bg-zinc-800/60 dark:bg-zinc-900" />
        </div>
        <div className="px-5 pb-3">
          <Skeleton className="h-5 w-24 rounded-full bg-zinc-800/60 dark:bg-zinc-900" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
              <Skeleton className="h-5 w-5 rounded bg-zinc-800/60 dark:bg-zinc-900" />
              <Skeleton className="h-4 w-24 rounded bg-zinc-800/60 dark:bg-zinc-900" />
            </div>
          ))}
        </nav>
      </aside>

      {/* Content column: header + lifted panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 bg-[var(--surface-chrome)] px-3 sm:px-5">
          <div className="flex items-center gap-2 md:hidden">
            <Skeleton className="h-9 w-9 rounded-lg bg-zinc-800/60 dark:bg-zinc-900" />
            <Skeleton className="h-8 w-24 rounded bg-zinc-800/60 sm:h-10 sm:w-32 dark:bg-zinc-900" />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Skeleton className="h-8 w-8 rounded-md bg-zinc-800/60 dark:bg-zinc-900" />
            <Skeleton className="h-8 w-8 rounded-md bg-zinc-800/60 dark:bg-zinc-900" />
            <Skeleton className="h-8 w-8 rounded-full bg-zinc-800/60 sm:w-28 sm:rounded-lg dark:bg-zinc-900" />
          </div>
        </header>

        <main className="min-w-0 flex-1 border-zinc-200/70 bg-[var(--surface-panel)] dark:border-zinc-800/60 md:rounded-tl-2xl md:border-l md:border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
            <div>
              <Skeleton className="h-7 w-40 rounded-lg bg-zinc-900" />
              <Skeleton className="mt-2 h-4 w-64 max-w-full rounded bg-zinc-900/70" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-24 rounded-2xl border border-zinc-800 bg-zinc-900/40"
                />
              ))}
            </div>
            <Skeleton className="h-72 rounded-2xl border border-zinc-800 bg-zinc-900/40" />
          </div>
        </main>
      </div>
    </div>
  );
}
