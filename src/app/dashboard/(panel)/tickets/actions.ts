"use server";

import { revalidatePath } from "next/cache";
import {
  replyAsAdmin,
  closeTicket,
  reopenTicket,
  deleteTicket,
  setTicketPriority,
  markInboxSeen,
} from "@/server/tickets/service";
import { requireAdmin } from "@/server/admin/guard";
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

// Stamps "I've looked at the list", which zeroes the nav badge. Called from the
// client (see TicketInboxWatcher) rather than during render: a shared layout
// isn't re-rendered on client navigation, so the badge would otherwise keep
// showing a stale count until the next full load.
export async function markInboxSeenAction(): Promise<SimpleResult> {
  try {
    const adminId = await requireAdmin();
    await markInboxSeen(adminId);
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
    await deleteTicket(id);
    revalidatePath("/dashboard/tickets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
