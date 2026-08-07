import type { LucideIcon } from "lucide-react";

// The one empty-state pattern, used by every board and table. An empty page is
// still a page: it names what's missing, explains how it gets filled, and —
// when the filling action lives on this very page — offers it right here
// instead of leaving the user to hunt for the button elsewhere.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  // Optional CTA rendered under the text (a Button/Link supplied by the caller,
  // so the action keeps its own handler/href and styling).
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/50 text-zinc-500">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
