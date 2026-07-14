"use server";

import { revalidatePath } from "next/cache";
import {
  replyAsAdmin,
  closeTicket,
  reopenTicket,
  deleteTicket,
} from "@/server/tickets/service";
import type { IncomingAttachment } from "@/lib/tickets";

type SimpleResult = { ok: true } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "A apărut o eroare." };
}

function revalidate(id: string) {
  revalidatePath("/dashboard/tickets");
  revalidatePath(`/dashboard/tickets/${id}`);
}

export async function replyAdminAction(input: {
  ticketId: string;
  body: string;
  attachments: IncomingAttachment[];
}): Promise<SimpleResult> {
  try {
    await replyAsAdmin(input);
    revalidate(input.ticketId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function closeTicketAction(id: string): Promise<SimpleResult> {
  try {
    await closeTicket(id);
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reopenTicketAction(id: string): Promise<SimpleResult> {
  try {
    await reopenTicket(id);
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTicketAction(id: string): Promise<SimpleResult> {
  try {
    await deleteTicket(id);
    revalidatePath("/dashboard/tickets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
