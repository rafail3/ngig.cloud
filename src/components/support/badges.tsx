import { categoryLabel, priorityLabel, type TicketPriority, type TicketStatus } from "@/lib/tickets";

// Open = live blue dot; Closed = muted zinc. Color is backed by text, never
// carried alone.
export function StatusBadge({ status }: { status: TicketStatus }) {
  const open = status === "open";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        open ? "bg-indigo-500/10 text-indigo-300" : "bg-zinc-800/80 text-zinc-400"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${open ? "bg-indigo-400" : "bg-zinc-500"}`}
      />
      {open ? "Deschis" : "Închis"}
    </span>
  );
}

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  high: "bg-red-500/10 text-red-300",
  medium: "bg-amber-500/10 text-amber-300",
  low: "bg-zinc-800/80 text-zinc-400",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[priority]}`}
    >
      {priorityLabel(priority)}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-xs text-zinc-400">
      {categoryLabel(category)}
    </span>
  );
}
