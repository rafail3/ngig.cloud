import Link from "next/link";
import { LifeBuoy, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import type { TicketRow } from "@/server/tickets/service";
import { StatusBadge, PriorityBadge, CategoryBadge } from "./badges";

// The user's own tickets, each a row linking to its thread.
export function TicketList({ tickets }: { tickets: TicketRow[] }) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
          <LifeBuoy className="h-5 w-5 text-zinc-500" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-zinc-300">Niciun ticket încă</p>
          <p className="mt-1 text-sm text-zinc-500">
            Deschide un ticket și îți răspundem cât putem de repede.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-800/40 overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/20">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link
            href={`/support/${t.id}`}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-900/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{t.subject}</p>
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
