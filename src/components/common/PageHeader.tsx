// The one page-header pattern: title + description on the left, the page's
// primary action (if any) anchored to the right on desktop, stacked under the
// text on mobile. Keeps every page from re-inventing the same header markup —
// and stops primary actions from floating detached above the content.
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 sm:pt-1">{action}</div>}
    </header>
  );
}
