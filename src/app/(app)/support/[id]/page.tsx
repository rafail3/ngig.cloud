import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { getMyTicket } from "@/server/tickets/service";
import { formatDateTime } from "@/lib/format-date";
import { TicketMessages } from "@/components/support/TicketMessages";
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Live: an admin reply / status change appears without a manual refresh. */}
      <RealtimeRefresh tables={["tickets", "ticket_messages"]} />

      <div>
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" /> Înapoi la suport
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
          {ticket.subject}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <CategoryBadge category={ticket.category} />
          <PriorityBadge priority={ticket.priority} />
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Deschis {formatDateTime(ticket.created_at)}
          </span>
        </div>
      </div>

      <TicketMessages messages={ticket.messages} viewerIsAdmin={false} authorName={ticket.username} />

      <UserReply ticketId={ticket.id} closed={ticket.status === "closed"} />
    </div>
  );
}
