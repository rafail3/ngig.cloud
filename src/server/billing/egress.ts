import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type EgressSource = "download" | "preview" | "folder" | "office";

// Repeated previews of the same file within this window count once: the
// presigned URL changes per open, but video/audio only stream the watched
// ranges and images sit in the browser cache, so re-logging the full size
// every time would run far ahead of what B2 actually bills.
const PREVIEW_DEDUP_MS = 60 * 60 * 1000;

// Best-effort egress accounting for the admin cost calculator. Records the byte
// size of a file served to a user, at the moment we mint the presigned URL (the
// browser streams straight from B2, so the bytes never pass through us — the
// file's own size is the truthful figure we can log without proxying anything).
//
// `userId` is for callers with no session (the OnlyOffice open is the Document
// Server talking to us) — the row still lands under the file owner's id.
// `fileId` enables the preview dedup above.
//
// Always call inside `after(() => logEgress(...))` — it must never sit on the
// request's hot path.
export async function logEgress(
  bytes: number,
  source: EgressSource,
  opts?: { userId?: string; fileId?: string },
): Promise<void> {
  if (!bytes || bytes <= 0) return;
  try {
    let uid = opts?.userId;
    if (!uid) {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      uid = data?.claims?.sub as string | undefined;
    }
    if (!uid) return;

    // Server-side writes go through the service client: the dedup lookup needs
    // to read egress rows, which RLS reserves for admins.
    const admin = createAdminClient();

    if (source === "preview" && opts?.fileId) {
      const since = new Date(Date.now() - PREVIEW_DEDUP_MS).toISOString();
      const { data: recent } = await admin
        .from("egress_events")
        .select("id")
        .eq("user_id", uid)
        .eq("file_id", opts.fileId)
        .eq("source", "preview")
        .gte("created_at", since)
        .limit(1);
      if (recent && recent.length > 0) return; // already counted this window
    }

    await admin.from("egress_events").insert({
      user_id: uid,
      bytes,
      source,
      file_id: opts?.fileId ?? null,
    });
  } catch {
    // non-critical — a lost egress row only slightly under-counts the cost.
  }
}
