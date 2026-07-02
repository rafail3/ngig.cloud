// Skeleton for the Files board — mirrors its layout (filter bar, title, usage
// bar, upload area, rows). Shown only on the very first load of a folder (cold
// SWR cache) and as the page-level <Suspense> fallback. Zinc tokens → both themes.
export function DriveSkeleton() {
  return (
    <>
      <div className="mb-6 h-12 w-full animate-pulse rounded-full bg-zinc-900" />
      <div className="mb-4 h-8 w-44 animate-pulse rounded-lg bg-zinc-900" />
      <div className="mb-6 h-2 w-full animate-pulse rounded-full bg-zinc-900" />
      <div className="mb-6 h-32 w-full animate-pulse rounded-2xl border border-zinc-900 bg-zinc-900/40" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-zinc-900 bg-zinc-900/40"
          />
        ))}
      </div>
    </>
  );
}
