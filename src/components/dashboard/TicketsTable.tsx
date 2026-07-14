"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LifeBuoy, Search, X, Shapes, Flag, CircleDot } from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import { categoryLabel, TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/tickets";
import { fuzzyScore } from "@/lib/fuzzy";
import { Select } from "@/components/support/Select";
import type { AdminTicketRow } from "@/server/tickets/service";
import { StatusBadge, PriorityBadge } from "@/components/support/badges";

const ANY = "any";
const STATUS_OPTIONS = [
  { key: ANY, label: "Toate statusurile" },
  { key: "open", label: "Deschise" },
  { key: "closed", label: "Închise" },
];
const CATEGORY_OPTIONS = [{ key: ANY, label: "Toate categoriile" }, ...TICKET_CATEGORIES];
const PRIORITY_OPTIONS = [{ key: ANY, label: "Toate prioritățile" }, ...TICKET_PRIORITIES];

// A dot marking a thread with unread messages for this admin. Cleared by
// opening the ticket (never by just looking at the list).
function UnreadDot() {
  return (
    <span
      title="Necitit"
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-indigo-400"
    />
  );
}

export function TicketsTable({ tickets }: { tickets: AdminTicketRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ANY);
  const [category, setCategory] = useState(ANY);
  const [priority, setPriority] = useState(ANY);

  const filtered = useMemo(() => {
    const q = query.trim();
    return tickets.filter((t) => {
      if (status !== ANY && t.status !== status) return false;
      if (category !== ANY && t.category !== category) return false;
      if (priority !== ANY && t.priority !== priority) return false;
      if (!q) return true;
      // Match the subject or the owner — the two things you'd search by.
      return fuzzyScore(q, t.subject) > 0 || fuzzyScore(q, t.username) > 0;
    });
  }, [tickets, query, status, category, priority]);

  const active = query.trim() !== "" || status !== ANY || category !== ANY || priority !== ANY;

  function reset() {
    setQuery("");
    setStatus(ANY);
    setCategory(ANY);
    setPriority(ANY);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search + filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută după subiect sau utilizator…"
            aria-label="Caută tickete"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 py-2 pl-10 pr-9 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-indigo-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-indigo-500/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Șterge căutarea"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-500 transition hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2">
          <Select value={status} options={STATUS_OPTIONS} onChange={setStatus} icon={CircleDot} ariaLabel="Status" className="sm:w-40" />
          <Select value={category} options={CATEGORY_OPTIONS} onChange={setCategory} icon={Shapes} ariaLabel="Categorie" className="sm:w-48" />
          <Select value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} icon={Flag} ariaLabel="Prioritate" className="sm:w-44" />
        </div>
      </div>

      {active && (
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span>
            {filtered.length} din {tickets.length}
          </span>
          <button
            type="button"
            onClick={reset}
            className="text-indigo-400 transition hover:text-indigo-300"
          >
            Resetează
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
            <LifeBuoy className="h-5 w-5 text-zinc-500" aria-hidden="true" />
          </span>
          <p className="text-sm text-zinc-500">
            {active ? "Niciun ticket nu se potrivește cu filtrele." : "Niciun ticket deocamdată."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table — the whole row opens the ticket; the subject stays a
              real link so keyboard and open-in-new-tab still work. */}
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
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                    className={`cursor-pointer transition-colors ${
                      t.unread ? "bg-indigo-500/[0.06] hover:bg-indigo-500/10" : "hover:bg-zinc-900/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        {t.unread && <UnreadDot />}
                        <Link
                          href={`/tickets/${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`outline-none hover:text-indigo-300 focus-visible:text-indigo-300 ${
                            t.unread ? "font-semibold text-zinc-50" : "font-medium text-zinc-100"
                          }`}
                        >
                          {t.subject}
                        </Link>
                        {t.unread && (
                          <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
                            nou
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{t.username}</td>
                    <td className="px-4 py-3 text-zinc-400">{categoryLabel(t.category)}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                      {formatDateTime(t.last_activity_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className={`rounded-2xl border p-4 transition-colors ${
                  t.unread
                    ? "border-indigo-500/30 bg-indigo-500/[0.06] hover:bg-indigo-500/10"
                    : "border-zinc-800/70 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2">
                    {t.unread && <UnreadDot />}
                    <span className={`truncate ${t.unread ? "font-semibold text-zinc-50" : "font-medium text-zinc-100"}`}>
                      {t.subject}
                    </span>
                  </p>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {t.unread && (
                    <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
                      nou
                    </span>
                  )}
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
      )}
    </div>
  );
}
