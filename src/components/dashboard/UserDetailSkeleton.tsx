// <Suspense> fallback for the user-detail body (full page + intercept modal)
// while the per-user admin data streams in. Zinc tokens → both themes.
export function UserDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-zinc-900" />
        <div className="flex flex-col gap-2">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-900" />
          <div className="h-4 w-56 animate-pulse rounded bg-zinc-900/70" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-zinc-800/70 bg-zinc-900/40" />
        ))}
      </div>
    </div>
  );
}
