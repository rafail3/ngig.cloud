import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/active-user";
import { requireAdmin } from "@/server/admin/guard";
import { presignUpload, presignDownload, deleteObject } from "@/server/storage/b2";
import {
  notifyUserEvent,
  notifyAdminsEvent,
} from "@/server/notifications/service";
import {
  sendTicketOpenedUser,
  sendTicketOpenedAdmin,
  sendTicketClosed,
} from "@/server/email/resend";
import {
  isTicketCategory,
  isTicketPriority,
  categoryLabel,
  TICKET_MAX_ATTACHMENTS,
  TICKET_MAX_ATTACHMENT_BYTES,
  TICKET_MAX_BODY,
  TICKET_MAX_SUBJECT,
  type TicketPriority,
  type TicketStatus,
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

// One attachment as accepted from the client: it was uploaded to B2 via a
// presigned PUT (see presignTicketUpload) and we now store its metadata.
export type IncomingAttachment = {
  key: string;
  name: string;
  size: number;
  mimeType: string | null;
};

const APP_ORIGIN = "https://ngig.cloud";

// ── Upload presign ──────────────────────────────────────────────────────────
// The browser uploads an attachment straight to B2 with the returned URL, then
// passes {key,name,size,mimeType} into createTicket / replyAsUser. Keys are
// namespaced under the caller's id so they can't be forged onto another prefix.
export async function presignTicketUpload(input: {
  name: string;
  size: number;
  contentType: string;
}): Promise<{ key: string; url: string }> {
  const { id } = await requireActiveUser();
  if (input.size > TICKET_MAX_ATTACHMENT_BYTES) {
    throw new Error("Fișierul e prea mare (max 25 MB).");
  }
  const key = `tickets/${id}/${randomUUID()}`;
  const url = await presignUpload(key, input.contentType || "application/octet-stream");
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
    if (a.size > TICKET_MAX_ATTACHMENT_BYTES) {
      throw new Error("Un atașament e prea mare.");
    }
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

  // Notify admins (in-app) + email, and confirm to the user by email.
  const username = await usernameOf(userId);
  await notifyAdminsEvent(
    "ticket_opened",
    { utilizator: username, subiect: subject, categorie: categoryLabel(input.category) },
    `/tickets/${ticketId}`,
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
      .select("id, message_id, name, size, mime_type")
      .in("message_id", ids);
    for (const a of atts ?? []) {
      const list = attByMsg.get(a.message_id as string) ?? [];
      list.push({ id: a.id as string, name: a.name as string, size: a.size as number, mime_type: a.mime_type as string | null });
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

  const username = await usernameOf(userId);
  await notifyAdminsEvent(
    "ticket_user_reply",
    { utilizator: username, subiect: ticket.subject as string },
    `/tickets/${input.ticketId}`,
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

  await notifyUserEvent(
    ticket.user_id as string,
    "ticket_reply",
    { subiect: ticket.subject as string },
    `${APP_ORIGIN}/support/${input.ticketId}`,
  );
}

// ── Status ──────────────────────────────────────────────────────────────────
export async function closeTicket(id: string): Promise<void> {
  await requireAdmin();
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

  await notifyUserEvent(
    ticket.user_id as string,
    "ticket_closed",
    { subiect: ticket.subject as string },
    `${APP_ORIGIN}/support/${id}`,
  );
  const email = await emailOf(ticket.user_id as string);
  if (email) {
    void sendTicketClosed({ email, subject: ticket.subject as string, ticketId: id }).catch(() => {});
  }
}

export async function reopenTicket(id: string): Promise<void> {
  await requireAdmin();
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

  await notifyUserEvent(
    ticket.user_id as string,
    "ticket_reopened",
    { subiect: ticket.subject as string },
    `${APP_ORIGIN}/support/${id}`,
  );
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
