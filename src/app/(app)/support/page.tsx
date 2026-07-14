import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listMyTickets } from "@/server/tickets/service";
import { TicketList } from "@/components/support/TicketList";
import { RefreshOnLand } from "@/components/realtime/RefreshOnLand";
import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";

export const metadata = { title: "Suport" };

async function SupportContent() {
  const tickets = await listMyTickets();
  return (
    <>
      {/* Live: new replies / status changes reflect without a manual refresh. */}
      <RealtimeRefresh tables={["tickets", "ticket_messages"]} />
      {/* Coming back from a thread must drop its unread dot, not replay the
          cached list. */}
      <RefreshOnLand path="/support" />
      <TicketList tickets={tickets} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-zinc-900 bg-zinc-900/40" />
      ))}
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">Suport</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ai o problemă sau o întrebare? Deschide un ticket și îți răspundem.
          </p>
        </div>
        <Link
          href="/support/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 active:bg-indigo-600"
        >
          <Plus className="h-4 w-4" /> Ticket nou
        </Link>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <SupportContent />
      </Suspense>
    </div>
  );
}
