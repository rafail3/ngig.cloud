import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  recipient_count: number;
  created_at: string;
  created_by_username: string | null;
};

// Validate + normalize the optional link: an internal path ("/...") or an
// external http(s) URL. Anything else (javascript:, mailto:, bare words) is
// rejected so a broadcast can't carry an unsafe link.
export function normalizeLink(raw: string): string | null {
  const link = raw.trim();
  if (!link) return null;
  if (link.startsWith("/")) return link;
  try {
    const u = new URL(link);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    // not a URL — fall through to the error
  }
  throw new Error(
    "Link invalid. Folosește o cale internă (ex: /profil) sau un URL http(s).",
  );
}

// Bulk-insert notifications in batches to keep each request bounded.
const CHUNK = 500;

// Create an announcement and fan it out as a notification to every account
// except the sender. Returns how many recipients it reached.
export async function createAnnouncement(
  input: { title: string; body: string; link: string | null },
  senderId: string,
): Promise<number> {
  const admin = createAdminClient();

  const { data: ann, error: annErr } = await admin
    .from("announcements")
    .insert({
      title: input.title,
      body: input.body,
      link: input.link,
      created_by: senderId,
    })
    .select("id")
    .single();
  if (annErr) throw annErr;
  const announcementId = ann.id as string;

  // Every account except the sender.
  const { data: users, error: usersErr } = await admin
    .from("profiles")
    .select("id")
    .neq("id", senderId);
  if (usersErr) throw usersErr;
  const recipients = (users ?? []).map((u) => u.id as string);

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const rows = recipients.slice(i, i + CHUNK).map((uid) => ({
      user_id: uid,
      type: "announcement",
      title: `📣 ${input.title}`,
      body: input.body,
      link: input.link,
      announcement_id: announcementId,
    }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) throw error;
  }

  await admin
    .from("announcements")
    .update({ recipient_count: recipients.length })
    .eq("id", announcementId);

  return recipients.length;
}

// Admin history, newest first, with the author's username resolved.
export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select("id, title, body, link, recipient_count, created_at, created_by")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];

  const ids = [
    ...new Set(rows.map((r) => r.created_by).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, username")
      .in("id", ids);
    for (const p of profs ?? []) {
      names.set(p.id as string, (p.username as string) ?? "");
    }
  }

  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    link: r.link as string | null,
    recipient_count: r.recipient_count as number,
    created_at: r.created_at as string,
    created_by_username: r.created_by ? names.get(r.created_by) ?? null : null,
  }));
}

// Delete an announcement. The FK cascade on notifications.announcement_id
// recalls every notification this announcement created.
export async function deleteAnnouncement(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("announcements").delete().eq("id", id);
  if (error) throw error;
}
