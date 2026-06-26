// Static placeholder for <DashboardShell>, shown as the <Suspense> fallback
// while the panel's per-request data (auth + admin gate) streams in. Mirrors the
// real chrome (h-16 header, w-64 sidebar) so the swap is seamless. Same zinc
// tokens as the shell, themed for light/dark by the globals.css remap.
export function DashboardShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {/* Top navbar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/95 px-3 backdrop-blur sm:px-5">
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 animate-pulse rounded bg-zinc-900 sm:h-10 sm:w-32" />
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-8 w-8 animate-pulse rounded-md bg-zinc-900" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-zinc-900" />
          <div className="h-8 w-9 animate-pulse rounded-md bg-zinc-900 sm:w-20" />
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1">
        <aside className="hidden w-64 flex-col border-r border-zinc-900 bg-zinc-950 md:sticky md:top-16 md:flex md:h-[calc(100vh-4rem)]">
          <nav className="flex-1 space-y-1 px-3 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
              >
                <div className="h-5 w-5 animate-pulse rounded bg-zinc-900" />
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-900" />
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
            <div>
              <div className="h-7 w-40 animate-pulse rounded-lg bg-zinc-900" />
              <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-zinc-900/70" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40"
                />
              ))}
            </div>
            <div className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
          </div>
        </main>
      </div>
    </div>
  );
}
