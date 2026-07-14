import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, UserRound } from "lucide-react";
import { getTicketAsAdmin } from "@/server/tickets/service";
import { formatDateTime } from "@/lib/format-date";
import { TicketMessages } from "@/components/support/TicketMessages";
import { CategoryBadge, StatusBadge, PriorityBadge } from "@/components/support/badges";
import { AdminReply } from "@/components/dashboard/AdminReply";
import { TicketStatusControls } from "@/components/dashboard/TicketStatusControls";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

export const metadata = { title: "Dashboard — Ticket" };

async function TicketContent({ id }: { id: string }) {
  await connection();
  const ticket = await getTicketAsAdmin(id);
  if (!ticket) notFound();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            {ticket.subject}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <CategoryBadge category={ticket.category} />
            <PriorityBadge priority={ticket.priority} />
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              {ticket.username}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDateTime(ticket.created_at)}
            </span>
          </div>
        </div>
        <TicketStatusControls ticketId={ticket.id} status={ticket.status} />
      </div>

      <TicketMessages messages={ticket.messages} viewerIsAdmin authorName={ticket.username} />

      <AdminReply ticketId={ticket.id} />
    </>
  );
}

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/tickets"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" /> Toate ticketele
      </Link>

      <Suspense fallback={<ListSkeleton />}>
        <TicketContent id={id} />
      </Suspense>
    </div>
  );
}
