"use client";

import { TicketComposer } from "./TicketComposer";
import { replyTicketAction } from "@/app/(app)/support/actions";
import type { IncomingAttachment } from "@/lib/tickets";

// Binds the shared composer to the user reply action for a given ticket.
export function UserReply({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  return (
    <TicketComposer
      onSend={(body: string, attachments: IncomingAttachment[]) =>
        replyTicketAction({ ticketId, body, attachments })
      }
      hint={closed ? "Ticketul e închis — un răspuns îl redeschide automat." : undefined}
    />
  );
}
