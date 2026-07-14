import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMyTicket } from "@/server/tickets/service";
import { ChatPanel } from "@/components/support/ChatPanel";
import { UserReply } from "@/components/support/UserReply";
import { StatusBadge, PriorityBadge, CategoryBadge } from "@/components/support/badges";
import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";

export const metadata = { title: "Ticket" };

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getMyTicket(id);
  if (!ticket) notFound();

  return (
    // Fixed-height column under the h-16 navbar: the thread scrolls inside,
    // the composer stays at the bottom of the screen.
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-4 pb-4 pt-4 sm:px-6">
      {/* Live: admin replies / status changes land without a manual refresh. */}
      <RealtimeRefresh tables={["tickets", "ticket_messages"]} />

      <header className="shrink-0 pb-3">
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" /> Înapoi la suport
        </Link>
        <h1 className="mt-2 truncate text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
          {ticket.subject}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={ticket.status} />
          <CategoryBadge category={ticket.category} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </header>

      <ChatPanel messages={ticket.messages} viewerIsAdmin={false} authorName={ticket.username}>
        <UserReply ticketId={ticket.id} closed={ticket.status === "closed"} />
      </ChatPanel>
    </div>
  );
}
