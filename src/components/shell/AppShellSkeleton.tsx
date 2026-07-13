// Static placeholder for <AppShell>, shown as the <Suspense> fallback while the
// shell's per-request data (auth + profile) streams in. It mirrors the real
// chrome's dimensions (h-16 header, full-width content; the sidebar is an
// overlay drawer) so the swap to the live shell is seamless — no layout shift.
// Painted with the same zinc
// tokens as AppShell, which the theme remap (see globals.css) flips for light
// mode automatically, so it looks right in both themes.
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {/* Top navbar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/95 px-3 backdrop-blur sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-zinc-900 sm:w-24" />
          <div className="h-8 w-24 animate-pulse rounded bg-zinc-900 sm:h-10 sm:w-32" />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="h-8 w-8 animate-pulse rounded-md bg-zinc-900" />
          <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-900" />
          <div className="h-8 w-9 animate-pulse rounded-md bg-zinc-900 sm:w-20" />
        </div>
      </header>

      {/* Body: full-width content, centered on the viewport (drawer is overlay) */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-zinc-900" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-zinc-900/70" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-zinc-900 bg-zinc-900/40"
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
