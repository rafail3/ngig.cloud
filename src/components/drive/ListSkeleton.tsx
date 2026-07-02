// Generic pulsing-rows placeholder for the file/archive/trash lists, used as the
// <Suspense> fallback so the page structure (title, description) paints instantly
// while the actual rows stream in. Zinc tokens → correct in both themes.
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-zinc-900 bg-zinc-900/40"
        />
      ))}
    </div>
  );
}
