// Instant navigation feedback for the dashboard: shown immediately on switching
// panel sections (Overview / Invites / Users / Settings) while the next page
// renders. The shell (sidebar + header) stays; only this content area swaps.
export default function Loading() {
  return (
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

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    </div>
  );
}
