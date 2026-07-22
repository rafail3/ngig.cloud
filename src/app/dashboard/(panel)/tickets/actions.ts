"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/server/admin/guard";
import {
  replyAsAdmin,
  closeTicket,
  reopenTicket,
  deleteTicket,
  setTicketPriority,
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

// Admin triage: the user's pick at creation is only a hint — the admin decides
// the real priority, and users can't change it after opening the ticket.
export async function setPriorityAction(
  id: string,
  priority: string,
): Promise<SimpleResult> {
  try {
    await setTicketPriority(id, priority);
    revalidate(id);
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
    // History deletion is reserved for the super admin.
    await requireSuperAdmin();
    await deleteTicket(id);
    revalidatePath("/dashboard/tickets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
