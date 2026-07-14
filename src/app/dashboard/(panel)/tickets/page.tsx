import { Suspense } from "react";
import { connection } from "next/server";
import { listAllTickets } from "@/server/tickets/service";
import { TicketsTable } from "@/components/dashboard/TicketsTable";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Suport" };

async function TicketsContent() {
  await connection();
  const tickets = await listAllTickets();
  const open = tickets.filter((t) => t.status === "open").length;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-zinc-400">
        {tickets.length} tickete
        <span className="tabular-nums text-zinc-500"> · {open} deschise</span>
      </h2>
      <TicketsTable tickets={tickets} />
    </section>
  );
}

export default function TicketsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Suport</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Ticketele de suport ale utilizatorilor — răspunde, închide sau redeschide.
        </p>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <TicketsContent />
      </Suspense>
    </div>
  );
}
