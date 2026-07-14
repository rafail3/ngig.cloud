import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletePrefix, deleteObject } from "@/server/storage/b2";
import { notifyAdminsEvent } from "@/server/notifications/service";
import {
  sendAccountDeletedUser,
  sendAccountDeletedAdmin,
} from "@/server/email/resend";
import { dashboardOrigin } from "@/lib/dashboard";

// Deleting an account must leave NOTHING behind. Two systems are involved and
// only one of them has referential integrity:
//
//   Postgres — every user-scoped table FKs auth.users(id) ON DELETE CASCADE
//   (profiles, files, folders, notifications, login_audit, user_events,
//   user_insights, tickets, ticket_messages, ticket_views), and ticket_messages
//   / ticket_attachments cascade from tickets. So removing the auth user takes
//   the rows with it. Authorship columns on shared records are ON DELETE SET
//   NULL by design (invite_codes.used_by/created_by, invite_requests.handled_by,
//   announcements.created_by) — those records belong to the platform, not the
//   person, and must survive with the author de-linked.
//
//   B2 — no foreign keys at all. Nothing is cleaned up for us, so every object
//   has to be deleted explicitly, BEFORE the rows that point at it are gone.
//
// Hence the order below: B2 first, auth user last.

// Ticket attachments uploaded by SOMEONE ELSE (an admin answering) onto this
// user's tickets. They live under the uploader's prefix, so the prefix sweep
// can't see them — collect their keys while the rows still exist.
async function deleteForeignTicketMedia(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: tickets } = await admin
    .from("tickets")
    .select("id")
    .eq("user_id", userId);
  const ticketIds = (tickets ?? []).map((t) => t.id as string);
  if (ticketIds.length === 0) return;

  const { data: msgs } = await admin
    .from("ticket_messages")
    .select("id")
    .in("ticket_id", ticketIds);
  const msgIds = (msgs ?? []).map((m) => m.id as string);
  if (msgIds.length === 0) return;

  const { data: atts } = await admin
    .from("ticket_attachments")
    .select("storage_key")
    .in("message_id", msgIds);
  for (const a of atts ?? []) {
    await deleteObject(a.storage_key as string).catch(() => {});
  }
}

// Removes every trace of a user: their B2 objects, then the auth user (whose
// cascade clears the rows). Irreversible.
//
// `actorId` is whoever triggered it (the user themselves, or the admin doing
// it) — they're skipped in the admin notification, since nobody needs telling
// about their own action.
export async function wipeUserData(userId: string, actorId?: string): Promise<void> {
  const client = createAdminClient();
  // Read the identity BEFORE anything is destroyed — the notification needs the
  // name, and the farewell email needs an address that only exists on the auth
  // user we're about to delete.
  const { data: profile } = await client
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const username = (profile?.username as string) ?? "utilizator";
  const { data: authUser } = await client.auth.admin.getUserById(userId);
  const email = authUser.user?.email ?? null;

  await deleteForeignTicketMedia(userId);

  // The user's own namespaces: drive files `<userId>/…` (including trashed and
  // archived — they're the same objects) and support media they uploaded
  // anywhere, `tickets/<userId>/…`. Prefix sweeps are deliberately a superset of
  // what the DB knows about, so they also take orphans left by past failures.
  await deletePrefix(`${userId}/`);
  await deletePrefix(`tickets/${userId}/`);

  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw error;

  // Only now that it's actually gone. Admin notifications live on the admins'
  // own rows, so they survive the deleted user's cascade. Absolute + on the
  // dashboard host: the bell is read from both shells.
  await notifyAdminsEvent(
    "account_deleted",
    { utilizator: username },
    `${dashboardOrigin()}/users`,
    actorId,
  );

  // Best-effort: the account is already gone, so a mail failure must not surface
  // as "deletion failed".
  if (email) {
    void sendAccountDeletedUser({ email, username }).catch(() => {});
  }
  void sendAccountDeletedAdmin({
    username,
    email,
    bySelf: actorId === userId,
  }).catch(() => {});
}

// The platform must never be left without an admin — that state is only
// recoverable by hand in the Supabase console.
export async function assertNotLastAdmin(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  const admins = (data ?? []).map((p) => p.id as string);
  if (admins.includes(userId) && admins.length <= 1) {
    throw new Error(
      "Ești singurul administrator — promovează alt utilizator înainte de a șterge acest cont.",
    );
  }
}
