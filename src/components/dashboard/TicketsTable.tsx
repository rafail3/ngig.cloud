import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import { categoryLabel } from "@/lib/tickets";
import type { AdminTicketRow } from "@/server/tickets/service";
import { StatusBadge, PriorityBadge } from "@/components/support/badges";

export function TicketsTable({ tickets }: { tickets: AdminTicketRow[] }) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
          <LifeBuoy className="h-5 w-5 text-zinc-500" aria-hidden="true" />
        </span>
        <p className="text-sm text-zinc-500">Niciun ticket deocamdată.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/20 lg:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/40 text-xs font-medium text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Subiect</th>
              <th className="px-4 py-3 text-left font-medium">Utilizator</th>
              <th className="px-4 py-3 text-left font-medium">Categorie</th>
              <th className="px-4 py-3 text-left font-medium">Prioritate</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actualizat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {tickets.map((t) => (
              <tr key={t.id} className="group transition-colors hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <Link href={`/tickets/${t.id}`} className="block font-medium text-zinc-100 hover:text-indigo-300">
                    {t.subject}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-300">{t.username}</td>
                <td className="px-4 py-3 text-zinc-400">{categoryLabel(t.category)}</td>
                <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-500">{formatDateTime(t.last_activity_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/tickets/${t.id}`}
            className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-medium text-zinc-100">{t.subject}</p>
              <StatusBadge status={t.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <PriorityBadge priority={t.priority} />
              <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-xs text-zinc-400">
                {categoryLabel(t.category)}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {t.username} · actualizat {formatDateTime(t.last_activity_at)}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
