import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { getTicketAsAdmin } from "@/server/tickets/service";
import { ChatPanel } from "@/components/support/ChatPanel";
import { CategoryBadge, StatusBadge } from "@/components/support/badges";
import { AdminReply } from "@/components/dashboard/AdminReply";
import { TicketStatusControls } from "@/components/dashboard/TicketStatusControls";
import { TicketPrioritySelect } from "@/components/dashboard/TicketPrioritySelect";

export const metadata = { title: "Dashboard — Ticket" };

async function TicketContent({ id }: { id: string }) {
  await connection();
  const ticket = await getTicketAsAdmin(id);
  if (!ticket) notFound();

  return (
    <>
      <header className="shrink-0 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
              {ticket.subject}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={ticket.status} />
              <CategoryBadge category={ticket.category} />
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                {ticket.username}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TicketPrioritySelect ticketId={ticket.id} priority={ticket.priority} />
            <TicketStatusControls ticketId={ticket.id} status={ticket.status} />
          </div>
        </div>
      </header>

      <ChatPanel messages={ticket.messages} viewerIsAdmin authorName={ticket.username}>
        <AdminReply ticketId={ticket.id} />
      </ChatPanel>
    </>
  );
}

function ChatSkeleton() {
  return (
    <>
      <div className="shrink-0 pb-3">
        <div className="h-6 w-56 animate-pulse rounded bg-zinc-900" />
        <div className="mt-2 h-5 w-40 animate-pulse rounded bg-zinc-900/70" />
      </div>
      <div className="min-h-0 flex-1 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/30" />
      <div className="mt-3 h-32 shrink-0 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/30" />
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
    // Fixed-height column under the h-16 navbar so the thread scrolls inside and
    // the composer stays put at the bottom.
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-4 pb-4 pt-4 sm:px-6">
      <Link
        href="/tickets"
        className="inline-flex w-fit shrink-0 items-center gap-1.5 pb-2 text-sm text-zinc-400 transition hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" /> Toate ticketele
      </Link>

      <Suspense fallback={<ChatSkeleton />}>
        <TicketContent id={id} />
      </Suspense>
    </div>
  );
}
