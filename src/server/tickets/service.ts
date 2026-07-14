import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/active-user";
import { requireAdmin } from "@/server/admin/guard";
import {
  presignUpload,
  presignDownload,
  presignInline,
  deleteObject,
} from "@/server/storage/b2";
import {
  notifyUserEvent,
  notifyAdminsEvent,
} from "@/server/notifications/service";
import {
  sendTicketOpenedUser,
  sendTicketOpenedAdmin,
  sendTicketClosed,
  sendTicketClosedAdmin,
} from "@/server/email/resend";
import {
  isTicketCategory,
  isTicketPriority,
  categoryLabel,
  attachmentKind,
  TICKET_MAX_ATTACHMENTS,
  TICKET_MAX_IMAGE_BYTES,
  TICKET_MAX_VIDEO_BYTES,
  TICKET_MAX_BODY,
  TICKET_MAX_SUBJECT,
  type TicketPriority,
  type TicketStatus,
  type IncomingAttachment,
  type AttachmentKind,
} from "@/lib/tickets";

export type TicketRow = {
  id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  last_activity_at: string;
  closed_at: string | null;
};

// A ticket in the admin list carries the owner's username for triage.
export type AdminTicketRow = TicketRow & {
  user_id: string;
  username: string;
  unread?: boolean;
};

export type TicketAttachment = {
  id: string;
  name: string;
  size: number;
  mime_type: string | null;
  // Media kind + a presigned URL so the thread can preview it inline (no
  // download round-trip). Null kind = legacy/unknown, rendered as a plain chip.
  kind: AttachmentKind | null;
  url: string;
};

export type TicketMessage = {
  id: string;
  from_admin: boolean;
  body: string;
  created_at: string;
  attachments: TicketAttachment[];
};

export type TicketDetail = TicketRow & {
  user_id: string;
  username: string;
  messages: TicketMessage[];
};

const APP_ORIGIN = "https://ngig.cloud";

// ── Upload presign ──────────────────────────────────────────────────────────
// The browser uploads an attachment straight to B2 with the returned URL, then
// passes {key,name,size,mimeType} into createTicket / replyAsUser. Keys are
// namespaced under the caller's id so they can't be forged onto another prefix.
// Server-side gate for a single attachment: images and videos only, capped per
// kind. Mirrors checkAttachment() on the client — never trust the picker.
function assertAllowedMedia(mime: string | null, size: number, name: string): void {
  const kind = attachmentKind(mime);
  if (!kind) throw new Error(`„${name}” nu e imagine sau video.`);
  const max = kind === "image" ? TICKET_MAX_IMAGE_BYTES : TICKET_MAX_VIDEO_BYTES;
  if (size > max) {
    throw new Error(`„${name}” depășește ${Math.round(max / (1024 * 1024))} MB.`);
  }
}

export async function presignTicketUpload(input: {
  name: string;
  size: number;
  contentType: string;
}): Promise<{ key: string; url: string }> {
  const { id } = await requireActiveUser();
  assertAllowedMedia(input.contentType, input.size, input.name);
  // Support media lives under its own `tickets/` namespace, entirely separate
  // from the drive (whose keys are `<userId>/<uuid>`), so nothing here can ever
  // show up in a user's files or count against their storage.
  const key = `tickets/${id}/${randomUUID()}`;
  const url = await presignUpload(key, input.contentType);
  return { key, url };
}

function validateAttachments(atts: IncomingAttachment[], ownerId: string): void {
  if (atts.length > TICKET_MAX_ATTACHMENTS) {
    throw new Error(`Maxim ${TICKET_MAX_ATTACHMENTS} atașamente.`);
  }
  for (const a of atts) {
    // The key must be one we minted for this caller (tickets/<their id>/…).
    if (!a.key.startsWith(`tickets/${ownerId}/`)) {
      throw new Error("Atașament invalid.");
    }
    assertAllowedMedia(a.mimeType, a.size, a.name);
  }
}

async function insertAttachments(
  messageId: string,
  atts: IncomingAttachment[],
): Promise<void> {
  if (atts.length === 0) return;
  const admin = createAdminClient();
  const rows = atts.map((a) => ({
    message_id: messageId,
    name: a.name.slice(0, 255),
    size: a.size,
    mime_type: a.mimeType,
    storage_key: a.key,
  }));
  const { error } = await admin.from("ticket_attachments").insert(rows);
  if (error) throw error;
}

async function usernameOf(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return (data?.username as string) ?? "utilizator";
}

async function emailOf(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

// ── Create ──────────────────────────────────────────────────────────────────
export async function createTicket(input: {
  subject: string;
  category: string;
  priority: string;
  body: string;
  attachments: IncomingAttachment[];
}): Promise<string> {
  const { id: userId } = await requireActiveUser();

  const subject = input.subject.trim().slice(0, TICKET_MAX_SUBJECT);
  const body = input.body.trim().slice(0, TICKET_MAX_BODY);
  if (!subject) throw new Error("Adaugă un subiect.");
  if (!body) throw new Error("Adaugă un mesaj.");
  if (!isTicketCategory(input.category)) throw new Error("Categorie invalidă.");
  const priority: TicketPriority = isTicketPriority(input.priority)
    ? input.priority
    : "medium";
  validateAttachments(input.attachments, userId);

  const admin = createAdminClient();

  // Ticket row (owner + metadata).
  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .insert({ user_id: userId, subject, category: input.category, priority })
    .select("id")
    .single();
  if (tErr) throw tErr;
  const ticketId = ticket.id as string;

  // First message (the description) + its attachments.
  const { data: msg, error: mErr } = await admin
    .from("ticket_messages")
    .insert({ ticket_id: ticketId, author_id: userId, from_admin: false, body })
    .select("id")
    .single();
  if (mErr) throw mErr;
  await insertAttachments(msg.id as string, input.attachments);

  // Confirm to the opener (in-app), notify every OTHER admin, and email both.
  // The opener is excluded from the admin fan-out so an admin opening a ticket
  // never gets "X a deschis un ticket" about their own action.
  const username = await usernameOf(userId);
  await notifyUserEvent(
    userId,
    "ticket_created",
    { subiect: subject, categorie: categoryLabel(input.category) },
    `${APP_ORIGIN}/support/${ticketId}`,
  );
  await notifyAdminsEvent(
    "ticket_opened",
    { utilizator: username, subiect: subject, categorie: categoryLabel(input.category) },
    `/tickets/${ticketId}`,
    userId,
  );
  const email = await emailOf(userId);
  if (email) {
    void sendTicketOpenedUser({ email, subject, category: input.category, ticketId }).catch(() => {});
  }
  void sendTicketOpenedAdmin({
    username,
    subject,
    category: input.category,
    priority,
    message: body,
    ticketId,
  }).catch(() => {});

  return ticketId;
}

// ── Reads ───────────────────────────────────────────────────────────────────
// The signed-in user's own tickets (RLS-scoped), newest activity first.
export async function listMyTickets(): Promise<TicketRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, subject, category, priority, status, created_at, last_activity_at, closed_at")
    .order("last_activity_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TicketRow[];
}

// All tickets for the dashboard. Open first, then by recent activity.
export async function listAllTickets(): Promise<AdminTicketRow[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tickets")
    .select("id, user_id, subject, category, priority, status, created_at, last_activity_at, closed_at")
    .order("status", { ascending: true }) // 'closed' < 'open' alphabetically → flip below
    .order("last_activity_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as (TicketRow & { user_id: string })[];

  // Resolve usernames in one query.
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, username")
      .in("id", ids);
    for (const p of profs ?? []) nameById.set(p.id as string, p.username as string);
  }

  return rows
    .map((r) => ({ ...r, username: nameById.get(r.user_id) ?? "utilizator" }))
    // Open tickets first, then most-recent activity.
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return b.last_activity_at.localeCompare(a.last_activity_at);
    });
}

async function loadMessages(
  ticketId: string,
  client: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
): Promise<TicketMessage[]> {
  const { data: msgs, error } = await client
    .from("ticket_messages")
    .select("id, from_admin, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const messages = (msgs ?? []) as Omit<TicketMessage, "attachments">[];

  const ids = messages.map((m) => m.id);
  const attByMsg = new Map<string, TicketAttachment[]>();
  if (ids.length > 0) {
    const { data: atts } = await client
      .from("ticket_attachments")
      .select("id, message_id, name, size, mime_type, storage_key")
      .in("message_id", ids);
    // Presigning is local crypto (no network), so signing every attachment for
    // inline rendering is cheap. 1h keeps a long-open thread's media alive.
    for (const a of atts ?? []) {
      const list = attByMsg.get(a.message_id as string) ?? [];
      list.push({
        id: a.id as string,
        name: a.name as string,
        size: a.size as number,
        mime_type: a.mime_type as string | null,
        kind: attachmentKind(a.mime_type as string | null),
        url: await presignInline(a.storage_key as string),
      });
      attByMsg.set(a.message_id as string, list);
    }
  }

  return messages.map((m) => ({ ...m, attachments: attByMsg.get(m.id) ?? [] }));
}

// A ticket for its owner (RLS enforces ownership; returns null if not theirs).
export async function getMyTicket(id: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tickets")
    .select("id, user_id, subject, category, priority, status, created_at, last_activity_at, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (!t) return null;
  const messages = await loadMessages(id, supabase);
  const username = await usernameOf(t.user_id as string);
  return { ...(t as TicketRow & { user_id: string }), username, messages };
}

// A ticket for an admin (any owner).
export async function getTicketAsAdmin(id: string): Promise<TicketDetail | null> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: t } = await admin
    .from("tickets")
    .select("id, user_id, subject, category, priority, status, created_at, last_activity_at, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (!t) return null;
  const messages = await loadMessages(id, admin);
  const username = await usernameOf(t.user_id as string);
  return { ...(t as TicketRow & { user_id: string }), username, messages };
}

// ── Replies ─────────────────────────────────────────────────────────────────
async function bumpActivity(ticketId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("tickets")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", ticketId);
}

// User replies to their own ticket. A reply to a closed ticket reopens it.
export async function replyAsUser(input: {
  ticketId: string;
  body: string;
  attachments: IncomingAttachment[];
}): Promise<void> {
  const { id: userId } = await requireActiveUser();
  const body = input.body.trim().slice(0, TICKET_MAX_BODY);
  if (!body) throw new Error("Adaugă un mesaj.");
  validateAttachments(input.attachments, userId);

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, subject, status, user_id")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (!ticket || ticket.user_id !== userId) throw new Error("Ticket inexistent.");

  const { data: msg, error } = await admin
    .from("ticket_messages")
    .insert({ ticket_id: input.ticketId, author_id: userId, from_admin: false, body })
    .select("id")
    .single();
  if (error) throw error;
  await insertAttachments(msg.id as string, input.attachments);

  const now = new Date().toISOString();
  const reopened = ticket.status === "closed";
  await admin
    .from("tickets")
    .update(reopened ? { last_activity_at: now, status: "open", closed_at: null } : { last_activity_at: now })
    .eq("id", input.ticketId);

  // Notify admins — but never the author themselves (an admin replying on their
  // own ticket shouldn't be told about their own message).
  const username = await usernameOf(userId);
  await notifyAdminsEvent(
    "ticket_user_reply",
    { utilizator: username, subiect: ticket.subject as string },
    `/tickets/${input.ticketId}`,
    userId,
  );
}

// Admin replies to any ticket → notify the owner (in-app only, no email).
export async function replyAsAdmin(input: {
  ticketId: string;
  body: string;
  attachments: IncomingAttachment[];
}): Promise<void> {
  const adminId = await requireAdmin();
  const body = input.body.trim().slice(0, TICKET_MAX_BODY);
  if (!body) throw new Error("Adaugă un mesaj.");
  validateAttachments(input.attachments, adminId);

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, subject, user_id")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (!ticket) throw new Error("Ticket inexistent.");

  const { data: msg, error } = await admin
    .from("ticket_messages")
    .insert({ ticket_id: input.ticketId, author_id: adminId, from_admin: true, body })
    .select("id")
    .single();
  if (error) throw error;
  await insertAttachments(msg.id as string, input.attachments);
  await bumpActivity(input.ticketId);

  // Only the counterpart hears about it — no self-notification when an admin
  // answers a ticket they opened themselves.
  if ((ticket.user_id as string) !== adminId) {
    await notifyUserEvent(
      ticket.user_id as string,
      "ticket_reply",
      { subiect: ticket.subject as string },
      `${APP_ORIGIN}/support/${input.ticketId}`,
    );
  }
}

// Admin-only triage: the priority the user picked at creation is a hint; the
// admin has the final say. Users can't change it after opening the ticket.
export async function setTicketPriority(
  id: string,
  priority: string,
): Promise<void> {
  await requireAdmin();
  if (!isTicketPriority(priority)) throw new Error("Prioritate invalidă.");
  const admin = createAdminClient();
  const { error } = await admin.from("tickets").update({ priority }).eq("id", id);
  if (error) throw error;
}

// Badge count for the dashboard nav: open tickets whose last message came from
// the user — i.e. the ones actually waiting on an admin.
export async function countTicketsNeedingReply(): Promise<number> {
  const admin = createAdminClient();
  const { data: open } = await admin
    .from("tickets")
    .select("id")
    .eq("status", "open");
  const ids = (open ?? []).map((t) => t.id as string);
  if (ids.length === 0) return 0;

  const { data: msgs } = await admin
    .from("ticket_messages")
    .select("ticket_id, from_admin, created_at")
    .in("ticket_id", ids)
    .order("created_at", { ascending: true });

  // Last message per ticket wins; a user-authored last message = needs a reply.
  const lastFromAdmin = new Map<string, boolean>();
  for (const m of msgs ?? []) {
    lastFromAdmin.set(m.ticket_id as string, m.from_admin as boolean);
  }
  return ids.filter((id) => lastFromAdmin.get(id) === false).length;
}

// ── Status ──────────────────────────────────────────────────────────────────
export async function closeTicket(id: string): Promise<void> {
  const adminId = await requireAdmin();
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, subject, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) throw new Error("Ticket inexistent.");
  if (ticket.status === "closed") return;

  const now = new Date().toISOString();
  await admin
    .from("tickets")
    .update({ status: "closed", closed_at: now, last_activity_at: now })
    .eq("id", id);

  const subject = ticket.subject as string;
  const ownerId = ticket.user_id as string;

  if (ownerId !== adminId) {
    await notifyUserEvent(
      ownerId,
      "ticket_closed",
      { subiect: subject },
      `${APP_ORIGIN}/support/${id}`,
    );
  }
  const email = await emailOf(ownerId);
  if (email) {
    void sendTicketClosed({ email, subject, ticketId: id }).catch(() => {});
  }
  // The support inbox gets an email for both ends of a ticket's life.
  void sendTicketClosedAdmin({
    username: await usernameOf(ownerId),
    subject,
    ticketId: id,
  }).catch(() => {});
}

export async function reopenTicket(id: string): Promise<void> {
  const adminId = await requireAdmin();
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, subject, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) throw new Error("Ticket inexistent.");
  if (ticket.status === "open") return;

  const now = new Date().toISOString();
  await admin
    .from("tickets")
    .update({ status: "open", closed_at: null, last_activity_at: now })
    .eq("id", id);

  if ((ticket.user_id as string) !== adminId) {
    await notifyUserEvent(
      ticket.user_id as string,
      "ticket_reopened",
      { subiect: ticket.subject as string },
      `${APP_ORIGIN}/support/${id}`,
    );
  }
}

// ── Delete (admin) ──────────────────────────────────────────────────────────
// Removes the ticket, its messages (cascade) and the attachment objects in B2.
export async function deleteTicket(id: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  // Collect attachment keys before the cascade wipes the rows.
  const { data: msgs } = await admin
    .from("ticket_messages")
    .select("id")
    .eq("ticket_id", id);
  const msgIds = (msgs ?? []).map((m) => m.id as string);
  if (msgIds.length > 0) {
    const { data: atts } = await admin
      .from("ticket_attachments")
      .select("storage_key")
      .in("message_id", msgIds);
    for (const a of atts ?? []) {
      await deleteObject(a.storage_key as string).catch(() => {});
    }
  }

  const { error } = await admin.from("tickets").delete().eq("id", id);
  if (error) throw error;
}

// ── Attachment download ─────────────────────────────────────────────────────
// Presigned GET for one attachment, gated by the caller's access to its row
// (RLS via the user client; admins pass through their own policy).
export async function getAttachmentUrl(attachmentId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ticket_attachments")
    .select("name, storage_key")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!data) throw new Error("Atașament inexistent.");
  return presignDownload(data.storage_key as string, data.name as string);
}
