import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  recipient_count: number;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
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

type AnnouncementInput = { title: string; body: string; link: string | null };

// Create an announcement and deliver it immediately to every account (the
// sender included). Fan-out runs in the DB via the fanout_announcement function
// (shared with the pg_cron scheduler). Returns how many recipients it reached.
export async function createAnnouncement(
  input: AnnouncementInput,
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

  const { data, error } = await admin.rpc("fanout_announcement", {
    ann_id: ann.id as string,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

// Queue an announcement for a future time. pg_cron's dispatch_due_announcements
// delivers it once scheduledAt passes (sent_at stays null until then).
export async function scheduleAnnouncement(
  input: AnnouncementInput,
  senderId: string,
  scheduledAt: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("announcements").insert({
    title: input.title,
    body: input.body,
    link: input.link,
    created_by: senderId,
    scheduled_at: scheduledAt,
  });
  if (error) throw error;
}

// Re-broadcast an existing announcement's content as a fresh announcement
// (new history entry + new fan-out). Returns how many recipients it reached.
export async function resendAnnouncement(
  id: string,
  senderId: string,
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select("title, body, link")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Anunț inexistent.");
  return createAnnouncement(
    {
      title: data.title as string,
      body: data.body as string,
      link: data.link as string | null,
    },
    senderId,
  );
}

// Admin history, newest first, with the author's username resolved.
export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select("id, title, body, link, recipient_count, created_at, scheduled_at, sent_at, created_by")
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
    scheduled_at: r.scheduled_at as string | null,
    sent_at: r.sent_at as string | null,
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
