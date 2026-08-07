import { Skeleton } from "@/components/ui/skeleton";

// Static placeholder for <AppShell>, shown as the <Suspense> fallback while the
// shell's per-request data (auth + profile) streams in. It mirrors the real
// frame — full-height w-64 navigation column, h-16 header over a lifted content
// panel — so the swap to the live shell is seamless, with no layout shift.
// The placeholder blocks are the shared Skeleton, so every loading surface in
// the app pulses at one rate and one colour instead of each inventing its own.
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-zinc-900 text-zinc-50 dark:bg-zinc-950">
      {/* Navigation column */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col md:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Skeleton className="h-9 w-32 rounded bg-zinc-800/60 dark:bg-zinc-900" />
        </div>
        <div className="px-3 pb-1">
          <Skeleton className="h-[42px] w-full rounded-xl bg-zinc-800/60 dark:bg-zinc-900" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <Skeleton className="h-5 w-5 rounded bg-zinc-800/60 dark:bg-zinc-900" />
              <Skeleton className="h-4 w-24 rounded bg-zinc-800/60 dark:bg-zinc-900" />
            </div>
          ))}
        </nav>
      </aside>

      {/* Content column: header + lifted panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 px-3 sm:px-5">
          <div className="flex items-center gap-2 md:hidden">
            <Skeleton className="h-9 w-9 rounded-lg bg-zinc-800/60 dark:bg-zinc-900" />
            <Skeleton className="h-8 w-24 rounded bg-zinc-800/60 dark:bg-zinc-900" />
          </div>
          <Skeleton className="hidden h-9 w-full max-w-md rounded-lg bg-zinc-800/60 md:block dark:bg-zinc-900" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Skeleton className="h-8 w-8 rounded-md bg-zinc-800/60 dark:bg-zinc-900" />
            <Skeleton className="h-8 w-8 rounded-md bg-zinc-800/60 dark:bg-zinc-900" />
            <Skeleton className="h-8 w-8 rounded-full bg-zinc-800/60 sm:w-28 sm:rounded-lg dark:bg-zinc-900" />
          </div>
        </header>

        <main className="min-w-0 flex-1 border-zinc-200/70 bg-zinc-950 dark:border-zinc-800/60 dark:bg-zinc-900/30 md:rounded-tl-2xl md:border-l md:border-t">
          <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
            <Skeleton className="h-8 w-44 rounded-lg bg-zinc-900" />
            <Skeleton className="mt-3 h-4 w-80 max-w-full rounded bg-zinc-900/70" />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-16 rounded-xl border border-zinc-900 bg-zinc-900/40"
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
