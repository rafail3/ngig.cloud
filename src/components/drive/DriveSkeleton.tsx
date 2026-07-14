// Skeleton for the Files board — mirrors its layout (search bar, header with
// storage meter, upload area, rows). Shown only on the very first load of a
// folder (cold SWR cache) and as the page-level <Suspense> fallback.
// Zinc tokens → both themes.
export function DriveSkeleton() {
  return (
    <>
      <div className="mb-6 h-11 w-full animate-pulse rounded-xl bg-zinc-900" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-8 w-44 animate-pulse rounded-lg bg-zinc-900" />
          <div className="mt-2 h-4 w-28 animate-pulse rounded bg-zinc-900/70" />
        </div>
        <div className="h-9 w-full animate-pulse rounded-lg bg-zinc-900/70 sm:w-56" />
      </div>
      <div className="mb-6 h-28 w-full animate-pulse rounded-xl border border-zinc-900 bg-zinc-900/40" />
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
