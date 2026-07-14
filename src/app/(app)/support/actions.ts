"use server";

import { revalidatePath } from "next/cache";
import {
  presignTicketUpload,
  createTicket,
  replyAsUser,
  getAttachmentUrl,
} from "@/server/tickets/service";
import type { IncomingAttachment } from "@/lib/tickets";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "A apărut o eroare.";
  return { ok: false, error: msg };
}

// Presign a single attachment upload (browser PUTs the bytes to the URL).
export async function presignTicketUploadAction(input: {
  name: string;
  size: number;
  contentType: string;
}): Promise<Result<{ key: string; url: string }>> {
  try {
    const { key, url } = await presignTicketUpload(input);
    return { ok: true, key, url };
  } catch (e) {
    return fail(e);
  }
}

export async function createTicketAction(input: {
  subject: string;
  category: string;
  priority: string;
  body: string;
  attachments: IncomingAttachment[];
}): Promise<Result<{ id: string }>> {
  try {
    const id = await createTicket(input);
    revalidatePath("/support");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function replyTicketAction(input: {
  ticketId: string;
  body: string;
  attachments: IncomingAttachment[];
}): Promise<SimpleResult> {
  try {
    await replyAsUser(input);
    revalidatePath(`/support/${input.ticketId}`);
    revalidatePath("/support");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function getAttachmentUrlAction(
  id: string,
): Promise<Result<{ url: string }>> {
  try {
    const url = await getAttachmentUrl(id);
    return { ok: true, url };
  } catch (e) {
    return fail(e);
  }
}
