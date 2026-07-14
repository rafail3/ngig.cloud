"use client";

import { TicketComposer } from "@/components/support/TicketComposer";
import { replyAdminAction } from "@/app/dashboard/(panel)/tickets/actions";
import type { IncomingAttachment } from "@/lib/tickets";

// Binds the shared composer to the admin reply action for a given ticket.
export function AdminReply({ ticketId }: { ticketId: string }) {
  return (
    <TicketComposer
      onSend={(body: string, attachments: IncomingAttachment[]) =>
        replyAdminAction({ ticketId, body, attachments })
      }
      placeholder="Răspunde utilizatorului…"
    />
  );
}
