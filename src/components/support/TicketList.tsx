import Link from "next/link";
import { LifeBuoy, ChevronRight, Plus } from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import type { TicketRow } from "@/server/tickets/service";
import { StatusBadge, PriorityBadge, CategoryBadge } from "./badges";
import { EmptyState } from "@/components/common/EmptyState";

// The user's own tickets, each a row linking to its thread.
export function TicketList({ tickets }: { tickets: TicketRow[] }) {
  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={LifeBuoy}
        title="Niciun ticket încă"
        description="Deschide un ticket și îți răspundem cât putem de repede."
        action={
          <Link
            href="/support/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" />
            Ticket nou
          </Link>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-zinc-800/40 overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/20">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link
            href={`/support/${t.id}`}
            className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
              t.unread ? "bg-indigo-500/[0.06] hover:bg-indigo-500/10" : "hover:bg-zinc-900/50"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                {t.unread && (
                  <span
                    title="Răspuns necitit"
                    className="inline-block h-2 w-2 shrink-0 rounded-full bg-indigo-400"
                  />
                )}
                <span
                  className={`truncate text-sm ${
                    t.unread ? "font-semibold text-zinc-50" : "font-medium text-zinc-100"
                  }`}
                >
                  {t.subject}
                </span>
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={t.status} />
                <CategoryBadge category={t.category} />
                <PriorityBadge priority={t.priority} />
                <span className="text-xs text-zinc-500">
                  actualizat {formatDateTime(t.last_activity_at)}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
