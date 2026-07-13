import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type NewNotification = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

// Insert one notification for a specific user (server-side / service role).
export async function createNotification(
  input: NewNotification & { userId: string },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  if (error) throw error;
}

// Best-effort variant: never throws. Notifications are always secondary to the
// action that triggers them, so a notification failure must never break (or roll
// back) the real work. Use these at call sites instead of wrapping each in a
// try/catch of its own.
export async function notifyUserSafe(
  input: NewNotification & { userId: string },
): Promise<void> {
  try {
    await createNotification(input);
  } catch {
    // non-critical
  }
}

export async function notifyAdminsSafe(input: NewNotification): Promise<void> {
  try {
    await notifyAdmins(input);
  } catch {
    // non-critical
  }
}

// Notify every admin (used for platform-status events, e.g. a new invite request).
export async function notifyAdmins(input: NewNotification): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (error) throw error;
  const rows = (data ?? []).map((p) => ({
    user_id: p.id as string,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  }));
  if (rows.length === 0) return;
  const { error: insErr } = await admin.from("notifications").insert(rows);
  if (insErr) throw insErr;
}

// The signed-in user's own notifications, newest first (RLS-scoped).
export async function listMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}

// Resolve the signed-in user's id from the session (server-side, trusted).
async function currentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) throw new Error("Neautentificat.");
  return uid;
}

// Delete one of the caller's notifications. There's no RLS delete policy on the
// table (inserts are service-role, selects/updates are self-scoped), so we use
// the admin client but scope the delete to BOTH the row id and the verified
// caller — a user can only ever delete their own rows.
export async function deleteMyNotification(id: string): Promise<void> {
  const uid = await currentUserId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);
  if (error) throw error;
}

// Clear the caller's entire notification history.
export async function clearMyNotifications(): Promise<void> {
  const uid = await currentUserId();
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").delete().eq("user_id", uid);
  if (error) throw error;
}
