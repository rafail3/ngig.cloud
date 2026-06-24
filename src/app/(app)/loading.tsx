// Instant navigation feedback: shown immediately when moving between app pages
// while the server component for the next page renders, so switching sections
// (Files / Archive / Trash) never feels like a frozen ~1s wait. The shell
// (sidebar + header) stays put — only this content area swaps to the skeleton.
export default function Loading() {
  return (
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
  );
}
